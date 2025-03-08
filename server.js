const express = require('express');
const tf = require('@tensorflow/tfjs');
const cors = require('cors');
const { trainModel, textToVector } = require('./model');
const { initializeGeminiChat, getGeminiResponse } = require('./gemini');
const data = require('./data');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Cấu hình CORS chi tiết
const corsOptions = {
    origin: '*', // Cho phép tất cả các origin trong môi trường development
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: false // Tắt credentials vì chúng ta cho phép tất cả các origin
};
app.use(cors(corsOptions));

// Cấu hình từ .env
const MAX_HISTORY_LENGTH = parseInt(process.env.MAX_HISTORY_LENGTH) || 50;
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7;
const MESSAGE_LENGTH_THRESHOLD = parseInt(process.env.MESSAGE_LENGTH_THRESHOLD) || 50;

let model;
let vocabulary;
let chatHistory = new Map(); // Lưu trữ lịch sử chat cho mỗi session
let geminiChats = new Map(); // Lưu trữ các phiên chat Gemini
let isGeminiAvailable = false; // Flag để kiểm tra Gemini có khả dụng không

// Khởi tạo model và kiểm tra Gemini
async function initialize() {
    try {
        // Training model
        const result = await trainModel();
        model = result.model;
        vocabulary = result.vocabulary;
        console.log('Model đã được training xong!');

        // Kiểm tra Gemini
        try {
            const testChat = await initializeGeminiChat();
            const testResponse = await getGeminiResponse(testChat, "test");
            if (testResponse) {
                isGeminiAvailable = true;
                console.log('Gemini API đã sẵn sàng!');
            }
        } catch (error) {
            console.log('Không thể kết nối với Gemini API, sẽ sử dụng model local:', error.message);
        }
    } catch (error) {
        console.error('Lỗi khởi tạo:', error);
    }
}

// Quyết định sử dụng Gemini hay model local
// Kiểm tra độ dài và từ khóa để xác định câu hỏi phức tạp
function shouldUseGemini(message, intent, confidence) {
    // Danh sách từ khóa cho các chủ đề phức tạp
    const complexTopics = ['tại sao', 'giải thích', 'như thế nào', 'là gì', 'hình gì', 'thế nào'];

    // Kiểm tra độ dài
    if (message.length > MESSAGE_LENGTH_THRESHOLD) return true;

    // Kiểm tra từ khóa phức tạp
    if (complexTopics.some(topic => message.toLowerCase().includes(topic))) return true;

    // Kiểm tra intent và confidence
    const basicIntents = ["greeting", "goodbye", "thanks"];
    if (basicIntents.includes(intent)) {
        // Chỉ sử dụng model local khi confidence rất cao cho các intent cơ bản
        return confidence < 0.95;
    }

    // Kiểm tra nếu tin nhắn chứa danh từ riêng hoặc thuật ngữ
    const specialTerms = ['trái đất', 'mặt trời', 'mặt trăng', 'sao', 'thiên hà', 'vũ trụ', 'khí quyển'];
    if (specialTerms.some(term => message.toLowerCase().includes(term))) return true;

    return true; // Mặc định sử dụng Gemini cho các trường hợp khác
}

// API endpoint để nhận tin nhắn và trả lời
app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body;

    // Kiểm tra tin nhắn ping để test kết nối
    if (message === 'ping' && sessionId === 'connection-test') {
        return res.json({ status: 'ok' });
    }

    if (!message) {
        return res.status(400).json({ error: 'Vui lòng nhập tin nhắn' });
    }

    // Kiểm tra xem model đã được khởi tạo chưa
    if (!model || !vocabulary) {
        return res.status(503).json({
            error: 'Hệ thống đang khởi động, vui lòng thử lại sau vài giây'
        });
    }

    try {
        // Lấy lịch sử chat của session
        if (!chatHistory.has(sessionId)) {
            chatHistory.set(sessionId, []);
        }
        const history = chatHistory.get(sessionId);

        // Chuyển tin nhắn thành vector
        const inputVector = textToVector(message, vocabulary);

        // Dự đoán intent
        const prediction = await model.predict(tf.tensor2d([inputVector])).array();
        const intentIndex = prediction[0].indexOf(Math.max(...prediction[0]));
        const confidence = Math.max(...prediction[0]);
        const intent = data.intents[intentIndex].tag;

        let response;
        let useGemini = false;

        // Quyết định sử dụng Gemini hay model local
        // Kiểm tra độ dài và từ khóa để xác định câu hỏi phức tạp
        if (isGeminiAvailable && shouldUseGemini(message, intent, confidence)) {
            try {
                if (!geminiChats.has(sessionId)) {
                    geminiChats.set(sessionId, await initializeGeminiChat());
                }
                const geminiChat = geminiChats.get(sessionId);
                response = await getGeminiResponse(geminiChat, message);
                useGemini = true;
                console.log('Sử dụng Gemini API cho câu hỏi phức tạp');
            } catch (error) {
                console.error('Lỗi Gemini:', error);
                response = "Xin lỗi, hiện tại tôi đang gặp vấn đề kết nối. Bạn có thể thử lại sau hoặc hỏi câu khác không?";
                useGemini = false;
            }
        } else {
            // Sử dụng model local cho các intent cơ bản
            const responses = data.intents[intentIndex].responses;
            response = responses[Math.floor(Math.random() * responses.length)];
            console.log('Sử dụng model local cho intent:', intent);
        }

        // Lưu tin nhắn vào lịch sử
        history.push({
            type: 'user',
            message,
            timestamp: new Date().toISOString()
        });
        history.push({
            type: 'bot',
            message: response,
            intent: useGemini ? 'gemini' : intent,
            confidence: useGemini ? 1 : confidence,
            timestamp: new Date().toISOString()
        });

        // Giới hạn lịch sử lưu trữ
        if (history.length > MAX_HISTORY_LENGTH) {
            history.splice(0, 2);
        }

        res.json({
            response,
            intent: useGemini ? 'gemini' : intent,
            confidence: useGemini ? 1 : confidence,
            isGeminiResponse: useGemini
        });
    } catch (error) {
        console.error('Lỗi:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi xử lý tin nhắn' });
    }
});

// API endpoint để lấy lịch sử chat
app.get('/api/history/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const history = chatHistory.get(sessionId) || [];
    res.json(history);
});

// API Documentation route
app.get('/api/docs', (req, res) => {
    res.json({
        endpoints: {
            '/api/chat': {
                method: 'POST',
                description: 'Send a message to the chatbot',
                parameters: {
                    message: 'string - The message to send',
                    sessionId: 'string - Unique session identifier'
                },
                example: {
                    request: {
                        message: "Xin chào",
                        sessionId: "user123"
                    },
                    response: {
                        response: "Chào bạn! Tôi có thể giúp gì cho bạn?",
                        intent: "greeting",
                        confidence: 0.95,
                        isGeminiResponse: false
                    }
                }
            },
            '/api/history/:sessionId': {
                method: 'GET',
                description: 'Get chat history for a session',
                parameters: {
                    sessionId: 'string - Session ID in URL parameter'
                }
            }
        },
        usage: {
            curl: 'curl -X POST -H "Content-Type: application/json" -d \'{"message":"Xin chào","sessionId":"user123"}\' https://your-domain.vercel.app/api/chat',
            javascript: `
                fetch('https://your-domain.vercel.app/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'Xin chào',
                        sessionId: 'user123'
                    })
                }).then(response => response.json())
                  .then(data => console.log(data));
            `
        }
    });
});

// Cập nhật giao diện để thêm dark mode
app.get('/', (req, res) => {
    const currentUrl = req.protocol + '://' + req.get('host');
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>AI Chatbot with Gemini</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg-color: #f0f2f5;
                --container-bg: #ffffff;
                --text-color: #333333;
                --secondary-text: #666666;
                --primary-color: #2196f3;
                --primary-dark: #1976d2;
                --message-user-bg: #2196f3;
                --message-user-color: #ffffff;
                --message-bot-bg: #f8f9fa;
                --message-bot-color: #333333;
                --input-border: #dddddd;
                --header-bg: #2196f3;
                --header-color: #ffffff;
                --typing-bg: #e9ecef;
            }

            [data-theme="dark"] {
                --bg-color: #1a1a1a;
                --container-bg: #2d2d2d;
                --text-color: #ffffff;
                --secondary-text: #b0b0b0;
                --primary-color: #64b5f6;
                --primary-dark: #42a5f5;
                --message-user-bg: #64b5f6;
                --message-user-color: #ffffff;
                --message-bot-bg: #383838;
                --message-bot-color: #ffffff;
                --input-border: #404040;
                --header-bg: #383838;
                --header-color: #ffffff;
                --typing-bg: #404040;
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Roboto', sans-serif;
                background: var(--bg-color);
                height: 100vh;
                display: flex;
                flex-direction: column;
                color: var(--text-color);
                transition: all 0.3s ease;
                line-height: 1.6;
            }

            .container {
                max-width: 1000px;
                margin: 20px auto;
                background: var(--container-bg);
                border-radius: 15px;
                box-shadow: 0 2px 15px rgba(0,0,0,0.1);
                height: calc(100vh - 40px);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .header {
                padding: 20px;
                background: var(--header-bg);
                color: var(--header-color);
                border-radius: 15px 15px 0 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }

            .header-controls {
                display: flex;
                align-items: center;
                gap: 15px;
            }

            #status {
                padding: 5px 10px;
                border-radius: 15px;
                background: rgba(255,255,255,0.2);
                font-size: 14px;
            }

            .theme-toggle {
                background: none;
                border: none;
                color: var(--header-color);
                cursor: pointer;
                padding: 8px 12px;
                border-radius: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                transition: all 0.3s ease;
                background: rgba(255,255,255,0.1);
            }

            .theme-toggle:hover {
                background: rgba(255,255,255,0.2);
            }

            .header h1 {
                font-size: 24px;
                font-weight: 500;
            }

            #chat-container {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                background: var(--bg-color);
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .message {
                max-width: 85%;
                display: flex;
                flex-direction: column;
                gap: 5px;
                animation: fadeIn 0.3s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .user-message {
                align-self: flex-end;
            }

            .bot-message {
                align-self: flex-start;
            }

            .message-content {
                padding: 12px 16px;
                border-radius: 15px;
                font-size: 15px;
                line-height: 1.5;
                white-space: pre-wrap;
            }

            .user-message .message-content {
                background: var(--message-user-bg);
                color: var(--message-user-color);
                border-bottom-right-radius: 5px;
            }

            .bot-message .message-content {
                background: var(--message-bot-bg);
                color: var(--message-bot-color);
                border-bottom-left-radius: 5px;
            }

            .message-info {
                font-size: 12px;
                color: var(--secondary-text);
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 0 5px;
            }

            .user-message .message-info {
                justify-content: flex-end;
            }

            .source-indicator {
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 500;
                letter-spacing: 0.3px;
            }

            .source-intent {
                background: #e3f2fd;
                color: #1976d2;
            }

            .source-gemini {
                background: #f3e5f5;
                color: #7b1fa2;
            }

            [data-theme="dark"] .source-intent {
                background: #1565c0;
                color: #e3f2fd;
            }

            [data-theme="dark"] .source-gemini {
                background: #6a1b9a;
                color: #f3e5f5;
            }

            .typing-indicator {
                display: none;
                padding: 12px 16px;
                background: var(--typing-bg);
                border-radius: 15px;
                color: var(--text-color);
                font-size: 14px;
                width: fit-content;
                margin-bottom: 10px;
                animation: fadeIn 0.3s ease;
            }

            #input-container {
                padding: 20px;
                background: var(--container-bg);
                border-top: 1px solid var(--input-border);
                display: flex;
                gap: 10px;
            }

            #message-input {
                flex: 1;
                padding: 12px 20px;
                border: 2px solid var(--input-border);
                border-radius: 25px;
                font-size: 15px;
                outline: none;
                transition: all 0.3s ease;
                background: var(--container-bg);
                color: var(--text-color);
            }

            #message-input:focus {
                border-color: var(--primary-color);
                box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
            }

            button {
                padding: 12px 24px;
                background: var(--primary-color);
                color: #ffffff;
                border: none;
                border-radius: 25px;
                cursor: pointer;
                font-size: 15px;
                font-weight: 500;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            button:hover {
                background: var(--primary-dark);
                transform: translateY(-1px);
            }

            button:active {
                transform: translateY(0);
            }

            @media (max-width: 768px) {
                .container {
                    margin: 0;
                    height: 100vh;
                    border-radius: 0;
                }

                .header {
                    border-radius: 0;
                }

                .message {
                    max-width: 90%;
                }

                #message-input {
                    padding: 10px 16px;
                }

                button {
                    padding: 10px 20px;
                }
            }

            /* Custom Scrollbar */
            ::-webkit-scrollbar {
                width: 8px;
            }

            /* Status Indicator Styles */
            #status {
                padding: 5px 10px;
                border-radius: 15px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.3s ease;
            }

            #status::before {
                content: '';
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
            }

            .status-online {
                background: rgba(52, 199, 89, 0.2);
                color: #34c759;
            }

            .status-online::before {
                background: #34c759;
                box-shadow: 0 0 0 2px rgba(52, 199, 89, 0.2);
            }

            .status-offline {
                background: rgba(255, 69, 58, 0.2);
                color: #ff453a;
            }

            .status-offline::before {
                background: #ff453a;
                box-shadow: 0 0 0 2px rgba(255, 69, 58, 0.2);
            }

            [data-theme="dark"] .status-online {
                background: rgba(52, 199, 89, 0.15);
            }

            [data-theme="dark"] .status-offline {
                background: rgba(255, 69, 58, 0.15);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>AI Chatbot with Gemini</h1>
                <div class="header-controls">
                    <span id="status" class="status-offline">Offline</span>
                    <button class="theme-toggle" onclick="toggleTheme()">
                        <span id="theme-icon">🌙</span>
                        <span id="theme-text">Dark Mode</span>
                    </button>
                </div>
            </div>
            <div id="chat-container">
                <div class="typing-indicator">Bot đang nhập...</div>
            </div>
            <div id="input-container">
                <input type="text" id="message-input" placeholder="Nhập tin nhắn của bạn...">
                <button onclick="sendMessage()">
                    <span>Gửi</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
        <script>
            const chatContainer = document.getElementById('chat-container');
            const messageInput = document.getElementById('message-input');
            const typingIndicator = document.querySelector('.typing-indicator');
            const statusIndicator = document.getElementById('status');
            const sessionId = Date.now().toString();

            // Kiểm tra trạng thái kết nối
            function checkConnectionStatus() {
                fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: 'ping', sessionId: 'connection-test' })
                })
                .then(() => {
                    statusIndicator.textContent = 'Online';
                    statusIndicator.className = 'status-online';
                })
                .catch(() => {
                    statusIndicator.textContent = 'Offline';
                    statusIndicator.className = 'status-offline';
                });
            }

            // Kiểm tra kết nối ban đầu và thiết lập interval
            checkConnectionStatus();
            setInterval(checkConnectionStatus, 30000); // Kiểm tra mỗi 30 giây

            // Thêm event listener cho trạng thái online/offline
            window.addEventListener('online', () => {
                checkConnectionStatus();
            });

            window.addEventListener('offline', () => {
                statusIndicator.textContent = 'Offline';
                statusIndicator.className = 'status-offline';
            });

            // Theme handling
            function toggleTheme() {
                const body = document.body;
                const themeIcon = document.getElementById('theme-icon');
                const themeText = document.getElementById('theme-text');
                const currentTheme = body.getAttribute('data-theme');

                if (currentTheme === 'dark') {
                    body.removeAttribute('data-theme');
                    themeIcon.textContent = '🌙';
                    themeText.textContent = 'Dark Mode';
                    localStorage.setItem('theme', 'light');
                } else {
                    body.setAttribute('data-theme', 'dark');
                    themeIcon.textContent = '☀️';
                    themeText.textContent = 'Light Mode';
                    localStorage.setItem('theme', 'dark');
                }
            }

            // Load saved theme
            function loadTheme() {
                const savedTheme = localStorage.getItem('theme');
                const themeIcon = document.getElementById('theme-icon');
                const themeText = document.getElementById('theme-text');

                if (savedTheme === 'dark') {
                    document.body.setAttribute('data-theme', 'dark');
                    themeIcon.textContent = '☀️';
                    themeText.textContent = 'Light Mode';
                }
            }

            function formatTime(timestamp) {
                const date = new Date(timestamp);
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHours / 24);

                if (diffMins < 1) {
                    return 'Vừa xong';
                } else if (diffMins < 60) {
                    return \`\${diffMins} phút trước\`;
                } else if (diffHours < 24) {
                    return \`\${diffHours} giờ trước\`;
                } else if (diffDays === 1) {
                    return 'Hôm qua';
                } else if (diffDays < 7) {
                    return \`\${diffDays} ngày trước\`;
                } else {
                    return date.toLocaleDateString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }

            function updateMessageTimes() {
                const messageInfos = document.querySelectorAll('.message-info .time');
                messageInfos.forEach(timeSpan => {
                    const timestamp = timeSpan.getAttribute('data-timestamp');
                    timeSpan.textContent = formatTime(timestamp);
                });
            }

            function addMessage(message, isUser, timestamp, intent = '', confidence = 0, isGeminiResponse = false) {
                const messageDiv = document.createElement('div');
                messageDiv.className = \`message \${isUser ? 'user-message' : 'bot-message'}\`;
                
                const messageContent = document.createElement('div');
                messageContent.className = 'message-content';
                messageContent.textContent = message;
                
                const messageInfo = document.createElement('div');
                messageInfo.className = 'message-info';
                
                const timeSpan = document.createElement('span');
                timeSpan.className = 'time';
                timeSpan.setAttribute('data-timestamp', timestamp);
                timeSpan.textContent = formatTime(timestamp);
                messageInfo.appendChild(timeSpan);

                if (!isUser) {
                    const sourceSpan = document.createElement('span');
                    sourceSpan.className = \`source-indicator \${isGeminiResponse ? 'source-gemini' : 'source-intent'}\`;
                    sourceSpan.textContent = isGeminiResponse ? 'Gemini' : \`\${intent} (\${(confidence * 100).toFixed(1)}%)\`;
                    messageInfo.appendChild(sourceSpan);
                }
                
                messageDiv.appendChild(messageContent);
                messageDiv.appendChild(messageInfo);
                chatContainer.appendChild(messageDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            function showTypingIndicator() {
                typingIndicator.style.display = 'block';
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            function hideTypingIndicator() {
                typingIndicator.style.display = 'none';
            }

            async function sendMessage() {
                const message = messageInput.value.trim();
                if (!message) return;

                const timestamp = new Date().toISOString();
                addMessage(message, true, timestamp);
                messageInput.value = '';
                showTypingIndicator();

                try {
                    const apiUrl = '/api/chat';
                    console.log('Đang gọi API tại:', apiUrl);

                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ message, sessionId })
                    });

                    const data = await response.json();
                    hideTypingIndicator();
                    
                    if (data.error) {
                        addMessage('Xin lỗi, có lỗi xảy ra: ' + data.error, false, new Date().toISOString());
                    } else {
                        addMessage(
                            data.response, 
                            false, 
                            new Date().toISOString(),
                            data.intent,
                            data.confidence,
                            data.isGeminiResponse
                        );
                    }
                } catch (error) {
                    hideTypingIndicator();
                    addMessage('Xin lỗi, không thể kết nối với server: ' + error.message, false, new Date().toISOString());
                    console.error('Lỗi kết nối:', error);
                }
            }

            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });

            async function loadChatHistory() {
                try {
                    const apiUrl = '/api/history/' + sessionId;
                    console.log('Đang tải lịch sử từ:', apiUrl);

                    const response = await fetch(apiUrl);
                    const history = await response.json();
                    history.forEach(item => {
                        if (item.type === 'user') {
                            addMessage(item.message, true, item.timestamp);
                        } else {
                            addMessage(
                                item.message, 
                                false, 
                                item.timestamp,
                                item.intent,
                                item.confidence,
                                item.isGeminiResponse
                            );
                        }
                    });
                } catch (error) {
                    console.error('Không thể tải lịch sử chat:', error);
                }
            }

            window.onload = () => {
                loadTheme();
                const welcomeMessage = "Xin chào! Tôi là AI Chatbot được tích hợp với Gemini. Tôi có thể giúp gì cho bạn?";
                addMessage(welcomeMessage, false, new Date().toISOString(), 'greeting', 1, false);
                loadChatHistory();
            };

            // Thêm interval để cập nhật thời gian
            setInterval(updateMessageTimes, 60000); // Cập nhật mỗi phút
        </script>
    </body>
    </html>
    `;
    res.send(htmlTemplate);
});

// Khởi động server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
    initialize();
});
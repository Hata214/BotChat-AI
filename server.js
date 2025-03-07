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

// API endpoint để nhận tin nhắn và trả lời
app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Vui lòng nhập tin nhắn' });
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
        if (isGeminiAvailable && (confidence < CONFIDENCE_THRESHOLD || message.length > MESSAGE_LENGTH_THRESHOLD)) {
            try {
                if (!geminiChats.has(sessionId)) {
                    geminiChats.set(sessionId, await initializeGeminiChat());
                }
                const geminiChat = geminiChats.get(sessionId);
                response = await getGeminiResponse(geminiChat, message);
                useGemini = true;
            } catch (error) {
                console.error('Lỗi Gemini, fallback về model local:', error);
                const responses = data.intents[intentIndex].responses;
                response = responses[Math.floor(Math.random() * responses.length)];
            }
        } else {
            const responses = data.intents[intentIndex].responses;
            response = responses[Math.floor(Math.random() * responses.length)];
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
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
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
                --message-bot-bg: #ffffff;
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
                --message-bot-bg: #404040;
                --message-bot-color: #ffffff;
                --input-border: #404040;
                --header-bg: #404040;
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
            }

            .container {
                max-width: 1000px;
                margin: 20px auto;
                background: var(--container-bg);
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                height: calc(100vh - 40px);
                display: flex;
                flex-direction: column;
            }

            .header {
                padding: 20px;
                background: var(--header-bg);
                color: var(--header-color);
                border-radius: 10px 10px 0 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .header-controls {
                display: flex;
                align-items: center;
                gap: 15px;
            }

            .theme-toggle {
                background: none;
                border: none;
                color: var(--header-color);
                cursor: pointer;
                padding: 5px;
                display: flex;
                align-items: center;
                font-size: 14px;
                gap: 5px;
            }

            .theme-toggle:hover {
                opacity: 0.8;
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
            }

            .message {
                margin-bottom: 15px;
                max-width: 80%;
                display: flex;
                flex-direction: column;
            }

            .message-content {
                padding: 12px 16px;
                border-radius: 15px;
                font-size: 15px;
                line-height: 1.4;
            }

            .user-message {
                margin-left: auto;
            }

            .user-message .message-content {
                background: var(--message-user-bg);
                color: var(--message-user-color);
                border-bottom-right-radius: 5px;
            }

            .bot-message {
                margin-right: auto;
            }

            .bot-message .message-content {
                background: var(--message-bot-bg);
                color: var(--message-bot-color);
                border-bottom-left-radius: 5px;
            }

            .message-info {
                font-size: 12px;
                color: var(--secondary-text);
                margin-top: 5px;
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .source-indicator {
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: 500;
            }

            .source-intent {
                background: #e3f2fd;
                color: #1976d2;
            }

            .source-gemini {
                background: #f3e5f5;
                color: #7b1fa2;
            }

            .user-message .message-info {
                text-align: right;
                justify-content: flex-end;
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
                padding: 12px;
                border: 1px solid var(--input-border);
                border-radius: 25px;
                font-size: 15px;
                outline: none;
                transition: border-color 0.3s;
                background: var(--container-bg);
                color: var(--text-color);
            }

            #message-input:focus {
                border-color: var(--primary-color);
            }

            button {
                padding: 12px 24px;
                background: var(--primary-color);
                color: #ffffff;
                border: none;
                border-radius: 25px;
                cursor: pointer;
                font-size: 15px;
                transition: background 0.3s;
            }

            button:hover {
                background: var(--primary-dark);
            }

            .typing-indicator {
                display: none;
                padding: 12px 16px;
                background: var(--typing-bg);
                border-radius: 15px;
                color: var(--text-color);
                font-size: 14px;
                margin-bottom: 15px;
                width: fit-content;
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
            }

            /* Custom Scrollbar */
            ::-webkit-scrollbar {
                width: 8px;
            }

            ::-webkit-scrollbar-track {
                background: var(--bg-color);
            }

            ::-webkit-scrollbar-thumb {
                background: var(--primary-color);
                border-radius: 4px;
            }

            ::-webkit-scrollbar-thumb:hover {
                background: var(--primary-dark);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>AI Chatbot with Gemini</h1>
                <div class="header-controls">
                    <span id="status">Online</span>
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
                <button onclick="sendMessage()">Gửi</button>
            </div>
        </div>
        <script>
            const chatContainer = document.getElementById('chat-container');
            const messageInput = document.getElementById('message-input');
            const typingIndicator = document.querySelector('.typing-indicator');
            const sessionId = Date.now().toString();

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
                return date.toLocaleTimeString('vi-VN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
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
        </script>
    </body>
    </html>
    `;
    res.send(htmlTemplate);
});

// Khởi động server
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // Thay đổi từ 0.0.0.0 sang 127.0.0.1

app.listen(PORT, HOST, () => {
    console.log(`Server đang chạy tại http://${HOST}:${PORT}`);
    console.log(`Truy cập local: http://localhost:${PORT}`);
    console.log(`Truy cập LAN: http://${require('os').networkInterfaces()['Wi-Fi']?.[1]?.address || 'Không tìm thấy'}:${PORT}`);
    initialize();
});
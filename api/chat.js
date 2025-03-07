const tf = require('@tensorflow/tfjs');
const { trainModel, textToVector } = require('../model');
const { initializeGeminiChat, getGeminiResponse } = require('../gemini');
const data = require('../data');
require('dotenv').config();

// Cấu hình từ .env
const MAX_HISTORY_LENGTH = parseInt(process.env.MAX_HISTORY_LENGTH) || 50;
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7;
const MESSAGE_LENGTH_THRESHOLD = parseInt(process.env.MESSAGE_LENGTH_THRESHOLD) || 50;

let model;
let vocabulary;
let chatHistory = new Map();
let geminiChats = new Map();
let isGeminiAvailable = false;

// Khởi tạo model và kiểm tra Gemini
async function initialize() {
    if (!model || !vocabulary) {
        try {
            const result = await trainModel();
            model = result.model;
            vocabulary = result.vocabulary;
            console.log('Model đã được training xong!');

            try {
                const testChat = await initializeGeminiChat();
                const testResponse = await getGeminiResponse(testChat, "test");
                if (testResponse) {
                    isGeminiAvailable = true;
                    console.log('Gemini API đã sẵn sàng!');
                }
            } catch (error) {
                console.log('Không thể kết nối với Gemini API:', error.message);
            }
        } catch (error) {
            console.error('Lỗi khởi tạo:', error);
        }
    }
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, sessionId } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Vui lòng nhập tin nhắn' });
    }

    try {
        await initialize();

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
}; 
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Khởi tạo Gemini API với cấu hình từ .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cấu hình cho model
const modelConfig = {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
    baseUrl: process.env.API_URL,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
};

// Khởi tạo model và chat
async function initializeGeminiChat() {
    try {
        // Kiểm tra API key
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('API key không hợp lệ hoặc chưa được cấu hình');
        }

        const model = genAI.getGenerativeModel({
            model: modelConfig.model,
            generationConfig: {
                temperature: modelConfig.temperature,
                topK: modelConfig.topK,
                topP: modelConfig.topP,
                maxOutputTokens: modelConfig.maxOutputTokens
            }
        });

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: 'Xin chào, bạn có thể nói tiếng Việt không?' }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Vâng, tôi có thể nói tiếng Việt rất tốt. Tôi là trợ lý AI, tôi sẽ cố gắng giúp đỡ bạn một cách tốt nhất.' }]
                }
            ]
        });

        return chat;
    } catch (error) {
        console.error('Lỗi khởi tạo Gemini chat:', error);
        throw error;
    }
}

// Hàm format response từ Gemini
function formatGeminiResponse(text) {
    // Loại bỏ các dấu * thừa
    text = text.replace(/\*{2,}/g, '');
    // Thêm xuống dòng cho các phần chính
    text = text.replace(/:/g, ':\n');
    // Chuẩn hóa khoảng trắng
    text = text.replace(/\s+/g, ' ').trim();
    // Thêm bullet points cho các mục
    text = text.replace(/(\d+\.|•)/g, '\n•');
    return text;
}

// Hàm gửi tin nhắn đến Gemini và nhận phản hồi
async function getGeminiResponse(chat, message) {
    try {
        const result = await chat.sendMessage([
            {
                text: message
            }
        ]);
        const response = await result.response;
        return formatGeminiResponse(response.text());
    } catch (error) {
        console.error('Lỗi khi gọi Gemini API:', error);
        throw error;
    }
}

module.exports = {
    initializeGeminiChat,
    getGeminiResponse
}; 
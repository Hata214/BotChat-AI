const trainingData = {
    intents: [
        {
            tag: "greeting",
            patterns: [
                "Xin chào",
                "Hi",
                "Hey",
                "Chào bạn",
                "Hello",
                "Chào buổi sáng",
                "Chào buổi tối",
                "Chào buổi chiều",
                "Có ai ở đây không",
                "Bạn còn thức không"
            ],
            responses: [
                "Xin chào! Tôi có thể giúp gì cho bạn?",
                "Chào bạn! Rất vui được gặp bạn",
                "Hi! Bạn cần giúp đỡ gì không?",
                "Chào bạn! Tôi là trợ lý AI, tôi có thể giúp gì cho bạn?"
            ]
        },
        {
            tag: "goodbye",
            patterns: [
                "Tạm biệt",
                "Bye",
                "Hẹn gặp lại",
                "Goodbye",
                "Chào tạm biệt",
                "Tôi đi đây",
                "Hẹn gặp lại sau",
                "Tạm biệt nhé"
            ],
            responses: [
                "Tạm biệt bạn!",
                "Hẹn gặp lại bạn sau!",
                "Chúc bạn một ngày tốt lành!",
                "Tạm biệt! Hãy quay lại khi cần giúp đỡ nhé!"
            ]
        },
        {
            tag: "thanks",
            patterns: [
                "Cảm ơn",
                "Thank you",
                "Thanks",
                "Cám ơn bạn nhiều",
                "Cảm ơn rất nhiều",
                "Cảm ơn vì đã giúp đỡ",
                "Bạn thật tuyệt vời",
                "Giúp đỡ của bạn rất có ích"
            ],
            responses: [
                "Không có gì!",
                "Rất vui được giúp bạn!",
                "Đó là nhiệm vụ của tôi!",
                "Rất vui vì đã giúp được bạn!",
                "Không có chi! Hãy hỏi tôi bất cứ khi nào bạn cần nhé!"
            ]
        },
        {
            tag: "help",
            patterns: [
                "Giúp tôi",
                "Cần giúp đỡ",
                "Bạn giúp được gì",
                "Làm thế nào để",
                "Hướng dẫn tôi",
                "Tôi cần trợ giúp",
                "Bạn có thể làm gì",
                "Chức năng của bạn là gì"
            ],
            responses: [
                "Tôi có thể giúp bạn với các câu hỏi thông thường",
                "Hãy cho tôi biết bạn cần giúp đỡ về vấn đề gì",
                "Tôi sẽ cố gắng hết sức để giúp bạn",
                "Tôi có thể trả lời câu hỏi, đưa ra gợi ý và hỗ trợ bạn trong nhiều vấn đề"
            ]
        },
        {
            tag: "weather",
            patterns: [
                "Thời tiết hôm nay",
                "Thời tiết thế nào",
                "Hôm nay có mưa không",
                "Dự báo thời tiết",
                "Nhiệt độ hôm nay",
                "Thời tiết ngày mai"
            ],
            responses: [
                "Xin lỗi, hiện tại tôi chưa có khả năng kiểm tra thời tiết. Bạn có thể xem dự báo thời tiết trên các trang web chuyên dụng.",
                "Tôi không thể truy cập thông tin thời tiết trực tiếp. Bạn có thể tham khảo các ứng dụng thời tiết để biết thông tin chính xác."
            ]
        },
        {
            tag: "mood",
            patterns: [
                "Bạn khỏe không",
                "Hôm nay thế nào",
                "Bạn cảm thấy thế nào",
                "Tâm trạng của bạn",
                "Bạn có vui không"
            ],
            responses: [
                "Tôi là AI nên không có cảm xúc thực sự, nhưng tôi luôn sẵn sàng giúp đỡ bạn!",
                "Cảm ơn bạn đã quan tâm! Tôi là chatbot nên không có cảm xúc, nhưng tôi luôn sẵn sàng hỗ trợ bạn.",
                "Tôi hoạt động tốt và luôn sẵn sàng trò chuyện với bạn!"
            ]
        },
        {
            tag: "identity",
            patterns: [
                "Bạn là ai",
                "Bạn tên gì",
                "Tên của bạn là gì",
                "Bạn là bot à",
                "Có phải bạn là AI",
                "Bạn là người thật không",
                "Ai tạo ra bạn",
                "Bạn do ai tạo ra",
                "Ai là người tạo ra bạn",
                "Người tạo ra bạn là ai",
                "Bạn thuộc về ai"
            ],
            responses: [
                "Tôi là chatbot AI được Hata214 tạo ra dựa vào API của Gemini. Tôi được tạo ra để trò chuyện và giúp đỡ mọi người.",
                "Tôi là trợ lý ảo được Hata214 phát triển sử dụng API của Gemini. Tôi luôn sẵn sàng hỗ trợ bạn!",
                "Hata214 là người tạo ra tôi, sử dụng API của Gemini. Tôi là một AI chatbot, luôn sẵn sàng trò chuyện và giúp đỡ bạn!"
            ]
        },
        {
            tag: "capabilities",
            patterns: [
                "Bạn có thể làm những gì",
                "Khả năng của bạn",
                "Bạn giỏi việc gì",
                "Bạn biết những gì",
                "Chức năng của bạn"
            ],
            responses: [
                "Tôi có thể trò chuyện, trả lời câu hỏi cơ bản, và giúp bạn với nhiều vấn đề khác nhau.",
                "Tôi được training để có thể trò chuyện, hiểu ý định của bạn và đưa ra các phản hồi phù hợp.",
                "Tôi có thể giúp bạn với việc trò chuyện, trả lời câu hỏi và đưa ra gợi ý hữu ích."
            ]
        }
    ]
};

module.exports = trainingData; 
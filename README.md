# TensowBox AI Chatbot

![TensowBox Logo](./assets/logo.png)

> 🤖 A smart chatbot that combines local TensorFlow.js processing with Google's Gemini API for enhanced natural language understanding.

## English Description
An intelligent chatbot built with Node.js that combines TensorFlow.js for local processing and Google's Gemini API for advanced natural language understanding. The chatbot features a responsive interface with dark mode support and seamless switching between local and cloud-based processing.

### Features
- Dual processing capabilities (Local TensorFlow.js model & Google Gemini API)
- Intelligent conversation handling in both English and Vietnamese
- Real-time connection status indicator (Online/Offline)
- Dark/Light mode theme support with persistent settings
- Configurable parameters through environment variables
- Real-time chat interface with typing indicators
- Message source tracking (Local/Gemini)
- Automatic model selection based on query complexity

### Setup
1. Clone the repository:
```bash
git clone https://github.com/yourusername/tensowbox.git
cd tensowbox
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file with required configurations:
```env
# Required API Keys
GEMINI_API_KEY=your_api_key_here
GEMINI_API_VERSION=v1beta
GEMINI_MODEL=gemini-2.0-flash

# Server Settings
PORT=3000
NODE_ENV=development

# Application Configuration
MAX_HISTORY_LENGTH=50
CONFIDENCE_THRESHOLD=0.7
MESSAGE_LENGTH_THRESHOLD=50

# API URLs
BASE_URL=http://localhost:3000
API_URL=https://generativelanguage.googleapis.com
```

4. Start the development server:
```bash
npm run dev
```

Or start in production mode:
```bash
npm start
```

### Deployment
The application can be deployed to any Node.js hosting platform. Make sure to:
1. Set up environment variables
2. Configure proper security settings
3. Use process manager (e.g., PM2) in production
4. Set up SSL for HTTPS

### Usage Guide
1. **Connection Status**:
   - Green indicator: Server is online and ready
   - Red indicator: Connection lost or server offline
   - Auto-updates every 30 seconds

2. **Chat Interface**:
   - Type messages in the input field
   - Press Enter or click Send button
   - Watch typing indicator for bot response
   - Source indicator shows which model processed the response

3. **Model Selection**:
   - Simple queries: Handled by local TensorFlow model
   - Complex queries: Processed by Gemini API
   - Automatic switching based on query complexity

4. **Theme Toggle**:
   - Click theme button to switch between light/dark mode
   - Setting persists across sessions

## Mô tả Tiếng Việt
Chatbot thông minh được xây dựng bằng Node.js, kết hợp TensorFlow.js cho xử lý cục bộ và API Gemini của Google cho khả năng hiểu ngôn ngữ tự nhiên nâng cao. Chatbot có giao diện responsive với hỗ trợ chế độ tối và chuyển đổi mượt mà giữa xử lý cục bộ và đám mây.

### Tính năng
- Khả năng xử lý kép (Model TensorFlow.js cục bộ & API Google Gemini)
- Xử lý hội thoại thông minh bằng cả tiếng Anh và tiếng Việt
- Chỉ báo trạng thái kết nối thời gian thực (Online/Offline)
- Hỗ trợ giao diện sáng/tối với lưu trữ cài đặt
- Tham số có thể cấu hình thông qua biến môi trường
- Giao diện chat thời gian thực với chỉ báo đang nhập
- Theo dõi nguồn tin nhắn (Local/Gemini)
- Tự động chọn model dựa trên độ phức tạp của câu hỏi

### Cài đặt
1. Clone repository
2. Cài đặt dependencies:
```bash
npm install
```
3. Tạo file `.env` với các cấu hình cần thiết:
```env
GEMINI_API_KEY=your_api_key_here
GEMINI_API_VERSION=v1beta
GEMINI_MODEL=gemini-2.0-flash
PORT=3000
NODE_ENV=development
MAX_HISTORY_LENGTH=50
CONFIDENCE_THRESHOLD=0.7
MESSAGE_LENGTH_THRESHOLD=50
```
4. Khởi động server:
```bash
node server.js
```

### Hướng dẫn sử dụng
1. **Trạng thái kết nối**:
   - Chỉ báo xanh: Server online và sẵn sàng
   - Chỉ báo đỏ: Mất kết nối hoặc server offline
   - Tự động cập nhật mỗi 30 giây

2. **Giao diện chat**:
   - Nhập tin nhắn vào ô input
   - Nhấn Enter hoặc nút Gửi
   - Theo dõi chỉ báo đang nhập của bot
   - Chỉ báo nguồn cho biết model nào xử lý phản hồi

3. **Lựa chọn model**:
   - Câu hỏi đơn giản: Xử lý bởi model TensorFlow cục bộ
   - Câu hỏi phức tạp: Xử lý bởi API Gemini
   - Tự động chuyển đổi dựa trên độ phức tạp của câu hỏi

4. **Chuyển đổi giao diện**:
   - Click nút theme để chuyển đổi giữa chế độ sáng/tối
   - Cài đặt được lưu giữ qua các phiên

### Xử lý lỗi thường gặp
1. **Khi hiển thị "Offline"**:
   - Kiểm tra kết nối internet
   - Đợi hệ thống tự kết nối lại
   - Refresh trang nếu cần

2. **Khi hiển thị "Hệ thống đang khởi động"**:
   - Đợi 5-10 giây để model khởi tạo
   - Thử gửi tin nhắn lại

3. **Khi gặp lỗi Gemini API**:
   - Bot sẽ tự động chuyển sang model local
   - Thử lại sau vài giây

### Lưu ý
- Trạng thái kết nối được cập nhật tự động mỗi 30 giây
- Tin nhắn được lưu trong session, sẽ mất khi refresh trang
- Dark mode setting được lưu trong localStorage
- Bot tự động chọn model phù hợp dựa trên độ phức tạp của câu hỏi 
# API Testing Editor

Một công cụ mạnh mẽ và hiện đại để test API, chạy test suites và truy vấn database. Được xây dựng với Tauri (Rust + React), mang lại hiệu suất cao và trải nghiệm người dùng mượt mà.

## ✨ Tính năng nổi bật

### 🚀 API Testing
- Xây dựng và gửi HTTP requests với đầy đủ các phương thức (GET, POST, PUT, DELETE, PATCH)
- Hỗ trợ custom headers, query parameters, và request body
- Xem response với syntax highlighting và format JSON tự động
- Export response ra file
- Generate cURL commands

### 🔍 API Scanner
- **Tự động phát hiện API endpoints** từ source code của project
- Hỗ trợ scan các framework:
  - ✅ Laravel (PHP)
  - 🔜 NestJS (Node.js)
  - 🔜 Rails (Ruby)
  - 🔜 Express (Node.js)
- Phân tích routes, controllers, parameters, authentication và authorization
- Tự động generate example requests

### 🧪 Test Suite Runner
- Tạo và quản lý các bộ test suite
- Chạy hàng loạt API tests
- Xem kết quả test chi tiết

### 💾 Database Queries
- Thực thi SQL queries trực tiếp từ ứng dụng
- Xem kết quả dưới dạng bảng
- Hỗ trợ nhiều loại database

### 📁 Project Management
- Quản lý nhiều projects cùng lúc
- Tổ chức endpoints theo project
- Mở project folder và scan APIs tự động

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 19, TypeScript, Tailwind CSS, Monaco Editor
- **Backend**: Rust, Tauri 2.0
- **Database**: SQLite (local storage)
- **State Management**: TanStack Query

## 📋 Yêu cầu hệ thống

### Prerequisites

1. **Install System Dependencies**

   Tauri requires GTK and WebKit dependencies on Linux. Run:

   ```bash
   ./install-deps-ubuntu.sh
   ```

   Or manually install:

   ```bash
   sudo apt-get update
   sudo apt-get install -y \
       libwebkit2gtk-4.1-dev \
       build-essential \
       curl \
       wget \
       libssl-dev \
       libgtk-3-dev \
       libayatana-appindicator3-dev \
       librsvg2-dev \
       libgdk-pixbuf2.0-dev \
       libpango1.0-dev \
       libcairo2-dev \
       libatk1.0-dev
   ```

2. **Install Node.js Dependencies**

   ```bash
   npm install
   ```

3. **Increase File Watch Limit (Optional but Recommended)**

   If you encounter "OS file watch limit reached" error:

   ```bash
   sudo sysctl -w fs.inotify.max_user_watches=524288
   ```

   To make it permanent, add to `/etc/sysctl.conf`:

   ```
   fs.inotify.max_user_watches=524288
   ```

## 🚀 Bắt đầu sử dụng

### Cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd look-api
```

2. Cài đặt dependencies (xem phần Prerequisites ở trên)

3. Cài đặt Node.js dependencies:
```bash
npm install
```

### Chạy ứng dụng

#### Option 1: Sử dụng npm script

```bash
npm run tauri dev
```

#### Option 2: Sử dụng helper script

```bash
./run-dev.sh
```

## 📖 Hướng dẫn sử dụng

### Quy trình làm việc

1. **Mở Project**: Click "Open Folder" để chọn thư mục project của bạn
2. **Scan APIs**: Click "Scan APIs" để tự động phát hiện các API endpoints từ source code
3. **Test API**: Chọn một endpoint từ sidebar và bắt đầu test
4. **Chạy Test Suite**: Tạo test suite và chạy hàng loạt tests
5. **Query Database**: Sử dụng Database panel để thực thi SQL queries

### What Happens When You Run `npm run tauri dev`

1. **Vite Dev Server** starts on `http://localhost:1420`
2. **Rust Compilation** begins (first time may take a few minutes)
3. **Tauri App Window** opens automatically when compilation completes

## 🔧 Troubleshooting

### Error: "OS file watch limit reached"

Increase the file watch limit as described above.

### Error: "system library `gdk-pixbuf-2.0` required by crate `gdk-pixbuf-sys` was not found"

Install system dependencies using `./install-deps-ubuntu.sh`

### Error: "cargo run could not determine which binary to run"

This should be fixed by setting `default-run = "tauri-app"` in `Cargo.toml`.

### Vite server runs but app window doesn't open

Check the terminal output for Rust compilation errors. The app window only opens after successful compilation.

## 💻 Development Workflow

- **Frontend changes**: Hot reloaded automatically by Vite
- **Rust/Backend changes**: Requires recompilation (automatic on file save)
- **Stop the server**: Press `Ctrl+C` in the terminal

## 📝 License

[Thêm license của bạn ở đây]

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng tạo issue hoặc pull request.

---

**Made with ❤️ using Tauri + React**

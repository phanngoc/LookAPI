# Quick Start Guide

## Khởi chạy ứng dụng

```bash
# Cài đặt dependencies
npm install

# Chạy ở chế độ development
npm run start:dev

# Hoặc build và chạy production
npm run build
npm run start:prod
```

## Truy cập API

- **API Base URL**: http://localhost:3000/api
- **Swagger Documentation**: http://localhost:3000/api/docs

## Test Flow

### 1. Đăng ký tài khoản
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

### 2. Đăng nhập
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Response sẽ chứa accessToken
```

### 3. Xem danh sách sản phẩm
```bash
GET /api/products?page=1&limit=10
```

### 4. Tìm kiếm sản phẩm
```bash
GET /api/products/search?q=iphone
```

### 5. Thêm vào giỏ hàng (cần token)
```bash
POST /api/cart/items
Authorization: Bearer <accessToken>
{
  "productId": 1,
  "quantity": 2
}
```

### 6. Xem giỏ hàng (cần token)
```bash
GET /api/cart
Authorization: Bearer <accessToken>
```

### 7. Checkout (cần token)
```bash
POST /api/orders/checkout
Authorization: Bearer <accessToken>
{
  "shippingAddress": "123 Main St, City, Country"
}
```

### 8. Xem lịch sử đơn hàng (cần token)
```bash
GET /api/orders
Authorization: Bearer <accessToken>
```

## Database

- Database file: `ecommerce.db` (SQLite)
- Database sẽ tự động được tạo và seed dữ liệu mẫu khi khởi động lần đầu
- Dữ liệu seed bao gồm:
  - 5 categories (Electronics, Clothing, Books, Home & Garden, Sports)
  - 12 products với giá và stock mẫu

## Lưu ý

- Tất cả endpoints trong `/api/cart` và `/api/orders` yêu cầu authentication
- Sử dụng JWT token từ response của `/api/auth/login` hoặc `/api/auth/register`
- Token được gửi trong header: `Authorization: Bearer <token>`

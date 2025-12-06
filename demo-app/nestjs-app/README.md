# Ecommerce API

Ứng dụng Ecommerce API được xây dựng với NestJS, cung cấp các tính năng:

- **Authentication**: Đăng ký, đăng nhập, đăng xuất với JWT
- **Products**: Danh sách sản phẩm, tìm kiếm, chi tiết sản phẩm
- **Cart**: Thêm vào giỏ hàng, cập nhật, xóa sản phẩm
- **Orders**: Checkout, lịch sử đơn hàng

## Cài đặt

```bash
npm install
```

## Chạy ứng dụng

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## API Documentation

Sau khi chạy ứng dụng, truy cập Swagger documentation tại:
http://localhost:3000/api/docs

## Cấu trúc dự án

```
src/
├── auth/           # Authentication module
├── users/          # Users module
├── products/       # Products module
├── cart/           # Cart module
├── orders/         # Orders module
├── common/         # Common filters, interceptors
└── database/       # Database configuration và seed
```

## Database

Ứng dụng sử dụng SQLite với TypeORM. Database file: `ecommerce.db`

Database sẽ tự động được seed với dữ liệu mẫu khi khởi động lần đầu.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/profile` - Lấy thông tin user (protected)

### Products
- `GET /api/products` - Danh sách sản phẩm (pagination, filtering)
- `GET /api/products/search?q=...` - Tìm kiếm sản phẩm
- `GET /api/products/:id` - Chi tiết sản phẩm
- `GET /api/products/categories` - Danh sách categories

### Cart
- `GET /api/cart` - Lấy giỏ hàng (protected)
- `POST /api/cart/items` - Thêm sản phẩm vào giỏ hàng (protected)
- `PATCH /api/cart/items/:id` - Cập nhật số lượng (protected)
- `DELETE /api/cart/items/:id` - Xóa sản phẩm (protected)
- `DELETE /api/cart` - Xóa toàn bộ giỏ hàng (protected)

### Orders
- `POST /api/orders/checkout` - Checkout từ giỏ hàng (protected)
- `GET /api/orders` - Lịch sử đơn hàng (protected)
- `GET /api/orders/:id` - Chi tiết đơn hàng (protected)

## Business Logic

- **Inventory Management**: Kiểm tra stock trước khi add to cart và checkout
- **Price Snapshot**: Lưu giá tại thời điểm order để đảm bảo tính nhất quán
- **Transaction**: Sử dụng database transaction cho checkout để đảm bảo data consistency
- **Cart Validation**: Tự động loại bỏ items khi product hết hàng

## Environment Variables

- `PORT`: Port để chạy server (default: 3000)
- `JWT_SECRET`: Secret key cho JWT (default: 'your-secret-key-change-in-production')

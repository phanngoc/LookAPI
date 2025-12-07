# Swagger/OpenAPI Documentation

File Swagger đã được tạo cho hệ thống Ecommerce API với đầy đủ các endpoints và schemas.

## Files

- `swagger.yaml` - OpenAPI specification dạng YAML
- `swagger.json` - OpenAPI specification dạng JSON

## Sử dụng

### 1. Xem trên Swagger UI (tự động)

Khi chạy ứng dụng, Swagger UI đã được tích hợp sẵn tại:
```
http://localhost:3000/api/docs
```

### 2. Import vào Postman

1. Mở Postman
2. Click **Import**
3. Chọn file `swagger.json` hoặc `swagger.json`
4. Tất cả endpoints sẽ được import với đầy đủ examples

### 3. Import vào Insomnia

1. Mở Insomnia
2. Click **Application** → **Preferences** → **Data** → **Import Data**
3. Chọn **OpenAPI 3.0** và chọn file `swagger.json`
4. Tất cả endpoints sẽ được import

### 4. Sử dụng với Swagger Editor

1. Truy cập https://editor.swagger.io/
2. File → Import File
3. Chọn `swagger.yaml` hoặc `swagger.json`
4. Xem và test API trực tiếp trên browser

### 5. Generate Client Code

Sử dụng các tools sau để generate client code:

#### OpenAPI Generator
```bash
# Install
npm install @openapitools/openapi-generator-cli -g

# Generate TypeScript client
openapi-generator-cli generate -i swagger.yaml -g typescript-axios -o ./generated-client

# Generate Python client
openapi-generator-cli generate -i swagger.yaml -g python -o ./generated-client

# Generate JavaScript client
openapi-generator-cli generate -i swagger.yaml -g javascript -o ./generated-client
```

#### Swagger Codegen
```bash
# Generate TypeScript client
swagger-codegen generate -i swagger.yaml -l typescript-axios -o ./generated-client
```

## Cấu trúc Documentation

### Tags
- **auth** - Authentication endpoints (register, login, logout, profile)
- **products** - Products management (list, search, detail, categories)
- **cart** - Shopping cart management (add, update, remove, clear)
- **orders** - Orders management (checkout, history, detail)

### Security
Tất cả endpoints trong `/cart` và `/orders` yêu cầu JWT authentication:
- Header: `Authorization: Bearer <token>`
- Token được lấy từ `/auth/login` hoặc `/auth/register`

### Schemas
- **RegisterDto** - Đăng ký user mới
- **LoginDto** - Đăng nhập
- **AuthResponse** - Response từ login/register
- **Product** - Thông tin sản phẩm
- **Category** - Thông tin category
- **CartItem** - Item trong giỏ hàng
- **CartResponse** - Response giỏ hàng
- **OrderResponse** - Thông tin order
- **ErrorResponse** - Thông báo lỗi

## Examples

Tất cả endpoints đều có examples trong Swagger file để dễ dàng test và hiểu cách sử dụng.

## Validation

Các validation rules:
- Email: phải đúng format email
- Password: tối thiểu 6 ký tự
- Quantity: tối thiểu 1
- Product ID: phải là số nguyên
- Shipping Address: không được để trống

## Response Format

Tất cả responses đều có format:
```json
{
  "success": true,
  "data": { ... }
}
```

Lỗi sẽ có format:
```json
{
  "statusCode": 400,
  "timestamp": "2025-12-06T15:00:00.000Z",
  "path": "/api/endpoint",
  "message": "Error message"
}
```

import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';

export class OrderItemResponseDto {
  @ApiProperty({ example: 1, description: 'ID của order item' })
  id: number;

  @ApiProperty({ example: 1, description: 'ID của sản phẩm' })
  productId: number;

  @ApiProperty({ example: 'Product Name', description: 'Tên sản phẩm' })
  productName: string;

  @ApiProperty({ example: 2, description: 'Số lượng' })
  quantity: number;

  @ApiProperty({ example: 100000, description: 'Giá sản phẩm' })
  price: number;

  @ApiProperty({ example: 200000, description: 'Tổng tiền (price * quantity)' })
  subtotal: number;
}

export class OrderResponseDto {
  @ApiProperty({ example: 'ORD-123456', description: 'ID của đơn hàng' })
  id: string;

  @ApiProperty({ 
    enum: OrderStatus,
    example: OrderStatus.PENDING,
    description: 'Trạng thái đơn hàng',
  })
  status: OrderStatus;

  @ApiProperty({ example: 500000, description: 'Tổng tiền đơn hàng' })
  totalAmount: number;

  @ApiProperty({ example: '123 Main St, City, Country', description: 'Địa chỉ giao hàng' })
  shippingAddress: string;

  @ApiProperty({ 
    type: [OrderItemResponseDto],
    description: 'Danh sách sản phẩm trong đơn hàng',
  })
  items: OrderItemResponseDto[];

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Ngày tạo đơn hàng' })
  createdAt: Date;
}

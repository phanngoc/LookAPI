import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 1, description: 'ID của category' })
  id: number;

  @ApiProperty({ example: 'Electronics', description: 'Tên category' })
  name: string;

  @ApiProperty({ example: 'Electronic products', description: 'Mô tả category', required: false })
  description?: string;
}

export class CartProductResponseDto {
  @ApiProperty({ example: 1, description: 'ID của sản phẩm' })
  id: number;

  @ApiProperty({ example: 'Laptop Dell XPS 15', description: 'Tên sản phẩm' })
  name: string;

  @ApiProperty({ example: 25000000, description: 'Giá sản phẩm' })
  price: number;

  @ApiProperty({ example: 'https://example.com/image.jpg', description: 'URL hình ảnh', required: false })
  imageUrl?: string;

  @ApiProperty({ example: 10, description: 'Số lượng tồn kho' })
  stock: number;

  @ApiProperty({ type: CategoryResponseDto, description: 'Thông tin category' })
  category: CategoryResponseDto;
}

export class CartItemResponseDto {
  @ApiProperty({ example: 1, description: 'ID của cart item' })
  id: number;

  @ApiProperty({ type: CartProductResponseDto, description: 'Thông tin sản phẩm' })
  product: CartProductResponseDto;

  @ApiProperty({ example: 2, description: 'Số lượng sản phẩm trong giỏ hàng' })
  quantity: number;

  @ApiProperty({ example: 50000000, description: 'Tổng tiền (price * quantity)' })
  subtotal: number;
}

export class CartResponseDto {
  @ApiProperty({ 
    type: [CartItemResponseDto],
    description: 'Danh sách sản phẩm trong giỏ hàng',
  })
  items: CartItemResponseDto[];

  @ApiProperty({ example: 50000000, description: 'Tổng tiền của giỏ hàng' })
  total: number;
}




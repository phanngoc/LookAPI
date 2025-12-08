import { IsInt, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ 
    example: 1,
    description: 'ID của sản phẩm',
    required: true,
  })
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @ApiProperty({ 
    example: 1, 
    minimum: 1,
    description: 'Số lượng sản phẩm',
    required: true,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}

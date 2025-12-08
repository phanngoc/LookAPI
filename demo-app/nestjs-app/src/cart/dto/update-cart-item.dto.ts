import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCartItemDto {
  @ApiProperty({ 
    example: 2, 
    minimum: 1,
    description: 'Số lượng mới của sản phẩm',
    required: true,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}

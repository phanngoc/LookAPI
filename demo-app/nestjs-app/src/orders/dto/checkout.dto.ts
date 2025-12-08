import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutDto {
  @ApiProperty({ 
    example: '123 Main St, City, Country',
    description: 'Địa chỉ giao hàng',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  shippingAddress: string;
}

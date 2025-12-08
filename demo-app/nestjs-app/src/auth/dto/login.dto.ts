import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    example: 'user@example.com',
    description: 'Email đăng nhập',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ 
    example: 'password123',
    description: 'Mật khẩu',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

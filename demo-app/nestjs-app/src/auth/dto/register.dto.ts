import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ 
    example: 'user@example.com',
    description: 'Email đăng ký',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ 
    example: 'password123', 
    minLength: 6,
    description: 'Mật khẩu (tối thiểu 6 ký tự)',
    required: true,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ 
    example: 'John Doe',
    description: 'Tên người dùng',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

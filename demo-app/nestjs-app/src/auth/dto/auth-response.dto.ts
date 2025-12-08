import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID của user (UUID)' })
  id: string;

  @ApiProperty({ example: 'user@example.com', description: 'Email của user' })
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'Tên của user' })
  name: string;

  @ApiProperty({ example: 'user', description: 'Vai trò của user' })
  role: string;
}

export class AuthResponseDto {
  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  accessToken: string;

  @ApiProperty({ 
    type: UserResponseDto,
    description: 'Thông tin user',
  })
  user: UserResponseDto;
}

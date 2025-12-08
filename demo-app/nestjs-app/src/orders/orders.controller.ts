import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Checkout từ giỏ hàng' })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({ status: 201, description: 'Tạo đơn hàng thành công', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc giỏ hàng trống' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkout(
    @CurrentUser() user: User,
    @Body() checkoutDto: CheckoutDto,
  ) {
    return this.ordersService.checkout(user.id, checkoutDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy lịch sử đơn hàng' })
  @ApiResponse({ status: 200, description: 'Lấy lịch sử đơn hàng thành công', type: [OrderResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@CurrentUser() user: User) {
    return this.ordersService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết đơn hàng' })
  @ApiParam({ name: 'id', type: 'string', description: 'ID của đơn hàng' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết đơn hàng thành công', type: OrderResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Đơn hàng không tồn tại' })
  async findOne(@CurrentUser() user: User, @Param('id') orderId: string) {
    return this.ordersService.findOne(user.id, orderId);
  }
}

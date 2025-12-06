import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Checkout từ giỏ hàng' })
  async checkout(
    @CurrentUser() user: User,
    @Body() checkoutDto: CheckoutDto,
  ) {
    return this.ordersService.checkout(user.id, checkoutDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy lịch sử đơn hàng' })
  async findAll(@CurrentUser() user: User) {
    return this.ordersService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết đơn hàng' })
  @ApiParam({ name: 'id', type: 'string' })
  async findOne(@CurrentUser() user: User, @Param('id') orderId: string) {
    return this.ordersService.findOne(user.id, orderId);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy giỏ hàng của user' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lấy giỏ hàng thành công',
    type: CartResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Token không hợp lệ hoặc đã hết hạn' })
  async getCart(@CurrentUser() user: User) {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Thêm sản phẩm vào giỏ hàng' })
  @ApiBody({ type: AddToCartDto })
  @ApiResponse({ status: 201, description: 'Thêm sản phẩm vào giỏ hàng thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Sản phẩm không tồn tại' })
  async addToCart(
    @CurrentUser() user: User,
    @Body() addToCartDto: AddToCartDto,
  ) {
    return this.cartService.addToCart(user.id, addToCartDto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Cập nhật số lượng sản phẩm trong giỏ hàng' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID của cart item' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cart item không tồn tại' })
  async updateCartItem(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() updateDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(user.id, itemId, updateDto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Xóa sản phẩm khỏi giỏ hàng' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID của cart item' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cart item không tồn tại' })
  async removeFromCart(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) itemId: number,
  ) {
    return this.cartService.removeFromCart(user.id, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Xóa toàn bộ giỏ hàng' })
  @ApiResponse({ status: 200, description: 'Xóa toàn bộ giỏ hàng thành công' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearCart(@CurrentUser() user: User) {
    return this.cartService.clearCart(user.id);
  }
}

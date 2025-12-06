import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private cartItemsRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async getCart(userId: string) {
    const cartItems = await this.cartItemsRepository.find({
      where: { userId },
      relations: ['product', 'product.category'],
    });

    // Filter out items where product is out of stock
    const validItems = cartItems.filter(
      (item) => item.product.stock >= item.quantity,
    );

    // Remove invalid items
    const invalidItems = cartItems.filter(
      (item) => item.product.stock < item.quantity,
    );
    if (invalidItems.length > 0) {
      await this.cartItemsRepository.remove(invalidItems);
    }

    const total = validItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    return {
      items: validItems.map((item) => ({
        id: item.id,
        product: {
          id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          imageUrl: item.product.imageUrl,
          stock: item.product.stock,
          category: item.product.category,
        },
        quantity: item.quantity,
        subtotal: item.product.price * item.quantity,
      })),
      total,
    };
  }

  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const { productId, quantity } = addToCartDto;

    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stock}`,
      );
    }

    // Check if item already exists in cart
    const existingItem = await this.cartItemsRepository.findOne({
      where: { userId, productId },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.stock < newQuantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${product.stock}, Current in cart: ${existingItem.quantity}`,
        );
      }
      existingItem.quantity = newQuantity;
      return this.cartItemsRepository.save(existingItem);
    }

    const cartItem = this.cartItemsRepository.create({
      userId,
      productId,
      quantity,
    });

    return this.cartItemsRepository.save(cartItem);
  }

  async updateCartItem(
    userId: string,
    itemId: number,
    updateDto: UpdateCartItemDto,
  ) {
    const cartItem = await this.cartItemsRepository.findOne({
      where: { id: itemId, userId },
      relations: ['product'],
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    if (cartItem.product.stock < updateDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${cartItem.product.stock}`,
      );
    }

    cartItem.quantity = updateDto.quantity;
    return this.cartItemsRepository.save(cartItem);
  }

  async removeFromCart(userId: string, itemId: number) {
    const cartItem = await this.cartItemsRepository.findOne({
      where: { id: itemId, userId },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    await this.cartItemsRepository.remove(cartItem);
    return { message: 'Item removed from cart' };
  }

  async clearCart(userId: string) {
    await this.cartItemsRepository.delete({ userId });
    return { message: 'Cart cleared' };
  }
}

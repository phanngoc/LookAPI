import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { CheckoutDto } from './dto/checkout.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(CartItem)
    private cartItemsRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  async checkout(userId: string, checkoutDto: CheckoutDto) {
    // Get cart items
    const cartItems = await this.cartItemsRepository.find({
      where: { userId },
      relations: ['product'],
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Validate stock availability
    for (const cartItem of cartItems) {
      if (cartItem.product.stock < cartItem.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${cartItem.product.name}. Available: ${cartItem.product.stock}, Requested: ${cartItem.quantity}`,
        );
      }
    }

    // Use transaction to ensure data consistency
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Calculate total
      let totalAmount = 0;
      const orderItemsData = cartItems.map((cartItem) => {
        const subtotal = cartItem.product.price * cartItem.quantity;
        totalAmount += subtotal;
        return {
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          price: cartItem.product.price, // Price snapshot
          subtotal,
        };
      });

      // Create order
      const order = queryRunner.manager.create(Order, {
        userId,
        status: OrderStatus.PENDING,
        totalAmount,
        shippingAddress: checkoutDto.shippingAddress,
      });
      const savedOrder = await queryRunner.manager.save(order);

      // Create order items and deduct inventory
      for (const cartItem of cartItems) {
        // Create order item
        const orderItem = queryRunner.manager.create(OrderItem, {
          orderId: savedOrder.id,
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          price: cartItem.product.price,
        });
        await queryRunner.manager.save(orderItem);

        // Deduct inventory
        cartItem.product.stock -= cartItem.quantity;
        await queryRunner.manager.save(cartItem.product);
      }

      // Clear cart
      await queryRunner.manager.delete(CartItem, { userId });

      await queryRunner.commitTransaction();

      // Fetch order with items for response
      const orderWithItems = await this.ordersRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['orderItems', 'orderItems.product'],
      });

      return {
        id: orderWithItems.id,
        status: orderWithItems.status,
        totalAmount: orderWithItems.totalAmount,
        shippingAddress: orderWithItems.shippingAddress,
        items: orderWithItems.orderItems.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
        })),
        createdAt: orderWithItems.createdAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(userId: string) {
    const orders = await this.ordersRepository.find({
      where: { userId },
      relations: ['orderItems', 'orderItems.product'],
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      shippingAddress: order.shippingAddress,
      items: order.orderItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
      })),
      createdAt: order.createdAt,
    }));
  }

  async findOne(userId: string, orderId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId, userId },
      relations: ['orderItems', 'orderItems.product'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      shippingAddress: order.shippingAddress,
      items: order.orderItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { DataSource } from 'typeorm';
import { seedDatabase } from './database/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Seed database
  const dataSource = app.get(DataSource);
  await seedDatabase(dataSource);

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS
  app.enableCors();

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Ecommerce API')
    .setDescription('API documentation cho ứng dụng Ecommerce với đầy đủ các tính năng: Authentication, Products, Cart, và Orders')
    .setVersion('1.0')
    .addTag('auth', 'Xác thực và quản lý người dùng')
    .addTag('products', 'Quản lý sản phẩm và danh mục')
    .addTag('cart', 'Quản lý giỏ hàng')
    .addTag('orders', 'Quản lý đơn hàng')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Nhập JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3000', 'Development server')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();

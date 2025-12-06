import { DataSource } from 'typeorm';
import { Category } from '../products/entities/category.entity';
import { Product } from '../products/entities/product.entity';

export async function seedDatabase(dataSource: DataSource) {
  const categoryRepository = dataSource.getRepository(Category);
  const productRepository = dataSource.getRepository(Product);

  // Check if data already exists
  const existingCategories = await categoryRepository.count();
  if (existingCategories > 0) {
    console.log('Database already seeded');
    return;
  }

  // Create categories
  const categories = [
    { name: 'Electronics', description: 'Electronic devices and gadgets' },
    { name: 'Clothing', description: 'Fashion and apparel' },
    { name: 'Books', description: 'Books and literature' },
    { name: 'Home & Garden', description: 'Home improvement and garden supplies' },
    { name: 'Sports', description: 'Sports equipment and accessories' },
  ];

  const savedCategories = await categoryRepository.save(categories);

  // Create products
  const products = [
    {
      name: 'iPhone 15 Pro',
      description: 'Latest iPhone with advanced features',
      price: 999.99,
      stock: 50,
      categoryId: savedCategories[0].id,
      imageUrl: 'https://example.com/iphone15.jpg',
    },
    {
      name: 'Samsung Galaxy S24',
      description: 'Flagship Android smartphone',
      price: 899.99,
      stock: 40,
      categoryId: savedCategories[0].id,
      imageUrl: 'https://example.com/galaxy-s24.jpg',
    },
    {
      name: 'MacBook Pro 16"',
      description: 'Powerful laptop for professionals',
      price: 2499.99,
      stock: 20,
      categoryId: savedCategories[0].id,
      imageUrl: 'https://example.com/macbook.jpg',
    },
    {
      name: 'Nike Air Max 90',
      description: 'Classic running shoes',
      price: 129.99,
      stock: 100,
      categoryId: savedCategories[1].id,
      imageUrl: 'https://example.com/nike-airmax.jpg',
    },
    {
      name: 'Levi\'s 501 Jeans',
      description: 'Classic fit jeans',
      price: 89.99,
      stock: 75,
      categoryId: savedCategories[1].id,
      imageUrl: 'https://example.com/levis-501.jpg',
    },
    {
      name: 'The Great Gatsby',
      description: 'Classic American novel by F. Scott Fitzgerald',
      price: 12.99,
      stock: 200,
      categoryId: savedCategories[2].id,
      imageUrl: 'https://example.com/gatsby.jpg',
    },
    {
      name: 'Clean Code',
      description: 'A Handbook of Agile Software Craftsmanship',
      price: 45.99,
      stock: 150,
      categoryId: savedCategories[2].id,
      imageUrl: 'https://example.com/cleancode.jpg',
    },
    {
      name: 'Coffee Maker',
      description: 'Programmable coffee maker with timer',
      price: 79.99,
      stock: 60,
      categoryId: savedCategories[3].id,
      imageUrl: 'https://example.com/coffeemaker.jpg',
    },
    {
      name: 'Garden Tool Set',
      description: 'Complete set of gardening tools',
      price: 49.99,
      stock: 80,
      categoryId: savedCategories[3].id,
      imageUrl: 'https://example.com/gardentools.jpg',
    },
    {
      name: 'Yoga Mat',
      description: 'Premium non-slip yoga mat',
      price: 29.99,
      stock: 120,
      categoryId: savedCategories[4].id,
      imageUrl: 'https://example.com/yogamat.jpg',
    },
    {
      name: 'Basketball',
      description: 'Official size basketball',
      price: 24.99,
      stock: 90,
      categoryId: savedCategories[4].id,
      imageUrl: 'https://example.com/basketball.jpg',
    },
    {
      name: 'Wireless Headphones',
      description: 'Noise-cancelling wireless headphones',
      price: 199.99,
      stock: 55,
      categoryId: savedCategories[0].id,
      imageUrl: 'https://example.com/headphones.jpg',
    },
  ];

  await productRepository.save(products);
  console.log('Database seeded successfully');
}

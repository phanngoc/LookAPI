import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách sản phẩm với pagination và filtering' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách sản phẩm thành công' })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm' })
  @ApiQuery({ name: 'q', required: true, description: 'Từ khóa tìm kiếm' })
  @ApiResponse({ status: 200, description: 'Tìm kiếm thành công' })
  async search(@Query('q') searchTerm: string) {
    return this.productsService.search(searchTerm);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh sách categories' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách categories thành công' })
  async getCategories() {
    return this.productsService.findAllCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết sản phẩm' })
  @ApiParam({ name: 'id', type: 'number', description: 'ID của sản phẩm' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết sản phẩm thành công' })
  @ApiResponse({ status: 404, description: 'Sản phẩm không tồn tại' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }
}

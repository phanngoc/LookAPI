import { IsOptional, IsInt, Min, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum SortField {
  NAME = 'name',
  PRICE = 'price',
  CREATED_AT = 'createdAt',
}

export class ProductQueryDto {
  @ApiPropertyOptional({ 
    default: 1, 
    minimum: 1,
    description: 'Số trang',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    default: 10, 
    minimum: 1, 
    maximum: 100,
    description: 'Số lượng sản phẩm mỗi trang',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ 
    enum: SortField, 
    default: SortField.CREATED_AT,
    description: 'Trường để sắp xếp',
    example: SortField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortField)
  sortBy?: SortField = SortField.CREATED_AT;

  @ApiPropertyOptional({ 
    enum: SortOrder, 
    default: SortOrder.DESC,
    description: 'Thứ tự sắp xếp',
    example: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Lọc theo category ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({
    description: 'Tìm kiếm sản phẩm theo tên',
    example: 'laptop',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

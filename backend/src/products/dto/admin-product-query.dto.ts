import { ProductStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ToBoolean } from '../../common/decorators/to-boolean.decorator';
import { Trim } from '../../common/decorators/trim.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ProductSort } from './product-query.dto';

export class AdminProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  /** Category id (admin filters by id, the storefront by slug). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsEnum(ProductSort)
  sort: ProductSort = ProductSort.NEWEST;
}
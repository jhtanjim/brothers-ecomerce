import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ToBoolean } from '../../common/decorators/to-boolean.decorator';
import { Trim } from '../../common/decorators/trim.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MAX_PRICE } from './create-product.dto';

export enum ProductSort {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  POPULAR = 'popular',
  DISCOUNT = 'discount',
}

export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Category slug. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  maxPrice?: number;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  newArrival?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  bestSeller?: boolean;

  /** Only products with this size in stock. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  size?: string;

  /** Only products with this colour in stock. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  material?: string;

  @IsOptional()
  @IsEnum(ProductSort)
  sort: ProductSort = ProductSort.NEWEST;
}

import { ProductStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SLUG_REGEX } from '../../categories/dto/create-category.dto';
import { Trim } from '../../common/decorators/trim.decorator';

/** Decimal(12,2) allows at most 10 integer digits. */
export const MAX_PRICE = 9_999_999_999.99;
export const MAX_STOCK = 1_000_000;
export const SKU_REGEX = /^[A-Z0-9][A-Z0-9._-]*$/;

/** Trims, then uppercases, so "abc-1" and "ABC-1" can never both exist. */
export const NormalizeSku = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  /** Optional. Generated from `name` when omitted. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_REGEX, {
    message: 'slug may contain lowercase letters, numbers and single hyphens only',
  })
  slug?: string;

  @NormalizeSku()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(SKU_REGEX, {
    message: 'sku may contain letters, numbers, dots, underscores and hyphens only',
  })
  sku!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(MAX_PRICE)
  price!: number;

  /** Must be lower than `price`; the service enforces that. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(MAX_PRICE)
  discountPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  lowStockThreshold?: number;

  /** Products cannot be created as ARCHIVED. */
  @IsOptional()
  @IsIn([ProductStatus.ACTIVE, ProductStatus.INACTIVE])
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

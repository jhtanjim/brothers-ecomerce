import {
  IsBoolean,
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
  ValidateIf,
} from 'class-validator';
import { SLUG_REGEX } from '../../categories/dto/create-category.dto';
import { Trim } from '../../common/decorators/trim.decorator';
import { MAX_PRICE, MAX_STOCK, NormalizeSku, SKU_REGEX } from './create-product.dto';

/**
 * All fields optional. `shortDescription`, `description` and `discountPrice`
 * accept null to clear them. `status` is deliberately absent: use PATCH :id/status.
 * discountPercent and soldCount are never client-writable.
 */
export class UpdateProductDto {
  // ValidateIf (not IsOptional) so an explicit null is rejected for required columns.
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @Trim()
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_REGEX, {
    message: 'slug may contain lowercase letters, numbers and single hyphens only',
  })
  slug?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @NormalizeSku()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(SKU_REGEX, {
    message: 'sku may contain letters, numbers, dots, underscores and hyphens only',
  })
  sku?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @ValidateIf((_o, v) => v !== undefined)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(MAX_PRICE)
  price?: number;

  /** null removes the discount. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(MAX_PRICE)
  discountPrice?: number | null;

  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stockQuantity?: number;

  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  lowStockThreshold?: number;

  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  featured?: boolean;

  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  newArrival?: boolean;

  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  bestSeller?: boolean;

  /** null clears it. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  material?: string | null;

  /** Buying price per unit, for profit. Stock purchases keep it up to date. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  costPrice?: number | null;
}

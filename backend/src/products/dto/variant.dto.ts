import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { MAX_STOCK, NormalizeSku, SKU_REGEX } from './create-product.dto';

/** At least one of size or colour is required (checked in the service). */
export class CreateVariantDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  size?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  color?: string;

  @NormalizeSku()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(SKU_REGEX, {
    message: 'sku may contain letters, numbers, dots, underscores and hyphens only',
  })
  sku!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stockQuantity!: number;
}

export class UpdateVariantDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  size?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  color?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @NormalizeSku()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(SKU_REGEX, {
    message: 'sku may contain letters, numbers, dots, underscores and hyphens only',
  })
  sku?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_STOCK)
  stockQuantity?: number;
}

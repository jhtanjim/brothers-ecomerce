import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { MAX_PRICE } from '../../products/dto/create-product.dto';

export class PosSaleItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  productId!: string;

  /** Required when the product has sizes or colours. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  variantId?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}

export class CreatePosSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items!: PosSaleItemDto[];

  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  cashReceived!: number;

  /** Taka off the whole sale, on top of any product sale prices. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  discount?: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @Matches(/^(\+?[0-9]{7,15})?$/, { message: 'customerPhone must be a valid phone number' })
  customerPhone?: string;
}

export class VoidPosSaleDto {
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

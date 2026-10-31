import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { MAX_PRICE, MAX_STOCK } from '../../products/dto/create-product.dto';

export class PurchaseItemDto {
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
  @Max(MAX_STOCK)
  quantity!: number;

  /** Buying price per unit. */
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  unitCost!: number;
}

export class CreatePurchaseDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  supplierName!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}

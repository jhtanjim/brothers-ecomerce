import { PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
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

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  /** Required for cash. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  cashReceived?: number;

  /** Required for bKash and Nagad. Upper case, like online payments, so the same ID always matches. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9]{6,30}$/, { message: 'transactionId must be 6 to 30 letters or numbers' })
  transactionId?: string;

  /** A return whose value (exchange credit) pays towards this sale. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  exchangeReturnId?: string;

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

/** ?phone=01712345678 */
export class PosCustomerQueryDto {
  @Trim()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;
}

export class VoidPosSaleDto {
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

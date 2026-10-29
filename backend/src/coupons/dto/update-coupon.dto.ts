import { CouponType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { COUPON_CODE_PATTERN, MONEY_PATTERN } from './create-coupon.dto';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/**
 * All fields optional. For the nullable ones, sending null clears the value (removes the limit).
 * code and type are rejected by the service once the coupon has been used.
 */
export class UpdateCouponDto {
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(COUPON_CODE_PATTERN, { message: 'code must be 3-50 characters: A-Z, 0-9, _ or -' })
  code?: string;

  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'value must be a number with up to 2 decimals' })
  value?: string;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'minimumOrderAmount must be a number with up to 2 decimals' })
  minimumOrderAmount?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'maximumDiscount must be a number with up to 2 decimals' })
  maximumDiscount?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  usageLimit?: number | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  perUserLimit?: number | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;
}

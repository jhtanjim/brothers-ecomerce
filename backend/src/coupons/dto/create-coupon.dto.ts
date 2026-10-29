import { ActiveStatus, CouponType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,50}$/;
export const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Rules that need several fields (percentage <= 100, dates) are checked in the service. */
export class CreateCouponDto {
  @Transform(upper)
  @IsString()
  @Matches(COUPON_CODE_PATTERN, { message: 'code must be 3-50 characters: A-Z, 0-9, _ or -' })
  code!: string;

  @IsEnum(CouponType)
  type!: CouponType;

  @IsString()
  @Matches(MONEY_PATTERN, { message: 'value must be a number with up to 2 decimals' })
  value!: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'minimumOrderAmount must be a number with up to 2 decimals' })
  minimumOrderAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'maximumDiscount must be a number with up to 2 decimals' })
  maximumDiscount?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  perUserLimit?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;
}

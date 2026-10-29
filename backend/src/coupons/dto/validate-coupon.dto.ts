import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

/**
 * Only the coupon code and, optionally, the delivery city (to preview the total).
 * The cart, prices and discount are never accepted from the client.
 */
export class ValidateCouponDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  couponCode!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;
}

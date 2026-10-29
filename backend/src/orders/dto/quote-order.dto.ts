import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

/** Delivery city and coupon only. The cart and every price come from the server. */
export class QuoteOrderDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  couponCode?: string;
}

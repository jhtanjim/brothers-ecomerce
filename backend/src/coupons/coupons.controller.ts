import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

/** Authenticated customers only: no @Public(), so the global JwtAuthGuard applies. */
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('validate')
  validate(@CurrentUser() user: JwtPayload, @Body() dto: ValidateCouponDto) {
    return this.coupons.validateForCart(user.sub, dto.couponCode, dto.city);
  }
}

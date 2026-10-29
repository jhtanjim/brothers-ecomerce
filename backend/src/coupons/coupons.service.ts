import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { formatCents } from '../common/utils/money';
import { calculateOrderPricing } from '../orders/order-pricing';
import type { PricingLineInput } from '../orders/order-pricing';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { evaluateCoupon } from './coupon-calculator';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Checks a coupon against the signed-in customer's server-side cart and previews the discount.
   * Read-only: nothing is reserved. The real check is repeated when the order is placed.
   */
  async validateForCart(userId: string, rawCode: string, city?: string) {
    const code = rawCode.trim().toUpperCase();

    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        minimumOrderAmount: true,
        maximumDiscount: true,
        usageLimit: true,
        usedCount: true,
        perUserLimit: true,
        startsAt: true,
        expiresAt: true,
        status: true,
      },
    });
    if (!coupon) {
      throw new NotFoundException({ message: 'Coupon not found', code: 'COUPON_NOT_FOUND' });
    }

    const cart = await this.prisma.cart.findFirst({ where: { userId }, select: { id: true } });
    const items = cart
      ? await this.prisma.cartItem.findMany({
          where: { cartId: cart.id },
          orderBy: { productId: 'asc' },
          select: {
            productId: true,
            quantity: true,
            product: { select: { price: true, discountPrice: true } },
          },
        })
      : [];
    if (items.length === 0) {
      throw new BadRequestException({ message: 'Your cart is empty', code: 'CART_EMPTY' });
    }

    const inputs: PricingLineInput[] = items.map((item) => ({
      productId: item.productId,
      regularPrice: item.product.price,
      paidPrice: item.product.discountPrice ?? item.product.price,
      quantity: item.quantity,
    }));

    const delivery = await this.settings.getDeliveryConfig();

    // Amount after product discounts and before delivery: the base for the coupon rules.
    const base = calculateOrderPricing(inputs, city ?? '', delivery);
    const payableBeforeCoupon = base.subtotalCents - base.discountCents;

    const userUsageCount = await this.prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });

    const result = evaluateCoupon(coupon, payableBeforeCoupon, userUsageCount);
    if (!result.ok) {
      throw new ConflictException({ message: result.message, code: result.code });
    }

    const priced = calculateOrderPricing(inputs, city ?? '', delivery, result.discountCents);
    return {
      code: coupon.code,
      discount: formatCents(priced.couponDiscountCents),
      payable: formatCents(payableBeforeCoupon - priced.couponDiscountCents),
      estimatedTotal: city ? formatCents(priced.totalCents) : null,
    };
  }
}

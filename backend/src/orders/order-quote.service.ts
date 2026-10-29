import { BadRequestException, Injectable } from '@nestjs/common';
import { formatCents } from '../common/utils/money';
import { evaluateCoupon } from '../coupons/coupon-calculator';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { calculateOrderPricing } from './order-pricing';
import type { PricingLineInput } from './order-pricing';

export interface OrderQuote {
  /** Sum of regular prices. */
  subtotal: string;
  /** Product-level (sale price) discounts. */
  discount: string;
  /** Applied coupon code, or null when none was sent or it does not apply. */
  couponCode: string | null;
  couponDiscount: string;
  /** Present only when the coupon was sent but cannot be used. */
  couponError: { code: string; message: string } | null;
  /** null until a city is known. */
  deliveryCharge: string | null;
  /** null until a city is known. */
  total: string | null;
  /** Orders at or above this amount (after discounts) ship free; null when there is no such offer. */
  freeDeliveryThreshold: string | null;
}

/**
 * Read-only price preview for checkout. It uses the same pricing and coupon rules as order
 * creation, but nothing is locked or reserved: the order recalculates everything when placed.
 */
@Injectable()
export class OrderQuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async quote(userId: string, dto: QuoteOrderDto): Promise<OrderQuote> {
    const items = await this.prisma.cartItem.findMany({
      where: { cart: { userId } },
      orderBy: { productId: 'asc' },
      select: {
        productId: true,
        quantity: true,
        product: { select: { price: true, discountPrice: true } },
      },
    });
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
    const city = dto.city ?? '';

    const base = calculateOrderPricing(inputs, city, delivery);
    const payableBeforeCoupon = base.subtotalCents - base.discountCents;

    let couponCode: string | null = null;
    let couponDiscountCents = 0;
    let couponError: OrderQuote['couponError'] = null;
    if (dto.couponCode) {
      const code = dto.couponCode.toUpperCase();
      const coupon = await this.prisma.coupon.findUnique({ where: { code } });
      if (!coupon) {
        couponError = { code: 'COUPON_NOT_FOUND', message: 'Coupon not found' };
      } else {
        const used = await this.prisma.couponUsage.count({
          where: { couponId: coupon.id, userId },
        });
        const result = evaluateCoupon(coupon, payableBeforeCoupon, used);
        if (result.ok) {
          couponCode = coupon.code;
          couponDiscountCents = result.discountCents;
        } else {
          couponError = { code: result.code, message: result.message };
        }
      }
    }

    const priced = calculateOrderPricing(inputs, city, delivery, couponDiscountCents);
    return {
      subtotal: formatCents(priced.subtotalCents),
      discount: formatCents(priced.discountCents),
      couponCode,
      couponDiscount: formatCents(priced.couponDiscountCents),
      couponError,
      deliveryCharge: city ? formatCents(priced.deliveryCents) : null,
      total: city ? formatCents(priced.totalCents) : null,
      freeDeliveryThreshold:
        delivery.freeThreshold !== null ? delivery.freeThreshold.toFixed(2) : null,
    };
  }
}

import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActiveStatus,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { formatCents, toCents } from '../common/utils/money';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginationMeta, toSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import type { DeliveryConfig } from '../settings/settings.service';
import {
  ORDER_NUMBER_ALPHABET,
  ORDER_NUMBER_MAX_ATTEMPTS,
  ORDER_NUMBER_PREFIX,
  ORDER_NUMBER_SUFFIX_LENGTH,
  TRANSACTION_MAX_WAIT_MS,
  TRANSACTION_TIMEOUT_MS,
} from './orders.constants';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderCancellationService } from './order-cancellation.service';
import { evaluateCoupon } from '../coupons/coupon-calculator';
import { calculateOrderPricing } from './order-pricing';
import type { PricingLineInput } from './order-pricing';

/** Primary image first, then by sortOrder. */
const IMAGE_ORDER: Prisma.ProductImageOrderByWithRelationInput[] = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

const orderViewSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  subtotal: true,
  discountAmount: true,
  couponDiscount: true,
  deliveryCharge: true,
  totalAmount: true,
  shippingName: true,
  shippingPhone: true,
  shippingEmail: true,
  shippingAddress: true,
  shippingCity: true,
  shippingArea: true,
  shippingPostalCode: true,
  notes: true,
  expiresAt: true,
  createdAt: true,
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      productId: true,
      productName: true,
      productSku: true,
      productImageUrl: true,
      size: true,
      color: true,
      unitPrice: true,
      quantity: true,
      discountAmount: true,
      totalPrice: true,
    },
  },
  payment: { select: { id: true, method: true, status: true, amount: true } },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderViewSelect }>;

/** Light payload for the order history list: no shipping, payment or full item data. */
const orderListSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  totalAmount: true,
  createdAt: true,
  _count: { select: { items: true } },
  items: {
    orderBy: { id: 'asc' },
    take: 3,
    select: { productName: true, productImageUrl: true, quantity: true },
  },
} satisfies Prisma.OrderSelect;

/** Single order: everything in the create response plus the status timeline. */
const orderDetailSelect = {
  ...orderViewSelect,
  // Overrides the light payment select: adds what the payment panel needs.
  payment: {
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      attemptCount: true,
      transactions: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          status: true,
          transactionId: true,
          rejectionReason: true,
          screenshotPublicId: true,
          createdAt: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { fromStatus: true, toStatus: true, note: true, createdAt: true },
  },
} satisfies Prisma.OrderSelect;

type OrderDetailRow = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;
/** Money leaves the API as decimal strings such as "1250.00", like the cart. */
function money(value: Prisma.Decimal): string {
  return formatCents(toCents(value));
}

function toView(order: OrderRow) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: money(order.subtotal),
    discountAmount: money(order.discountAmount),
    couponDiscount: money(order.couponDiscount),
    deliveryCharge: money(order.deliveryCharge),
    totalAmount: money(order.totalAmount),
    shipping: {
      name: order.shippingName,
      phone: order.shippingPhone,
      email: order.shippingEmail,
      address: order.shippingAddress,
      city: order.shippingCity,
      area: order.shippingArea,
      postalCode: order.shippingPostalCode,
    },
    notes: order.notes,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.productName,
      sku: item.productSku,
      imageUrl: item.productImageUrl,
      size: item.size,
      color: item.color,
      unitPrice: money(item.unitPrice),
      quantity: item.quantity,
      discountAmount: money(item.discountAmount),
      totalPrice: money(item.totalPrice),
    })),
    payment: order.payment
      ? {
          id: order.payment.id,
          method: order.payment.method,
          status: order.payment.status,
          amount: money(order.payment.amount),
        }
      : null,
  };
}

export type OrderView = ReturnType<typeof toView>;

function orderDatePart(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/-/g, '');
}

export function generateOrderNumber(prefix: string = ORDER_NUMBER_PREFIX): string {
  let suffix = '';
  for (let i = 0; i < ORDER_NUMBER_SUFFIX_LENGTH; i++) {
    suffix += ORDER_NUMBER_ALPHABET.charAt(randomInt(ORDER_NUMBER_ALPHABET.length));
  }
  return `${prefix}-${orderDatePart()}-${suffix}`;
}

export function isOrderNumberCollision(error: unknown, field = 'orderNumber'): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    String(error.meta?.target ?? '').includes(field)
  );
}

function cartEmpty(): BadRequestException {
  return new BadRequestException({ message: 'Your cart is empty', code: 'CART_EMPTY' });
}

interface ProductSnapshot {
  name: string;
  sku: string;
  imageUrl: string | null;
  variantId: string | null;
  size: string | null;
  color: string | null;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly cloudinary: CloudinaryService,
    private readonly cancellation: OrderCancellationService,
  ) {}

  /**
   * Turns the customer's cart into an order. Atomic: any failure rolls back stock, order,
   * payment and cart changes. A repeated call with the same idempotency key returns the same order.
   */
  async create(userId: string, dto: CreateOrderDto, idempotencyKey: string): Promise<OrderView> {
    const [delivery, expiryHours] = await Promise.all([
      this.settings.getDeliveryConfig(),
      this.settings.getUnpaidExpiryHours(),
    ]);

    for (let attempt = 1; ; attempt++) {
      try {
        const orderId = await this.prisma.$transaction(
          (tx) => this.placeOrder(tx, userId, dto, idempotencyKey, delivery, expiryHours),
          { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
        );
        return await this.loadView(orderId);
      } catch (error) {
        if (attempt < ORDER_NUMBER_MAX_ATTEMPTS && isOrderNumberCollision(error)) continue;
        throw error;
      }
    }
  }

  /** The signed-in customer's orders, newest first. Database-level pagination. */
  async list(userId: string, query: PaginationQueryDto) {
    const { skip, take } = toSkipTake(query.page, query.limit);
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        // An admin's counter sales are not their own purchases.
        where: { userId, channel: OrderChannel.ONLINE },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        select: orderListSelect,
      }),
      this.prisma.order.count({ where: { userId, channel: OrderChannel.ONLINE } }),
    ]);

    return {
      data: rows.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: money(order.totalAmount),
        lineCount: order._count.items,
        previewItems: order.items.map((item) => ({
          name: item.productName,
          imageUrl: item.productImageUrl,
          quantity: item.quantity,
        })),
        createdAt: order.createdAt,
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  /** One of the customer's own orders. Another customer's order is reported as not found. */
  async findOne(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      select: orderDetailSelect,
    });
    if (!order) {
      throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }
    return {
      ...toView(order),
      paymentInfo: await this.buildPaymentInfo(order),
      // Only for an approved payment: the newest submission is the approved one.
      approvedTransactionId:
        order.payment?.status === PaymentStatus.APPROVED
          ? (order.payment.transactions[0]?.transactionId ?? null)
          : null,
      timeline: order.statusHistory.map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        note: entry.note,
        createdAt: entry.createdAt,
      })),
    };
  }
  /** Customer cancel: own order only, and never while a payment is under review. */
  async cancel(userId: string, id: string) {
    await this.prisma.$transaction(
      (tx) =>
        this.cancellation.cancelInTx(tx, id, {
          source: 'CUSTOMER',
          reason: 'Cancelled by customer',
          actorId: userId,
          ownerId: userId,
        }),
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
    );
    return this.findOne(userId, id);
  }
  /**
   * Data for the payment panel of an order that is still awaiting payment; null otherwise.
   * The caller has already verified ownership, so the signed screenshot link only reaches the owner.
   */
  private async buildPaymentInfo(order: OrderDetailRow) {
    const payment = order.payment;
    if (order.status !== OrderStatus.PENDING_PAYMENT || !payment) return null;

    const config = await this.settings.getPaymentConfig();
    const latest = payment.transactions[0];
    return {
      merchantNumber:
        payment.method === PaymentMethod.BKASH ? config.bkashNumber : config.nagadNumber,
      screenshotEnabled: config.screenshotEnabled,
      attemptsUsed: payment.attemptCount,
      maxAttempts: config.maxAttempts,
      latestSubmission: latest
        ? {
            status: latest.status,
            transactionId: latest.transactionId,
            rejectionReason: latest.rejectionReason,
            screenshotUrl: latest.screenshotPublicId
              ? this.cloudinary.signedPrivateImageUrl(latest.screenshotPublicId)
              : null,
            submittedAt: latest.createdAt,
          }
        : null,
    };
  }
  private async loadView(orderId: string): Promise<OrderView> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: orderViewSelect,
    });
    return toView(order);
  }

  private async placeOrder(
    tx: Prisma.TransactionClient,
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey: string,
    delivery: DeliveryConfig,
    expiryHours: number,
  ): Promise<string> {
    // 1. Serialize checkouts of the same cart (two tabs, double click, retry).
    const lockedCarts = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "carts" WHERE "userId" = ${userId} FOR UPDATE`;

    // 2. Idempotency: checked after the lock, so a concurrent duplicate sees the first order.
    const existing = await tx.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      select: { id: true },
    });
    if (existing) return existing.id;

    const cart = lockedCarts[0];
    if (!cart) throw cartEmpty();

    // 3. Cart lines in a fixed order, so concurrent orders lock products in the same order.
    const items = await tx.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: [{ productId: 'asc' }, { variantKey: 'asc' }],
      select: { productId: true, variantId: true, quantity: true },
    });
    if (items.length === 0) throw cartEmpty();

    // 3b. Lock the coupon row (lock order: cart, coupon, products). Evaluated after the stock loop.
    const couponCode = dto.couponCode ? dto.couponCode.trim().toUpperCase() : null;
    const lockedCoupon = couponCode ? await this.lockCoupon(tx, couponCode, userId) : null;

    // 4. Reserve stock. The conditional update cannot oversell, even under concurrent orders.
    const inputs: PricingLineInput[] = [];
    const snapshots: ProductSnapshot[] = [];
    for (const item of items) {
      const line = await this.reserveLine(tx, item);
      inputs.push(line.input);
      snapshots.push(line.snapshot);
    }

    // 5. Coupon (re-validated here, under the coupon row lock) and totals in integer cents.
    let couponDiscountCents = 0;
    if (lockedCoupon) {
      const payableBeforeCoupon = inputs.reduce(
        (sum, line) =>
          sum + Math.min(toCents(line.paidPrice), toCents(line.regularPrice)) * line.quantity,
        0,
      );
      const result = evaluateCoupon(lockedCoupon, payableBeforeCoupon, lockedCoupon.userUsageCount);
      if (!result.ok) {
        throw new ConflictException({ message: result.message, code: result.code });
      }
      const counted = await tx.coupon.updateMany({
        where: {
          id: lockedCoupon.id,
          ...(lockedCoupon.usageLimit !== null
            ? { usedCount: { lt: lockedCoupon.usageLimit } }
            : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (counted.count === 0) {
        throw new ConflictException({
          message: 'This coupon has reached its usage limit',
          code: 'COUPON_USAGE_LIMIT_REACHED',
        });
      }
      couponDiscountCents = result.discountCents;
    }
    const pricing = calculateOrderPricing(inputs, dto.city, delivery, couponDiscountCents);

    // 6. Order, items (snapshots), status history and payment record.
    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        subtotal: formatCents(pricing.subtotalCents),
        discountAmount: formatCents(pricing.discountCents),
        couponDiscount: formatCents(pricing.couponDiscountCents),
        deliveryCharge: formatCents(pricing.deliveryCents),
        totalAmount: formatCents(pricing.totalCents),
        status: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.UNPAID,
        shippingName: dto.fullName,
        shippingPhone: dto.phone,
        shippingEmail: dto.email,
        shippingAddress: dto.addressLine,
        shippingCity: dto.city,
        shippingArea: dto.area,
        shippingPostalCode: dto.postalCode,
        notes: dto.notes ? dto.notes : null,
        couponCode: lockedCoupon ? couponCode : null,
        expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
        idempotencyKey,
        items: {
          create: pricing.lines.map((line, index) => ({
            productId: line.productId,
            productName: snapshots[index]?.name ?? '',
            productSku: snapshots[index]?.sku ?? '',
            productImageUrl: snapshots[index]?.imageUrl ?? null,
            variantId: snapshots[index]?.variantId ?? null,
            size: snapshots[index]?.size ?? null,
            color: snapshots[index]?.color ?? null,
            unitPrice: formatCents(line.unitPriceCents),
            quantity: line.quantity,
            discountAmount: formatCents(line.discountCents),
            totalPrice: formatCents(line.totalCents),
          })),
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.PENDING_PAYMENT,
            note: 'Order placed',
            changedById: userId,
          },
        },
        payment: {
          create: {
            method: dto.paymentMethod,
            amount: formatCents(pricing.totalCents),
            status: PaymentStatus.UNPAID,
          },
        },
      },
      select: { id: true },
    });

    if (lockedCoupon) {
      await tx.couponUsage.create({
        data: {
          couponId: lockedCoupon.id,
          userId,
          orderId: order.id,
          discountAmount: formatCents(pricing.couponDiscountCents),
        },
      });
    }

    // 7. The cart has become the order.
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return order.id;
  }

  /**
   * Takes one line's units from stock and returns its price and snapshot. The conditional updates
   * cannot oversell, even under concurrent sales. Used by online checkout and the POS.
   */
  async reserveLine(
    tx: Prisma.TransactionClient,
    item: { productId: string; variantId: string | null; quantity: number },
  ): Promise<{ input: PricingLineInput; snapshot: ProductSnapshot }> {
    const reserved = await tx.product.updateMany({
      where: {
        id: item.productId,
        status: ProductStatus.ACTIVE,
        category: { status: ActiveStatus.ACTIVE },
        stockQuantity: { gte: item.quantity },
      },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    if (reserved.count === 0) {
      throw await this.stockFailure(tx, item.productId, item.quantity);
    }

    // The product row is locked now. Its total can hide an option that has run out.
    if (item.variantId) {
      const reservedOption = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          productId: item.productId,
          stockQuantity: { gte: item.quantity },
        },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (reservedOption.count === 0) {
        throw await this.optionStockFailure(tx, item.variantId, item.quantity);
      }
    }

    // The row is locked by our own update, so this is the price we charge.
    const product = await tx.product.findUniqueOrThrow({
      where: { id: item.productId },
      select: {
        name: true,
        sku: true,
        price: true,
        discountPrice: true,
        images: { orderBy: IMAGE_ORDER, take: 1, select: { url: true } },
        _count: { select: { variants: true } },
      },
    });
    if (!item.variantId && product._count.variants > 0) {
      throw new ConflictException({
        message: `Please choose an option for ${product.name}`,
        code: 'OPTION_REQUIRED',
        details: { productId: item.productId },
      });
    }
    const variant = item.variantId
      ? await tx.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
          select: { size: true, color: true, sku: true },
        })
      : null;
    return {
      input: {
        productId: item.productId,
        regularPrice: product.price,
        paidPrice: product.discountPrice ?? product.price,
        quantity: item.quantity,
      },
      snapshot: {
        name: product.name,
        sku: variant?.sku ?? product.sku,
        imageUrl: product.images[0]?.url ?? null,
        variantId: item.variantId,
        size: variant?.size || null,
        color: variant?.color || null,
      },
    };
  }

  /** Locks the coupon row FOR UPDATE, then loads its rule fields and this customer's live usage count. */
  private async lockCoupon(tx: Prisma.TransactionClient, code: string, userId: string) {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "coupons" WHERE "code" = ${code} FOR UPDATE`;
    const id = locked[0]?.id;
    if (!id) {
      throw new NotFoundException({ message: 'Coupon not found', code: 'COUPON_NOT_FOUND' });
    }
    const coupon = await tx.coupon.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
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
    const userUsageCount = await tx.couponUsage.count({ where: { couponId: id, userId } });
    return { ...coupon, userUsageCount };
  }

  private async optionStockFailure(
    tx: Prisma.TransactionClient,
    variantId: string,
    requested: number,
  ): Promise<ConflictException> {
    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: {
        size: true,
        color: true,
        stockQuantity: true,
        product: { select: { id: true, name: true } },
      },
    });
    const label = [variant.product.name, variant.size, variant.color].filter(Boolean).join(' ');
    return new ConflictException({
      message:
        variant.stockQuantity < 1
          ? `${label} is out of stock`
          : `Only ${variant.stockQuantity} of ${label} available`,
      code: 'INSUFFICIENT_STOCK',
      details: {
        productId: variant.product.id,
        availableStock: variant.stockQuantity,
        requested,
      },
    });
  }

  /** Explains why a stock reservation failed (names the product so the customer can fix the cart). */
  private async stockFailure(
    tx: Prisma.TransactionClient,
    productId: string,
    requested: number,
  ): Promise<ConflictException> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        name: true,
        stockQuantity: true,
        status: true,
        category: { select: { status: true } },
      },
    });

    if (
      !product ||
      product.status !== ProductStatus.ACTIVE ||
      product.category.status !== ActiveStatus.ACTIVE
    ) {
      return new ConflictException({
        message: product
          ? `${product.name} is no longer available`
          : 'A product in your cart is no longer available',
        code: 'PRODUCT_UNAVAILABLE',
        details: { productId },
      });
    }

    return new ConflictException({
      message:
        product.stockQuantity < 1
          ? `${product.name} is out of stock`
          : `Only ${product.stockQuantity} of ${product.name} available`,
      code: 'INSUFFICIENT_STOCK',
      details: { productId, availableStock: product.stockQuantity, requested },
    });
  }
}

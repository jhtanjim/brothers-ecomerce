import { Injectable } from '@nestjs/common';
import {
  ExpenseCategory,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
  Role,
} from '@prisma/client';
import { formatCents, toCents } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Asia/Dhaka is UTC+6 all year (no daylight saving). */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const LIST_SIZE = 5;

/** A sale is a paid order that was not cancelled. */
const SALE_WHERE: Prisma.OrderWhereInput = {
  paymentStatus: PaymentStatus.APPROVED,
  status: { not: OrderStatus.CANCELLED },
};

const TOP_ITEMS = 10;
const LOW_STOCK_MAX = 500;

function money(value: Prisma.Decimal | null): string {
  return formatCents(value === null ? 0 : toCents(value));
}

function netSales(sales: Prisma.Decimal | null, returned: Prisma.Decimal | null): string {
  return formatCents(toCents(sales ?? 0) - toCents(returned ?? 0));
}

/** Start of the current Dhaka calendar day, as a UTC instant. */
function dhakaDayStart(now: Date = new Date()): Date {
  const shifted = now.getTime() + DHAKA_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - DHAKA_OFFSET_MS);
}

function dhakaDayLabel(dayStart: Date): string {
  return new Date(dayStart.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cards plus three short lists. Every number is a database aggregate or a small LIMITed query. */
  async overview() {
    const todayStart = dhakaDayStart();

    const [
      totalSales,
      todaySales,
      allReturns,
      todayReturns,
      totalOrders,
      pendingOrders,
      pendingPayments,
      totalCustomers,
      totalProducts,
      lowStock,
      recentOrders,
      pendingPaymentOrders,
      lowStockProducts,
    ] = await Promise.all([
      this.prisma.order.aggregate({ where: SALE_WHERE, _sum: { totalAmount: true } }),
      this.prisma.order.aggregate({
        where: { ...SALE_WHERE, createdAt: { gte: todayStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.orderReturn.aggregate({ _sum: { refundAmount: true } }),
      this.prisma.orderReturn.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { refundAmount: true },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING_PAYMENT } }),
      this.prisma.order.count({ where: { paymentStatus: PaymentStatus.PENDING } }),
      this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM "products" p LEFT JOIN "product_variants" v ON v."productId" = p."id"
        WHERE p."status" = 'ACTIVE'
          AND COALESCE(v."stockQuantity", p."stockQuantity") <= p."lowStockThreshold"`,
      this.prisma.order.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: LIST_SIZE,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          shippingName: true,
          createdAt: true,
        },
      }),
      this.prisma.order.findMany({
        where: { paymentStatus: PaymentStatus.PENDING },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: LIST_SIZE,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          shippingName: true,
          createdAt: true,
          payment: { select: { id: true, method: true } },
        },
      }),
      this.lowStock(LIST_SIZE),
    ]);

    return {
      cards: {
        // Net of returns, so an exchange counts only once.
        totalSales: netSales(totalSales._sum.totalAmount, allReturns._sum.refundAmount),
        todaySales: netSales(todaySales._sum.totalAmount, todayReturns._sum.refundAmount),
        totalOrders,
        pendingOrders,
        pendingPayments,
        totalCustomers,
        totalProducts,
        lowStockProducts: lowStock[0]?.count ?? 0,
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: money(order.totalAmount),
        customerName: order.shippingName,
        createdAt: order.createdAt,
      })),
      pendingPayments: pendingPaymentOrders.map((order) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: order.payment?.id ?? null,
        method: order.payment?.method ?? null,
        totalAmount: money(order.totalAmount),
        customerName: order.shippingName,
        createdAt: order.createdAt,
      })),
      lowStock: lowStockProducts,
    };
  }

  /** Daily sales for the last `days` Dhaka days (today included). Days without sales are 0. */
  async sales(days: number) {
    const todayStart = dhakaDayStart();
    const since = new Date(todayStart.getTime() - (days - 1) * DAY_MS);

    const rows = await this.prisma.$queryRaw<{ day: string; total: string; orders: number }[]>`
      SELECT
        to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date, 'YYYY-MM-DD') AS day,
        COALESCE(SUM("totalAmount"), 0)::text AS total,
        COUNT(*)::int AS orders
      FROM "orders"
      WHERE "paymentStatus" = 'APPROVED' AND "status" <> 'CANCELLED' AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1`;
    const byDay = new Map(rows.map((row) => [row.day, row]));

    const points = [];
    for (let i = days - 1; i >= 0; i--) {
      const label = dhakaDayLabel(new Date(todayStart.getTime() - i * DAY_MS));
      const row = byDay.get(label);
      points.push({
        date: label,
        sales: row ? formatCents(toCents(row.total)) : '0.00',
        orders: row ? row.orders : 0,
      });
    }
    return { days, points };
  }

  /** Best sellers by units sold (Product.soldCount, indexed). */
  /** One Dhaka calendar day. Online orders count on the day they were placed, once paid. */
  async dailyReport(date?: string) {
    const start = date
      ? new Date(new Date(`${date}T00:00:00.000Z`).getTime() - DHAKA_OFFSET_MS)
      : dhakaDayStart();
    const end = new Date(start.getTime() + DAY_MS);

    const day = dhakaDayLabel(start);
    const [groups, cancelledPos, items, returns, profit, purchases, expenses, cashDay] =
      await Promise.all([
        this.prisma.$queryRaw<
          {
            channel: OrderChannel;
            method: PaymentMethod;
            sales: number;
            total: Prisma.Decimal;
            received: Prisma.Decimal;
          }[]
        >`
        SELECT o."channel", p."method", COUNT(*)::int AS sales, SUM(o."totalAmount") AS total,
          SUM(o."totalAmount" - o."exchangeCredit") AS received
        FROM "orders" o JOIN "payments" p ON p."orderId" = o."id"
        WHERE o."paymentStatus" = 'APPROVED' AND o."status" <> 'CANCELLED'
          AND o."createdAt" >= ${start} AND o."createdAt" < ${end}
        GROUP BY o."channel", p."method"`,
        this.prisma.order.aggregate({
          where: {
            channel: OrderChannel.POS,
            status: OrderStatus.CANCELLED,
            createdAt: { gte: start, lt: end },
          },
          _count: true,
          _sum: { totalAmount: true },
        }),
        this.prisma.$queryRaw<
          { productId: string; name: string; quantity: number; total: Prisma.Decimal }[]
        >`
        SELECT i."productId", MAX(i."productName") AS name,
          SUM(i."quantity")::int AS quantity, SUM(i."totalPrice") AS total
        FROM "order_items" i JOIN "orders" o ON o."id" = i."orderId"
        WHERE o."paymentStatus" = 'APPROVED' AND o."status" <> 'CANCELLED'
          AND o."createdAt" >= ${start} AND o."createdAt" < ${end}
        GROUP BY i."productId"
        ORDER BY quantity DESC, name ASC`,
        this.prisma.orderReturn.groupBy({
          by: ['refundMethod'],
          where: { createdAt: { gte: start, lt: end } },
          _count: true,
          _sum: { refundAmount: true },
        }),
        this.dayProfit(start, end),
        this.prisma.stockPurchase.aggregate({
          where: { createdAt: { gte: start, lt: end } },
          _count: true,
          _sum: { totalCost: true },
        }),
        this.prisma.expense.findMany({
          where: { day },
          select: { category: true, amount: true, paidFromDrawer: true },
        }),
        this.prisma.cashDay.findUnique({
          where: { day },
          select: { openingCash: true, countedCash: true },
        }),
      ]);

    const returnedCents = returns.reduce(
      (sum, row) => sum + toCents(row._sum.refundAmount ?? 0),
      0,
    );

    const channelReport = (channel: OrderChannel) => {
      const rows = groups.filter((row) => row.channel === channel);
      return {
        sales: rows.reduce((sum, row) => sum + row.sales, 0),
        // Money actually taken: credit from returned items is not new money.
        total: formatCents(rows.reduce((sum, row) => sum + toCents(row.received), 0)),
        methods: rows.map((row) => ({
          method: row.method,
          sales: row.sales,
          total: money(row.received),
        })),
      };
    };

    const centsOf = (rows: { amount: Prisma.Decimal }[]) =>
      rows.reduce((sum, row) => sum + toCents(row.amount), 0);
    const supplierPayments = expenses.filter(
      (row) => row.category === ExpenseCategory.SUPPLIER_PAYMENT,
    );
    const runningCents = centsOf(expenses) - centsOf(supplierPayments);

    // Only cash moves the drawer. Refunds count on the day they were given.
    const cashSalesCents = groups
      .filter((row) => row.method === PaymentMethod.CASH)
      .reduce((sum, row) => sum + toCents(row.received), 0);
    const cashRefundCents = toCents(
      returns.find((row) => row.refundMethod === PaymentMethod.CASH)?._sum.refundAmount ?? 0,
    );
    const drawerExpenseCents = centsOf(expenses.filter((row) => row.paidFromDrawer));
    const expectedCents =
      cashDay?.openingCash != null
        ? toCents(cashDay.openingCash) + cashSalesCents - cashRefundCents - drawerExpenseCents
        : null;
    const countedCents = cashDay?.countedCash != null ? toCents(cashDay.countedCash) : null;

    return {
      date: day,
      expenses: {
        count: expenses.length,
        running: formatCents(runningCents),
        supplierPayments: formatCents(centsOf(supplierPayments)),
      },
      takeHome: formatCents(toCents(profit.profit) - runningCents),
      drawer: {
        opening: cashDay?.openingCash != null ? money(cashDay.openingCash) : null,
        cashSales: formatCents(cashSalesCents),
        cashRefunds: formatCents(cashRefundCents),
        drawerExpenses: formatCents(drawerExpenseCents),
        expected: expectedCents === null ? null : formatCents(expectedCents),
        counted: countedCents === null ? null : formatCents(countedCents),
        difference:
          expectedCents === null || countedCents === null
            ? null
            : formatCents(countedCents - expectedCents),
      },
      // Sales minus everything brought back, so an exchange counts only once.
      total: formatCents(groups.reduce((sum, row) => sum + toCents(row.total), 0) - returnedCents),
      returns: {
        count: returns.reduce((sum, row) => sum + row._count, 0),
        total: formatCents(returnedCents),
        credit: money(returns.find((row) => row.refundMethod === null)?._sum.refundAmount ?? null),
        refunds: returns.flatMap((row) =>
          row.refundMethod
            ? [{ method: row.refundMethod, total: money(row._sum.refundAmount) }]
            : [],
        ),
      },
      itemsSold: items.reduce((sum, item) => sum + item.quantity, 0),
      pos: channelReport(OrderChannel.POS),
      online: channelReport(OrderChannel.ONLINE),
      profit,
      purchases: { count: purchases._count, total: money(purchases._sum.totalCost) },
      cancelledPos: { sales: cancelledPos._count, total: money(cancelledPos._sum.totalAmount) },
      topItems: items.slice(0, TOP_ITEMS).map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        total: money(item.total),
      })),
    };
  }

  /**
   * Profit from items whose buying price is known; the others are counted so the owner can see the
   * figure is incomplete. A sale discount is shared across the items by value. A returned item is
   * taken out on the day it came back, but a damaged one keeps its cost, because that money is lost.
   */
  private async dayProfit(start: Date, end: Date) {
    const [orders, returned] = await Promise.all([
      this.prisma.order.findMany({
        where: { ...SALE_WHERE, createdAt: { gte: start, lt: end } },
        select: {
          couponDiscount: true,
          items: { select: { totalPrice: true, quantity: true, unitCost: true } },
        },
      }),
      this.prisma.orderReturnItem.findMany({
        where: { orderReturn: { createdAt: { gte: start, lt: end } } },
        select: {
          quantity: true,
          amount: true,
          orderReturn: { select: { restocked: true } },
          orderItem: { select: { unitCost: true } },
        },
      }),
    ]);

    let revenueCents = 0;
    let costCents = 0;
    let unknownCostUnits = 0;
    for (const order of orders) {
      const itemsCents = order.items.reduce((sum, item) => sum + toCents(item.totalPrice), 0);
      const discountCents = toCents(order.couponDiscount);
      for (const item of order.items) {
        if (item.unitCost === null) {
          unknownCostUnits += item.quantity;
          continue;
        }
        const lineCents = toCents(item.totalPrice);
        const share = itemsCents > 0 ? Math.round((discountCents * lineCents) / itemsCents) : 0;
        revenueCents += lineCents - share;
        costCents += toCents(item.unitCost) * item.quantity;
      }
    }
    for (const item of returned) {
      if (item.orderItem.unitCost === null) continue;
      revenueCents -= toCents(item.amount);
      if (item.orderReturn.restocked) {
        costCents -= toCents(item.orderItem.unitCost) * item.quantity;
      }
    }
    return {
      revenue: formatCents(revenueCents),
      cost: formatCents(costCents),
      profit: formatCents(revenueCents - costCents),
      unknownCostUnits,
    };
  }

  /**
   * Every size and colour on its own line, because one size can run out while the product total
   * looks fine. The product's alert level applies to each option. Emptiest first.
   */
  async lowStock(limit = LOW_STOCK_MAX) {
    return this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        sku: string;
        size: string | null;
        color: string | null;
        stockQuantity: number;
        lowStockThreshold: number;
      }[]
    >`
      SELECT p."id", p."name", COALESCE(v."sku", p."sku") AS sku,
        NULLIF(v."size", '') AS size, NULLIF(v."color", '') AS color,
        COALESCE(v."stockQuantity", p."stockQuantity")::int AS "stockQuantity",
        p."lowStockThreshold"
      FROM "products" p LEFT JOIN "product_variants" v ON v."productId" = p."id"
      WHERE p."status" = 'ACTIVE'
        AND COALESCE(v."stockQuantity", p."stockQuantity") <= p."lowStockThreshold"
      ORDER BY 6 ASC, p."name" ASC, 3 ASC
      LIMIT ${limit}`;
  }

  /** A whole month, built from the daily reports so both always agree. Future days are left out. */
  async monthlyReport(month: string) {
    const [year, monthNumber] = month.split('-').map(Number) as [number, number];
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const today = dhakaDayLabel(dhakaDayStart());
    const dates = Array.from(
      { length: daysInMonth },
      (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
    ).filter((date) => date <= today);

    const days: Awaited<ReturnType<DashboardService['dailyReport']>>[] = [];
    for (const date of dates) days.push(await this.dailyReport(date));

    const sum = (pick: (day: (typeof days)[number]) => string) =>
      formatCents(days.reduce((total, day) => total + toCents(pick(day)), 0));

    const byCategory = await this.prisma.expense.groupBy({
      by: ['category'],
      where: { day: { startsWith: `${month}-` } },
      _sum: { amount: true },
    });

    return {
      month,
      total: sum((day) => day.total),
      profit: sum((day) => day.profit.profit),
      running: sum((day) => day.expenses.running),
      supplierPayments: sum((day) => day.expenses.supplierPayments),
      takeHome: sum((day) => day.takeHome),
      returns: sum((day) => day.returns.total),
      purchases: sum((day) => day.purchases.total),
      itemsSold: days.reduce((total, day) => total + day.itemsSold, 0),
      unknownCostUnits: days.reduce((total, day) => total + day.profit.unknownCostUnits, 0),
      byCategory: byCategory
        .map((row) => ({ category: row.category, total: money(row._sum.amount) }))
        .sort((a, b) => toCents(b.total) - toCents(a.total)),
      days: days.map((day) => ({
        date: day.date,
        total: day.total,
        profit: day.profit.profit,
        running: day.expenses.running,
        takeHome: day.takeHome,
      })),
    };
  }

  async topProducts(limit: number) {
    const rows = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, soldCount: { gt: 0 } },
      orderBy: [{ soldCount: 'desc' }, { name: 'asc' }],
      take: limit,
      select: { id: true, name: true, slug: true, sku: true, soldCount: true, price: true },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      soldCount: row.soldCount,
      price: money(row.price),
    }));
  }
}

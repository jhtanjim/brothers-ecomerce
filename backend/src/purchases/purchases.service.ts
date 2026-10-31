import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { formatCents, toCents } from '../common/utils/money';
import { buildPaginationMeta, toSkipTake } from '../common/utils/pagination';
import { generateOrderNumber, isOrderNumberCollision } from '../orders/orders.service';
import {
  ORDER_NUMBER_MAX_ATTEMPTS,
  TRANSACTION_MAX_WAIT_MS,
  TRANSACTION_TIMEOUT_MS,
} from '../orders/orders.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

const PURCHASE_PREFIX = 'PUR';

const purchaseSelect = {
  id: true,
  purchaseNumber: true,
  supplierName: true,
  note: true,
  totalCost: true,
  createdAt: true,
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      quantity: true,
      unitCost: true,
      product: { select: { name: true, sku: true } },
      variant: { select: { size: true, color: true, sku: true } },
    },
  },
} satisfies Prisma.StockPurchaseSelect;

type PurchaseRow = Prisma.StockPurchaseGetPayload<{ select: typeof purchaseSelect }>;

function toView(row: PurchaseRow) {
  return {
    id: row.id,
    purchaseNumber: row.purchaseNumber,
    supplierName: row.supplierName,
    note: row.note,
    totalCost: formatCents(toCents(row.totalCost)),
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      name: item.product.name,
      sku: item.variant?.sku ?? item.product.sku,
      size: item.variant?.size || null,
      color: item.variant?.color || null,
      quantity: item.quantity,
      unitCost: formatCents(toCents(item.unitCost)),
    })),
  };
}

/** The buying price of all units on hand after new ones arrive. */
export function averageCostCents(
  stockOnHand: number,
  currentCostCents: number | null,
  quantity: number,
  unitCostCents: number,
): number {
  // Stock with no known price, or no stock at all, says nothing about the average.
  if (currentCostCents === null || stockOnHand <= 0) return unitCostCents;
  return Math.round(
    (stockOnHand * currentCostCents + quantity * unitCostCents) / (stockOnHand + quantity),
  );
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async list({ page, limit }: PaginationQueryDto) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockPurchase.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: purchaseSelect,
        ...toSkipTake(page, limit),
      }),
      this.prisma.stockPurchase.count(),
    ]);
    return { data: rows.map(toView), meta: buildPaginationMeta(page, limit, total) };
  }

  async create(
    adminId: string,
    dto: CreatePurchaseDto,
    idempotencyKey: string,
    ipAddress: string | null,
  ) {
    const keys = dto.items.map((item) => `${item.productId}:${item.variantId ?? ''}`);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException({
        message: 'The same item is listed twice',
        code: 'PURCHASE_DUPLICATE_ITEM',
      });
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const id = await this.prisma.$transaction(
          (tx) => this.place(tx, adminId, dto, idempotencyKey, ipAddress),
          { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
        );
        const row = await this.prisma.stockPurchase.findUniqueOrThrow({
          where: { id },
          select: purchaseSelect,
        });
        return toView(row);
      } catch (error) {
        if (
          attempt < ORDER_NUMBER_MAX_ATTEMPTS &&
          isOrderNumberCollision(error, 'purchaseNumber')
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  private async place(
    tx: Prisma.TransactionClient,
    adminId: string,
    dto: CreatePurchaseDto,
    idempotencyKey: string,
    ipAddress: string | null,
  ): Promise<string> {
    const existing = await tx.stockPurchase.findUnique({
      where: { adminId_idempotencyKey: { adminId, idempotencyKey } },
      select: { id: true },
    });
    if (existing) return existing.id;

    // Fixed order, like sales, so concurrent stock changes lock products in the same order.
    const items = [...dto.items].sort(
      (a, b) =>
        a.productId.localeCompare(b.productId) ||
        (a.variantId ?? '').localeCompare(b.variantId ?? ''),
    );

    let totalCents = 0;
    for (const item of items) {
      const rows = await tx.$queryRaw<
        { stockQuantity: number; costPrice: Prisma.Decimal | null }[]
      >`SELECT "stockQuantity", "costPrice" FROM "products" WHERE id = ${item.productId} FOR UPDATE`;
      const product = rows[0];
      if (!product) {
        throw new NotFoundException({ message: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
      }
      const optionCount = await tx.productVariant.count({ where: { productId: item.productId } });
      if (optionCount > 0 && !item.variantId) {
        throw new ConflictException({
          message: 'Choose a size or colour for this product',
          code: 'OPTION_REQUIRED',
        });
      }
      if (item.variantId) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, productId: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
        if (updated.count === 0) {
          throw new NotFoundException({ message: 'Option not found', code: 'VARIANT_NOT_FOUND' });
        }
      }

      const unitCents = toCents(item.unitCost);
      totalCents += unitCents * item.quantity;
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: { increment: item.quantity },
          costPrice: formatCents(
            averageCostCents(
              product.stockQuantity,
              product.costPrice === null ? null : toCents(product.costPrice),
              item.quantity,
              unitCents,
            ),
          ),
        },
      });
    }

    const purchase = await tx.stockPurchase.create({
      data: {
        purchaseNumber: generateOrderNumber(PURCHASE_PREFIX),
        supplierName: dto.supplierName,
        note: dto.note || null,
        totalCost: formatCents(totalCents),
        adminId,
        idempotencyKey,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: item.quantity,
            unitCost: formatCents(toCents(item.unitCost)),
          })),
        },
      },
      select: { id: true, purchaseNumber: true },
    });

    await this.activityLogs.record(tx, {
      adminId,
      action: ACTIVITY_ACTIONS.stockPurchased,
      entityType: 'StockPurchase',
      entityId: purchase.id,
      metadata: { purchaseNumber: purchase.purchaseNumber, total: formatCents(totalCents) },
      ipAddress,
    });
    return purchase.id;
  }
}

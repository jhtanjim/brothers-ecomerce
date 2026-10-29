import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActiveStatus, CouponType, Prisma } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { buildPaginationMeta, toSkipTake } from '../common/utils/pagination';
import { TRANSACTION_MAX_WAIT_MS, TRANSACTION_TIMEOUT_MS } from '../orders/orders.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

const couponSelect = {
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CouponSelect;

type CouponRow = Prisma.CouponGetPayload<{ select: typeof couponSelect }>;

const TX_OPTIONS = { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS };

function dec(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(2);
}

function toView(coupon: CouponRow) {
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value.toFixed(2),
    minimumOrderAmount: dec(coupon.minimumOrderAmount),
    maximumDiscount: dec(coupon.maximumDiscount),
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    perUserLimit: coupon.perUserLimit,
    startsAt: coupon.startsAt,
    expiresAt: coupon.expiresAt,
    status: coupon.status,
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  };
}

interface CouponFields {
  type: CouponType;
  value: string;
  minimumOrderAmount: string | null;
  maximumDiscount: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
}

function invalid(message: string): BadRequestException {
  return new BadRequestException({ message, code: 'COUPON_INVALID' });
}

/** Rules that depend on more than one field. Runs on the merged result, so updates are checked too. */
function assertRules(fields: CouponFields): void {
  const value = new Prisma.Decimal(fields.value);
  if (value.lte(0)) throw invalid('value must be greater than 0');
  if (fields.type === CouponType.PERCENTAGE && value.gt(100)) {
    throw invalid('A percentage coupon cannot be more than 100');
  }
  if (fields.minimumOrderAmount !== null && new Prisma.Decimal(fields.minimumOrderAmount).lte(0)) {
    throw invalid('minimumOrderAmount must be greater than 0');
  }
  if (fields.maximumDiscount !== null) {
    if (fields.type !== CouponType.PERCENTAGE) {
      throw invalid('maximumDiscount applies to percentage coupons only');
    }
    if (new Prisma.Decimal(fields.maximumDiscount).lte(0)) {
      throw invalid('maximumDiscount must be greater than 0');
    }
  }
  if (
    fields.startsAt !== null &&
    fields.expiresAt !== null &&
    fields.expiresAt.getTime() <= fields.startsAt.getTime()
  ) {
    throw invalid('expiresAt must be after startsAt');
  }
}

function notFound(): NotFoundException {
  return new NotFoundException({ message: 'Coupon not found', code: 'COUPON_NOT_FOUND' });
}

function isCodeCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    String(error.meta?.target ?? '').includes('code')
  );
}

function codeTaken(): ConflictException {
  return new ConflictException({
    message: 'This coupon code is already in use',
    code: 'COUPON_CODE_TAKEN',
  });
}

@Injectable()
export class AdminCouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async list(query: CouponQueryDto) {
    const { skip, take } = toSkipTake(query.page, query.limit);
    const where: Prisma.CouponWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { code: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        select: couponSelect,
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return { data: rows.map(toView), meta: buildPaginationMeta(query.page, query.limit, total) };
  }

  async findOne(id: string) {
    const row = await this.prisma.coupon.findUnique({ where: { id }, select: couponSelect });
    if (!row) throw notFound();
    return toView(row);
  }

  async create(adminId: string, dto: CreateCouponDto, ipAddress: string | null) {
    assertRules({
      type: dto.type,
      value: dto.value,
      minimumOrderAmount: dto.minimumOrderAmount ?? null,
      maximumDiscount: dto.maximumDiscount ?? null,
      startsAt: dto.startsAt ?? null,
      expiresAt: dto.expiresAt ?? null,
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.coupon.create({
          data: {
            code: dto.code,
            type: dto.type,
            value: dto.value,
            minimumOrderAmount: dto.minimumOrderAmount ?? null,
            maximumDiscount: dto.maximumDiscount ?? null,
            usageLimit: dto.usageLimit ?? null,
            perUserLimit: dto.perUserLimit ?? null,
            startsAt: dto.startsAt ?? null,
            expiresAt: dto.expiresAt ?? null,
            status: dto.status ?? ActiveStatus.ACTIVE,
          },
          select: couponSelect,
        });
        await this.activityLogs.record(tx, {
          adminId,
          action: ACTIVITY_ACTIONS.couponCreated,
          entityType: 'Coupon',
          entityId: created.id,
          ipAddress,
          metadata: { code: created.code, type: created.type, value: created.value.toFixed(2) },
        });
        return toView(created);
      }, TX_OPTIONS);
    } catch (error) {
      if (isCodeCollision(error)) throw codeTaken();
      throw error;
    }
  }

  /** Locks the coupon row first, so an update never races with an order using the same coupon. */
  async update(adminId: string, id: string, dto: UpdateCouponDto, ipAddress: string | null) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "coupons" WHERE id = ${id} FOR UPDATE`;
        const current = await tx.coupon.findUnique({ where: { id }, select: couponSelect });
        if (!current) throw notFound();

        const changesIdentity =
          (dto.code !== undefined && dto.code !== current.code) ||
          (dto.type !== undefined && dto.type !== current.type);
        if (current.usedCount > 0 && changesIdentity) {
          throw new ConflictException({
            message: 'The code and type cannot be changed after the coupon has been used',
            code: 'COUPON_LOCKED',
          });
        }

        assertRules({
          type: dto.type ?? current.type,
          value: dto.value ?? current.value.toFixed(2),
          minimumOrderAmount:
            dto.minimumOrderAmount !== undefined
              ? dto.minimumOrderAmount
              : dec(current.minimumOrderAmount),
          maximumDiscount:
            dto.maximumDiscount !== undefined ? dto.maximumDiscount : dec(current.maximumDiscount),
          startsAt: dto.startsAt !== undefined ? dto.startsAt : current.startsAt,
          expiresAt: dto.expiresAt !== undefined ? dto.expiresAt : current.expiresAt,
        });

        const updated = await tx.coupon.update({
          where: { id },
          data: {
            code: dto.code,
            type: dto.type,
            value: dto.value,
            minimumOrderAmount: dto.minimumOrderAmount,
            maximumDiscount: dto.maximumDiscount,
            usageLimit: dto.usageLimit,
            perUserLimit: dto.perUserLimit,
            startsAt: dto.startsAt,
            expiresAt: dto.expiresAt,
          },
          select: couponSelect,
        });
        await this.activityLogs.record(tx, {
          adminId,
          action: ACTIVITY_ACTIONS.couponUpdated,
          entityType: 'Coupon',
          entityId: id,
          ipAddress,
          metadata: {
            code: updated.code,
            changedFields: Object.entries(dto)
              .filter(([, v]) => v !== undefined)
              .map(([k]) => k),
          },
        });
        return toView(updated);
      }, TX_OPTIONS);
    } catch (error) {
      if (isCodeCollision(error)) throw codeTaken();
      throw error;
    }
  }

  async setStatus(adminId: string, id: string, status: ActiveStatus, ipAddress: string | null) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "coupons" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.coupon.findUnique({
        where: { id },
        select: { id: true, code: true, status: true },
      });
      if (!current) throw notFound();
      const updated = await tx.coupon.update({
        where: { id },
        data: { status },
        select: couponSelect,
      });
      await this.activityLogs.record(tx, {
        adminId,
        action: ACTIVITY_ACTIONS.couponStatusChanged,
        entityType: 'Coupon',
        entityId: id,
        ipAddress,
        metadata: { code: current.code, fromStatus: current.status, toStatus: status },
      });
      return toView(updated);
    }, TX_OPTIONS);
  }

  /** Only a coupon that was never used can be deleted; otherwise deactivate it. */
  async remove(adminId: string, id: string, ipAddress: string | null) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "coupons" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.coupon.findUnique({
        where: { id },
        select: { id: true, code: true, usedCount: true },
      });
      if (!current) throw notFound();
      const usageRows = await tx.couponUsage.count({ where: { couponId: id } });
      if (current.usedCount > 0 || usageRows > 0) {
        throw new ConflictException({
          message: 'This coupon has been used. Deactivate it instead of deleting it',
          code: 'COUPON_IN_USE',
        });
      }
      await tx.coupon.delete({ where: { id } });
      await this.activityLogs.record(tx, {
        adminId,
        action: ACTIVITY_ACTIONS.couponDeleted,
        entityType: 'Coupon',
        entityId: id,
        ipAddress,
        metadata: { code: current.code },
      });
      return { id, deleted: true };
    }, TX_OPTIONS);
  }
}

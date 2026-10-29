import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { buildPaginationMeta, toSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  createdAt: true,
  _count: { select: { orders: true } },
  orders: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
} satisfies Prisma.UserSelect;

type CustomerRow = Prisma.UserGetPayload<{ select: typeof customerSelect }>;

function toView(row: CustomerRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.createdAt,
    orderCount: row._count.orders,
    lastOrderAt: row.orders[0]?.createdAt ?? null,
  };
}

function notFound(): NotFoundException {
  return new NotFoundException({ message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
}

/**
 * Admin view of customer accounts. Only role CUSTOMER is listed or changed here, so an admin
 * can never suspend another admin (or themself) through this API.
 */
@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async list(query: AdminCustomerQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: Role.CUSTOMER,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query.page, query.limit),
        select: customerSelect,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data: rows.map(toView), meta: buildPaginationMeta(query.page, query.limit, total) };
  }

  /**
   * Suspend or reactivate. Suspending also revokes every refresh token, so the customer is signed
   * out everywhere; the per-request check (D29) refuses any still-valid access token right away.
   */
  async setStatus(
    adminId: string,
    id: string,
    dto: UpdateCustomerStatusDto,
    ipAddress: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id, role: Role.CUSTOMER },
        select: { id: true, email: true, status: true },
      });
      if (!user) throw notFound();

      if (user.status !== dto.status) {
        await tx.user.update({ where: { id }, data: { status: dto.status } });
        if (dto.status === UserStatus.SUSPENDED) {
          await tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        await this.activityLogs.record(tx, {
          adminId,
          action:
            dto.status === UserStatus.SUSPENDED
              ? ACTIVITY_ACTIONS.customerSuspended
              : ACTIVITY_ACTIONS.customerReactivated,
          entityType: 'User',
          entityId: id,
          ipAddress,
          metadata: { email: user.email, ...(dto.reason ? { reason: dto.reason } : {}) },
        });
      }

      const row = await tx.user.findUniqueOrThrow({ where: { id }, select: customerSelect });
      return toView(row);
    });
  }
}

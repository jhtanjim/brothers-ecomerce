import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { formatCents, toCents } from '../common/utils/money';
import { buildPaginationMeta, toSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto, MemberQueryDto } from './dto/member.dto';
import { phoneVariants } from './phone-variants';

const memberSelect = {
  id: true,
  number: true,
  name: true,
  phone: true,
  active: true,
  createdAt: true,
} satisfies Prisma.MemberSelect;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async list(query: MemberQueryDto) {
    const { skip, take } = toSkipTake(query.page, query.limit);
    const where: Prisma.MemberWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        orderBy: { number: 'desc' },
        skip,
        take,
        select: memberSelect,
      }),
      this.prisma.member.count({ where }),
    ]);
    const totals = await this.prisma.order.groupBy({
      by: ['memberId'],
      where: {
        memberId: { in: rows.map((row) => row.id) },
        paymentStatus: PaymentStatus.APPROVED,
        status: { not: OrderStatus.CANCELLED },
      },
      _count: true,
      _sum: { totalAmount: true },
    });
    return {
      data: rows.map((row) => {
        const entry = totals.find((item) => item.memberId === row.id);
        return {
          ...row,
          purchaseCount: entry?._count ?? 0,
          totalSpent: formatCents(toCents(entry?._sum.totalAmount ?? 0)),
        };
      }),
      meta: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async create(adminId: string, dto: CreateMemberDto) {
    const variants = phoneVariants(dto.phone);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const used = await tx.member.findFirst({
          where: { phone: { in: variants } },
          select: { id: true },
        });
        if (used) throw this.phoneUsed();
        const member = await tx.member.create({
          data: { name: dto.name, phone: variants[0] ?? dto.phone },
          select: memberSelect,
        });
        await this.activityLogs.record(tx, {
          adminId,
          action: ACTIVITY_ACTIONS.memberAdded,
          entityType: 'Member',
          entityId: member.id,
          metadata: { number: member.number },
        });
        return member;
      });
    } catch (error) {
      // Two people added the same number at once: the unique index stopped the second.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.phoneUsed();
      }
      throw error;
    }
  }

  async setActive(adminId: string, id: string, active: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.member.findUnique({ where: { id }, select: { id: true } });
      if (!found) {
        throw new NotFoundException({ message: 'Member not found', code: 'MEMBER_NOT_FOUND' });
      }
      const member = await tx.member.update({
        where: { id },
        data: { active },
        select: memberSelect,
      });
      await this.activityLogs.record(tx, {
        adminId,
        action: ACTIVITY_ACTIONS.memberUpdated,
        entityType: 'Member',
        entityId: id,
        metadata: { active },
      });
      return member;
    });
  }

  private phoneUsed(): ConflictException {
    return new ConflictException({
      message: 'This phone number is already a member',
      code: 'MEMBER_PHONE_USED',
    });
  }
}

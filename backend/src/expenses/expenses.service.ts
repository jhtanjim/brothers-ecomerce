import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { formatCents, toCents } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateCashDayDto } from './dto/expense.dto';

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

const expenseSelect = {
  id: true,
  day: true,
  category: true,
  description: true,
  amount: true,
  paidFromDrawer: true,
  createdAt: true,
} satisfies Prisma.ExpenseSelect;

type ExpenseRow = Prisma.ExpenseGetPayload<{ select: typeof expenseSelect }>;

function toView(row: ExpenseRow) {
  return { ...row, amount: formatCents(toCents(row.amount)) };
}

/** The format check allows dates like 2026-02-31, and money cannot be recorded in the future. */
function assertUsableDay(day: string): void {
  const parsed = new Date(`${day}T00:00:00.000Z`);
  const real = !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
  const today = new Date(Date.now() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
  if (!real || day > today) {
    throw new BadRequestException({
      message: 'Choose today or a past date',
      code: 'INVALID_DAY',
    });
  }
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async listForDay(day: string) {
    const rows = await this.prisma.expense.findMany({
      where: { day },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: expenseSelect,
    });
    return rows.map(toView);
  }

  async create(adminId: string, dto: CreateExpenseDto, ipAddress: string | null) {
    assertUsableDay(dto.date);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          day: dto.date,
          category: dto.category,
          description: dto.description || null,
          amount: dto.amount,
          paidFromDrawer: dto.paidFromDrawer,
          adminId,
        },
        select: expenseSelect,
      });
      await this.activityLogs.record(tx, {
        adminId,
        action: ACTIVITY_ACTIONS.expenseAdded,
        entityType: 'Expense',
        entityId: created.id,
        metadata: { day: dto.date, category: dto.category, amount: dto.amount },
        ipAddress,
      });
      return created;
    });
    return toView(row);
  }

  /** For fixing a mistake. The activity log keeps what was removed. */
  async remove(adminId: string, id: string, ipAddress: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.expense.findUnique({ where: { id }, select: expenseSelect });
      if (!row) {
        throw new NotFoundException({ message: 'Expense not found', code: 'EXPENSE_NOT_FOUND' });
      }
      await tx.expense.delete({ where: { id } });
      await this.activityLogs.record(tx, {
        adminId,
        action: ACTIVITY_ACTIONS.expenseDeleted,
        entityType: 'Expense',
        entityId: id,
        metadata: {
          day: row.day,
          category: row.category,
          amount: formatCents(toCents(row.amount)),
        },
        ipAddress,
      });
    });
  }

  async updateCashDay(adminId: string, day: string, dto: UpdateCashDayDto) {
    assertUsableDay(day);
    const data = {
      ...(dto.openingCash !== undefined ? { openingCash: dto.openingCash } : {}),
      ...(dto.countedCash !== undefined ? { countedCash: dto.countedCash } : {}),
      updatedById: adminId,
    };
    await this.prisma.cashDay.upsert({
      where: { day },
      create: { day, ...data },
      update: data,
    });
  }
}

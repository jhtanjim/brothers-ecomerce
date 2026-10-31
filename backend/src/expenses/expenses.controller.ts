import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CashDayParamDto,
  CreateExpenseDto,
  ExpenseQueryDto,
  UpdateCashDayDto,
} from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */
@Roles(Role.ADMIN)
@Controller('admin')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get('expenses')
  list(@Query() query: ExpenseQueryDto) {
    return this.expenses.listForDay(query.date);
  }

  @Post('expenses')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExpenseDto, @Req() request: Request) {
    return this.expenses.create(user.sub, dto, request.ip ?? null);
  }

  @Delete('expenses/:id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.expenses.remove(user.sub, id, request.ip ?? null);
  }

  @Put('cash-days/:date')
  async updateCashDay(
    @CurrentUser() user: JwtPayload,
    @Param() params: CashDayParamDto,
    @Body() dto: UpdateCashDayDto,
  ): Promise<void> {
    await this.expenses.updateCashDay(user.sub, params.date, dto);
  }
}

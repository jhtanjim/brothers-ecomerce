import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminPaymentQueryDto } from './dto/admin-payment-query.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';

/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). :id is the submission under review. */
@Roles(Role.ADMIN)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly adminPayments: AdminPaymentsService) {}

  @Get()
  list(@Query() query: AdminPaymentQueryDto) {
    return this.adminPayments.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminPayments.findOne(id);
  }

  @Patch(':id/approve')
  approve(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Req() request: Request) {
    return this.adminPayments.approve(user.sub, id, request.ip ?? null);
  }

  @Patch(':id/reject')
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectPaymentDto,
    @Req() request: Request,
  ) {
    return this.adminPayments.reject(user.sub, id, dto, request.ip ?? null);
  }
}

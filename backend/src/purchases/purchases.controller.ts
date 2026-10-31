import { Body, Controller, Get, Headers, Post, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { parseIdempotencyKey } from '../orders/idempotency-key';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';

/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */
@Roles(Role.ADMIN)
@Controller('admin/purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.purchases.list(query);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePurchaseDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.purchases.create(
      user.sub,
      dto,
      parseIdempotencyKey(idempotencyKey),
      request.ip ?? null,
    );
  }
}

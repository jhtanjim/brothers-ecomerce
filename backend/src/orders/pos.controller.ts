import { Body, Controller, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePosSaleDto, VoidPosSaleDto } from './dto/create-pos-sale.dto';
import { parseIdempotencyKey } from './idempotency-key';
import { PosService } from './pos.service';

/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */
@Roles(Role.ADMIN)
@Controller('admin/pos/sales')
export class PosController {
  constructor(private readonly pos: PosService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePosSaleDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.pos.createSale(user.sub, dto, parseIdempotencyKey(idempotencyKey));
  }

  @Patch(':id/void')
  void(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: VoidPosSaleDto,
    @Req() request: Request,
  ) {
    return this.pos.voidSale(user.sub, id, dto.reason, request.ip ?? null);
  }
}

import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateReturnDto } from './dto/create-return.dto';
import { parseIdempotencyKey } from './idempotency-key';
import { ReturnsService } from './returns.service';

/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */
@Roles(Role.ADMIN)
@Controller('admin')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post('orders/:id/returns')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateReturnDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.returns.create(
      user.sub,
      id,
      dto,
      parseIdempotencyKey(idempotencyKey),
      request.ip ?? null,
    );
  }

  @Get('returns/:id')
  findOne(@Param('id') id: string) {
    return this.returns.findOne(id);
  }
}

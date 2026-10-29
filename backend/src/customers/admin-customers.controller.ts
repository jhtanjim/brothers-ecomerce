import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminCustomersService } from './admin-customers.service';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';

/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */
@Roles(Role.ADMIN)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  list(@Query() query: AdminCustomerQueryDto) {
    return this.customers.list(query);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerStatusDto,
    @Req() request: Request,
  ) {
    return this.customers.setStatus(user.sub, id, dto, request.ip ?? null);
  }
}

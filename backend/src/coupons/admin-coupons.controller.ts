import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminCouponsService } from './admin-coupons.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponStatusDto } from './dto/update-coupon-status.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */
@Roles(Role.ADMIN)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly adminCoupons: AdminCouponsService) {}

  @Get()
  list(@Query() query: CouponQueryDto) {
    return this.adminCoupons.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminCoupons.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCouponDto, @Req() request: Request) {
    return this.adminCoupons.create(user.sub, dto, request.ip ?? null);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @Req() request: Request,
  ) {
    return this.adminCoupons.update(user.sub, id, dto, request.ip ?? null);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCouponStatusDto,
    @Req() request: Request,
  ) {
    return this.adminCoupons.setStatus(user.sub, id, dto.status, request.ip ?? null);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Req() request: Request) {
    return this.adminCoupons.remove(user.sub, id, request.ip ?? null);
  }
}

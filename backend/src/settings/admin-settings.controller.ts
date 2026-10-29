import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */
@Roles(Role.ADMIN)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly adminSettings: AdminSettingsService) {}

  @Get()
  get() {
    return this.adminSettings.get();
  }

  @Patch()
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateSettingsDto, @Req() request: Request) {
    return this.adminSettings.update(user.sub, dto, request.ip ?? null);
  }
}

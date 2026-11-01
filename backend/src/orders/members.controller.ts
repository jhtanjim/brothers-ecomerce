import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateMemberDto, MemberQueryDto, UpdateMemberDto } from './dto/member.dto';
import { MembersService } from './members.service';

/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */
@Roles(Role.ADMIN)
@Controller('admin/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@Query() query: MemberQueryDto) {
    return this.members.list(query);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMemberDto) {
    return this.members.create(user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.members.setActive(user.sub, id, dto.active);
  }
}

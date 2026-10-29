import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { SalesQueryDto } from './dto/sales-query.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';

/** Admin-only, read-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */
@Roles(Role.ADMIN)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  overview() {
    return this.dashboard.overview();
  }

  @Get('sales')
  sales(@Query() query: SalesQueryDto) {
    return this.dashboard.sales(query.days);
  }

  @Get('top-products')
  topProducts(@Query() query: TopProductsQueryDto) {
    return this.dashboard.topProducts(query.limit);
  }
}

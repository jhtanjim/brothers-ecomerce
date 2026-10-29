import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';

@Module({
  imports: [ActivityLogsModule],
  controllers: [AdminCustomersController],
  providers: [AdminCustomersService],
})
export class CustomersModule {}

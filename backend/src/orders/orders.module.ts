import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { SettingsModule } from '../settings/settings.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderExpiryService } from './order-expiry.service';
import { OrderQuoteService } from './order-quote.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [SettingsModule, UploadsModule, ActivityLogsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [
    OrdersService,
    OrderCancellationService,
    OrderExpiryService,
    OrderQuoteService,
    AdminOrdersService,
  ],
  exports: [OrdersService, OrderCancellationService],
})
export class OrdersModule {}

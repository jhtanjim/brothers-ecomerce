import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { SettingsModule } from '../settings/settings.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPaymentsService } from './admin-payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [SettingsModule, UploadsModule, ActivityLogsModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, AdminPaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

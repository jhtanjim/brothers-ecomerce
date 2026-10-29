import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';
import { SettingsService } from './settings.service';

@Module({
  imports: [ActivityLogsModule],
  controllers: [AdminSettingsController],
  providers: [SettingsService, AdminSettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

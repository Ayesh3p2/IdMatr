import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { InternalSettingsController } from './internal-settings.controller.js';
import { SecurityModule } from '../security/security.module.js';

@Module({
  imports: [SecurityModule],
  controllers: [InternalSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

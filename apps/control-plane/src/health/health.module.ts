import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PublicHealthController } from './public-health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  controllers: [HealthController, PublicHealthController],
  providers: [HealthService],
})
export class HealthModule {}

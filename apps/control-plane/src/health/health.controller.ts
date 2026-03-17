import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HealthService } from './health.service.js';

@Controller('control/system')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get('health')
  ping() {
    return { status: 'ok', service: 'control-plane', timestamp: new Date().toISOString() };
  }

  @Get('overview')
  @UseGuards(AuthGuard('jwt'))
  getOverview() {
    return this.health.getOverview();
  }
}

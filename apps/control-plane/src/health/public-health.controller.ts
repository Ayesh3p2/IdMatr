import { Controller, Get, Header, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class PublicHealthController {
  constructor(private health: HealthService) {}

  @Get()
  @Header('Content-Type', 'application/json')
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    return {
      status: 'healthy',
      service: 'idmatr-control-plane',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @Header('Content-Type', 'application/json')
  @HttpCode(HttpStatus.OK)
  async getLiveness() {
    return this.health.getLiveness();
  }

  @Get('ready')
  @Header('Content-Type', 'application/json')
  @HttpCode(HttpStatus.OK)
  async getReadiness() {
    return this.health.getReadiness();
  }
}

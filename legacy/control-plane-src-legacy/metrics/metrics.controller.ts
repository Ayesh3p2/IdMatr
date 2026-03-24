import { Controller, Get, Header, HttpCode } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  @HttpCode(200)
  async getMetrics() {
    return this.metrics.getMetrics();
  }

  @Get('prometheus')
  @Header('Content-Type', 'text/plain')
  @HttpCode(200)
  async getPrometheusMetrics() {
    return this.metrics.getMetrics();
  }

  @Get('health')
  @Header('Content-Type', 'application/json')
  @HttpCode(200)
  async getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}

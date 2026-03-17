import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'discovery-service' };
  }

  @MessagePattern({ cmd: 'get_all_apps' })
  async getAllApps(@Payload() data: { tenantId: string }) {
    return this.appService.getAllApps(data.tenantId);
  }

  @MessagePattern({ cmd: 'trigger_scan' })
  async triggerScan(@Payload() data: { tenantId: string; source?: string }) {
    return this.appService.triggerScan(data);
  }

  @MessagePattern({ cmd: 'get_app_intelligence' })
  async getAppIntelligence(@Payload() data: { tenantId: string }) {
    return this.appService.getAppIntelligence(data.tenantId);
  }
}

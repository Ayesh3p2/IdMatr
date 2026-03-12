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
  async getAllApps() {
    return this.appService.getAllApps();
  }

  @MessagePattern({ cmd: 'trigger_scan' })
  async triggerScan(@Payload() data: any) {
    return this.appService.triggerScan(data);
  }
}

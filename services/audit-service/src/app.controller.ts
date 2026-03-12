import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'audit-service' };
  }

  @MessagePattern({ cmd: 'log_action' })
  async logAction(@Payload() data: any) {
    return this.appService.logAction(data);
  }

  @MessagePattern({ cmd: 'get_audit_logs' })
  async getAuditLogs(@Payload() filters: any) {
    return this.appService.getLogs(filters);
  }
}

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: 'log_action' })
  async logAction(@Payload() data: any) {
    return this.appService.logAction(data);
  }

  @MessagePattern({ cmd: 'get_audit_logs' })
  async getAuditLogs(@Payload() filters: any) {
    return this.appService.getLogs(filters);
  }
}

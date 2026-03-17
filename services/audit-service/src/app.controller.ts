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
  async getAuditLogs(@Payload() data: { tenantId: string; filters?: any }) {
    return this.appService.getLogs(data.tenantId, data.filters || {});
  }

  @Get('verify')
  verifyIntegrity() {
    return this.appService.verifyIntegrity();
  }

  @MessagePattern({ cmd: 'verify_audit_logs' })
  async verifyAuditLogs(@Payload() data: { tenantId?: string }) {
    return this.appService.verifyIntegrity(data.tenantId);
  }
}

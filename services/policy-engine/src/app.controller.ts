import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'policy-engine' };
  }

  @MessagePattern({ cmd: 'check_policy' })
  async checkPolicy(@Payload() data: { tenantId: string; userId: string; resource: string; action: string }) {
    return this.appService.checkPolicy(data);
  }

  @MessagePattern({ cmd: 'get_policies' })
  async getPolicies(@Payload() data: { tenantId: string }) {
    return this.appService.getPolicies(data.tenantId);
  }

  @MessagePattern({ cmd: 'get_policy_violations' })
  async getPolicyViolations(@Payload() data: { tenantId: string }) {
    return this.appService.getPolicyViolations(data.tenantId);
  }
}

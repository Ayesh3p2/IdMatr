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
  async checkPolicy(@Payload() data: { userId: string; resource: string; action: string }) {
    return this.appService.checkPolicy(data);
  }

  @MessagePattern({ cmd: 'get_policies' })
  async getPolicies() {
    return this.appService.getPolicies();
  }

  @MessagePattern({ cmd: 'get_policy_violations' })
  async getPolicyViolations() {
    return this.appService.getPolicyViolations();
  }
}

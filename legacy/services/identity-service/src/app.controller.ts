import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'identity-service' };
  }

  @MessagePattern({ cmd: 'get_all_identities' })
  async getAllIdentities(@Payload() data: { tenantId: string }) {
    return this.appService.getAllIdentities(data.tenantId);
  }

  @MessagePattern({ cmd: 'get_identity' })
  async getIdentity(@Payload() data: { tenantId: string; id: string }) {
    return this.appService.getIdentity(data.tenantId, data.id);
  }

  @MessagePattern({ cmd: 'create_user' })
  async createUser(@Payload() data: { tenantId: string; [key: string]: any }) {
    const { tenantId, ...userData } = data;
    return this.appService.createUser(tenantId, userData);
  }

  @MessagePattern({ cmd: 'update_user_risk' })
  async updateUserRisk(@Payload() data: { tenantId: string; id: string; score: number }) {
    return this.appService.updateUserRisk(data.tenantId, data.id, data.score);
  }

  @MessagePattern({ cmd: 'get_identity_analytics' })
  async getIdentityAnalytics(@Payload() data: { tenantId: string }) {
    return this.appService.getIdentityAnalytics(data.tenantId);
  }
}

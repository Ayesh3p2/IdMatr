import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'graph-service' };
  }

  @MessagePattern({ cmd: 'get_identity_graph' })
  async getIdentityGraph(@Payload() data: { id: string; tenantId: string }) {
    return this.appService.getIdentityGraph(data.tenantId, data.id);
  }

  @MessagePattern({ cmd: 'get_toxic_combinations' })
  async getToxicCombinations(@Payload() data: { tenantId: string }) {
    return this.appService.getToxicCombinations(data.tenantId);
  }

  @MessagePattern({ cmd: 'get_attack_paths' })
  async getAttackPaths(@Payload() data: { tenantId: string }) {
    return this.appService.getAttackPaths(data.tenantId);
  }

  @MessagePattern({ cmd: 'get_privilege_creep' })
  async getPrivilegeCreep(@Payload() data: { tenantId: string }) {
    return this.appService.getPrivilegeCreep(data.tenantId);
  }

  @MessagePattern({ cmd: 'get_stale_access' })
  async getStaleAccess(@Payload() data: { tenantId: string; staleDays?: number }) {
    return this.appService.getStaleAccess(data.tenantId, data.staleDays);
  }

  @MessagePattern({ cmd: 'get_identity_risk_recommendations' })
  async getIdentityRiskRecommendations(@Payload() data: { tenantId: string }) {
    return this.appService.getIdentityRiskRecommendations(data.tenantId);
  }
}

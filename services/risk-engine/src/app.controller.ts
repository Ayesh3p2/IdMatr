import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'risk-engine' };
  }

  @MessagePattern({ cmd: 'get_all_risk_scores' })
  async getRiskScores(@Payload() data: { tenantId: string }) {
    return this.appService.getRiskScores(data.tenantId);
  }

  @MessagePattern({ cmd: 'get_all_risk_events' })
  async getRiskEvents(@Payload() data: { tenantId: string }) {
    return this.appService.getRiskEvents(data.tenantId);
  }

  @MessagePattern({ cmd: 'get_itdr_threats' })
  async getITDRThreats(@Payload() data: { tenantId: string }) {
    return this.appService.getITDRThreats(data.tenantId);
  }

  @MessagePattern({ cmd: 'respond_to_threat' })
  async respondToThreat(@Payload() data: { tenantId: string; id: string; action: string; notes?: string }) {
    return this.appService.respondToThreat(data.tenantId, data.id, data.action, data.notes);
  }

  @MessagePattern({ cmd: 'get_risk_trends' })
  async getRiskTrends(@Payload() data: { tenantId: string }) {
    return this.appService.getRiskTrends(data.tenantId);
  }

  @MessagePattern({ cmd: 'calculate_risk' })
  async calculateRisk(@Payload() data: { tenantId: string; targetId: string; targetType: string }) {
    return this.appService.calculateRisk(data.tenantId, data.targetId, data.targetType);
  }

  @MessagePattern({ cmd: 'detect_itdr_patterns' })
  async detectITDRPatterns(@Payload() data: { tenantId: string; userId: string }) {
    return this.appService.detectITDRPatterns(data.tenantId, data.userId);
  }
}

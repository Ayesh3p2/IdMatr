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
  async getRiskScores() {
    return this.appService.getRiskScores();
  }

  @MessagePattern({ cmd: 'get_all_risk_events' })
  async getRiskEvents() {
    return this.appService.getRiskEvents();
  }

  @MessagePattern({ cmd: 'get_itdr_threats' })
  async getITDRThreats() {
    return this.appService.getITDRThreats();
  }

  @MessagePattern({ cmd: 'respond_to_threat' })
  async respondToThreat(@Payload() data: { id: string; action: string; notes?: string }) {
    return this.appService.respondToThreat(data.id, data.action, data.notes);
  }

  @MessagePattern({ cmd: 'get_risk_trends' })
  async getRiskTrends() {
    return this.appService.getRiskTrends();
  }

  @MessagePattern({ cmd: 'calculate_risk' })
  async calculateRisk(@Payload() data: { targetId: string; targetType: string }) {
    return this.appService.calculateRisk(data.targetId, data.targetType);
  }

  @MessagePattern({ cmd: 'detect_itdr_patterns' })
  async detectITDRPatterns(@Payload() data: { userId: string }) {
    return this.appService.detectITDRPatterns(data.userId);
  }
}

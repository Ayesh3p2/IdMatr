import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: 'get_all_risk_scores' })
  async getRiskScores() {
    return this.appService.getRiskScores();
  }

  @MessagePattern({ cmd: 'get_all_risk_events' })
  async getRiskEvents() {
    return this.appService.getRiskEvents();
  }
}

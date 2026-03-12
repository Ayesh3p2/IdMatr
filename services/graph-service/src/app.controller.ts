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
  async getIdentityGraph(@Payload() data: { id: string }) {
    return this.appService.getIdentityGraph(data.id);
  }

  @MessagePattern({ cmd: 'get_toxic_combinations' })
  async getToxicCombinations() {
    return this.appService.getToxicCombinations();
  }

  @MessagePattern({ cmd: 'get_attack_paths' })
  async getAttackPaths() {
    return this.appService.getAttackPaths();
  }
}

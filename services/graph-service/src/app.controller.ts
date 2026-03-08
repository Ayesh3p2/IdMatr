import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: 'get_identity_graph' })
  async getIdentityGraph(@Payload() data: { id: string }) {
    return this.appService.getIdentityGraph(data.id);
  }
}

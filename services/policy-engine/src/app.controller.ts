import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: 'check_policy' })
  async checkPolicy(@Payload() data: { userId: string; resource: string; action: string }) {
    return this.appService.checkPolicy(data);
  }

  @MessagePattern({ cmd: 'get_policies' })
  async getPolicies() {
    return this.appService.getPolicies();
  }
}

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: 'get_all_identities' })
  async getAllIdentities() {
    return this.appService.getAllIdentities();
  }

  @MessagePattern({ cmd: 'get_identity' })
  async getIdentity(@Payload() data: { id: string }) {
    return this.appService.getIdentity(data.id);
  }

  @MessagePattern({ cmd: 'create_user' })
  async createUser(@Payload() data: any) {
    return this.appService.createUser(data);
  }

  @MessagePattern({ cmd: 'update_user_risk' })
  async updateUserRisk(@Payload() data: { id: string; score: number }) {
    return this.appService.updateUserRisk(data.id, data.score);
  }
}

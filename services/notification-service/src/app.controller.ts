import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: 'send_notification' })
  async sendNotification(@Payload() data: { type: string; recipient: string; content: string }) {
    return this.appService.sendNotification(data);
  }
}

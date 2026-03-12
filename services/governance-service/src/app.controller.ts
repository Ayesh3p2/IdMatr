import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'governance-service' };
  }

  @MessagePattern({ cmd: 'get_all_workflows' })
  async getAllWorkflows() {
    return this.appService.getAllWorkflows();
  }

  @MessagePattern({ cmd: 'create_workflow' })
  async createWorkflow(@Payload() data: any) {
    return this.appService.createWorkflow(data);
  }

  @MessagePattern({ cmd: 'update_workflow' })
  async updateWorkflow(@Payload() data: any) {
    return this.appService.updateWorkflow(data.id, data.action, data.approverId, data.comment);
  }

  @MessagePattern({ cmd: 'get_jml_events' })
  async getJMLEvents() {
    return this.appService.getJMLEvents();
  }

  @MessagePattern({ cmd: 'create_jml_event' })
  async createJMLEvent(@Payload() data: any) {
    return this.appService.createJMLEvent(data);
  }
}

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
  async getAllWorkflows(@Payload() data: { tenantId: string }) {
    return this.appService.getAllWorkflows(data.tenantId);
  }

  @MessagePattern({ cmd: 'create_workflow' })
  async createWorkflow(@Payload() data: { tenantId: string; [key: string]: any }) {
    const { tenantId, ...rest } = data;
    return this.appService.createWorkflow(tenantId, rest);
  }

  @MessagePattern({ cmd: 'update_workflow' })
  async updateWorkflow(@Payload() data: { tenantId: string; id: string; action: string; approverId: string; comment?: string }) {
    return this.appService.updateWorkflow(data.tenantId, data.id, data.action, data.approverId, data.comment);
  }

  @MessagePattern({ cmd: 'get_jml_events' })
  async getJMLEvents(@Payload() data: { tenantId: string }) {
    return this.appService.getJMLEvents(data.tenantId);
  }

  @MessagePattern({ cmd: 'create_jml_event' })
  async createJMLEvent(@Payload() data: { tenantId: string; [key: string]: any }) {
    const { tenantId, ...rest } = data;
    return this.appService.createJMLEvent(tenantId, rest);
  }
}

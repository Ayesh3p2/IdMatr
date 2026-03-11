import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
}

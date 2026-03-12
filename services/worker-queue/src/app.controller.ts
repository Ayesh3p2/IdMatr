import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'worker-queue' };
  }

  @MessagePattern({ cmd: 'enqueue_job' })
  async enqueueJob(@Payload() data: { type: string; payload: any }) {
    return this.appService.addJob(data);
  }

  @MessagePattern({ cmd: 'get_job_status' })
  async getJobStatus(@Payload() data: { jobId: string }) {
    return this.appService.getJobStatus(data.jobId);
  }
}

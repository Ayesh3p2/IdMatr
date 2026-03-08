import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private queue: Queue;
  private redis: IORedis;

  onModuleInit() {
    this.redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.queue = new Queue('idmatr-jobs', { connection: this.redis });
    this.logger.log('BullMQ initialized on idmatr-jobs queue');
  }

  async addJob(data: { type: string; payload: any }) {
    this.logger.log(`Enqueuing job: ${data.type}`);
    try {
      const job = await this.queue.add(data.type, data.payload);
      return { jobId: job.id, status: 'enqueued' };
    } catch (error) {
      this.logger.error(`Failed to enqueue job: ${error.message}`);
      throw new RpcException(`Worker Queue error: ${error.message}`);
    }
  }

  async getJobStatus(jobId: string) {
    this.logger.log(`Getting job status: ${jobId}`);
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        throw new RpcException(`Job not found: ${jobId}`);
      }
      const state = await job.getState();
      return { jobId: job.id, status: state, result: job.returnvalue };
    } catch (error) {
      this.logger.error(`Failed to get job status: ${error.message}`);
      if (error instanceof RpcException) throw error;
      throw new RpcException(`Worker Queue error: ${error.message}`);
    }
  }
}

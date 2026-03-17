import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private queue: Queue;
  private queueEvents: QueueEvents;

  onModuleInit() {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL env var is required');
    }
    this.queue = new Queue('idmatr-jobs', { 
      connection: {
        host: new URL(process.env.REDIS_URL).hostname,
        port: parseInt(new URL(process.env.REDIS_URL).port || '6379'),
      }
    });
    this.queueEvents = new QueueEvents('idmatr-jobs', {
      connection: {
        host: new URL(process.env.REDIS_URL).hostname,
        port: parseInt(new URL(process.env.REDIS_URL).port || '6379'),
      }
    });
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

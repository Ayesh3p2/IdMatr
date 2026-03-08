import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllWorkflows() {
    return this.prisma.approvalWorkflow.findMany({
      include: {
        history: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWorkflow(data: any) {
    return this.prisma.approvalWorkflow.create({
      data: {
        requestType: data.requestType,
        requesterId: data.requesterId,
        targetId: data.targetId,
        status: 'pending',
        currentApproverId: data.approverId,
        slaDueDate: new Date(Date.now() + 86400000 * 3), // 3 days default
      },
    });
  }

  async updateWorkflow(id: string, action: string, approverId: string, comment?: string) {
    const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
    
    return this.prisma.approvalWorkflow.update({
      where: { id },
      data: {
        status,
        history: {
          create: {
            approverId,
            action,
            comment,
            timestamp: new Date(),
          },
        },
      },
    });
  }
}

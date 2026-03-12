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

  async getJMLEvents() {
    // Return JML (Joiner/Mover/Leaver) lifecycle events
    // These could be stored in workflows with specific types
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: {
        requestType: { in: ['joiner', 'mover', 'leaver'] },
      },
      orderBy: { id: 'desc' },
      take: 50,
    });

    return workflows.map(w => ({
      id: w.id,
      type: w.requestType,
      userId: w.requesterId,
      targetId: w.targetId,
      status: w.status,
      createdAt: w.id, // Using id as proxy for creation order
      slaDueDate: w.slaDueDate,
    }));
  }

  async createJMLEvent(data: any) {
    return this.prisma.approvalWorkflow.create({
      data: {
        requestType: data.type || 'joiner',
        requesterId: data.userId || 'system',
        targetId: data.targetId || data.userId,
        status: 'pending',
        slaDueDate: data.slaDueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
  }
}

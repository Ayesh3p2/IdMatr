import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllWorkflows(tenantId: string) {
    return this.prisma.approvalWorkflow.findMany({
      where: { tenantId },
      include: { history: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWorkflow(tenantId: string, data: any) {
    return this.prisma.approvalWorkflow.create({
      data: {
        tenantId,
        requestType: data.requestType,
        requesterId: data.requesterId,
        targetId: data.targetId,
        status: 'pending',
        currentApproverId: data.approverId,
        slaDueDate: new Date(Date.now() + 86400000 * 3),
      },
    });
  }

  async updateWorkflow(tenantId: string, id: string, action: string, approverId: string, comment?: string) {
    const existing = await this.prisma.approvalWorkflow.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error(`Workflow ${id} not found for tenant ${tenantId}`);

    const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
    return this.prisma.approvalWorkflow.update({
      where: { id },
      data: {
        status,
        history: {
          create: { approverId, action, comment, timestamp: new Date() },
        },
      },
    });
  }

  async getJMLEvents(tenantId: string) {
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: {
        tenantId,
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
      createdAt: w.createdAt,
      slaDueDate: w.slaDueDate,
    }));
  }

  async createJMLEvent(tenantId: string, data: any) {
    return this.prisma.approvalWorkflow.create({
      data: {
        tenantId,
        requestType: data.type || 'joiner',
        requesterId: data.userId || 'system',
        targetId: data.targetId || data.userId,
        status: 'pending',
        currentApproverId: data.approverId || 'system',
        slaDueDate: data.slaDueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
  }
}

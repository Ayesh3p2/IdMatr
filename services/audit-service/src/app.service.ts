import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(data: any) {
    this.logger.log(`Audit: ${data.action} by ${data.actorId} on ${data.targetId}`);
    return this.prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        actorType: data.actorType || 'user',
        action: data.action,
        targetId: data.targetId,
        targetType: data.targetType,
        status: data.status || 'success',
        details: data.details || {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async getLogs(filters: any) {
    return this.prisma.auditLog.findMany({
      where: filters,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }
}

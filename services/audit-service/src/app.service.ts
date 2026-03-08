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
    this.logger.log(`Fetching audit logs with filters: ${JSON.stringify(filters)}`);
    
    // Explicit filter construction to prevent injection/unexpected behavior
    const where: any = {};
    
    if (filters?.actorId) {
      where.actorId = filters.actorId;
    }
    
    if (filters?.action) {
      where.action = filters.action;
    }

    if (filters?.targetType) {
      where.targetType = filters.targetType;
    }
    
    if (filters?.startDate) {
      where.timestamp = {
        ...where.timestamp,
        gte: new Date(filters.startDate),
      };
    }

    if (filters?.endDate) {
      where.timestamp = {
        ...where.timestamp,
        lte: new Date(filters.endDate),
      };
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }
}

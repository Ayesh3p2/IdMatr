import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async getLogs(filters: {
    tenantId?: string; operatorId?: string; category?: string;
    action?: string; severity?: string; limit?: number; offset?: number;
  }) {
    const where: any = {};
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.operatorId) where.operatorId = filters.operatorId;
    if (filters.category) where.category = filters.category;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.severity) where.severity = filters.severity;

    const [logs, total] = await Promise.all([
      this.prisma.operatorAuditLog.findMany({
        where,
        include: {
          operator: { select: { email: true, name: true } },
          tenant: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.operatorAuditLog.count({ where }),
    ]);

    return { logs, total, limit: filters.limit, offset: filters.offset };
  }

  async verifyIntegrity(tenantId?: string) {
    const logs = await this.prisma.operatorAuditLog.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'asc' },
    });

    let previousHash: string | null = null;
    for (const log of logs) {
      const expectedHash = require('crypto').createHash('sha256').update(JSON.stringify({
        previousHash,
        operatorId: log.operatorId || null,
        tenantId: log.tenantId || null,
        action: log.action,
        category: log.category,
        severity: log.severity || 'info',
        description: log.description,
        metadata: log.metadata || null,
        ipAddress: log.ipAddress || null,
        userAgent: log.userAgent || null,
      })).digest('hex');

      if (expectedHash !== log.entryHash) {
        return {
          valid: false,
          checked: logs.length,
          failedLogId: log.id,
          expectedHash,
          actualHash: log.entryHash,
        };
      }

      previousHash = log.entryHash;
    }

    return { valid: true, checked: logs.length, verifiedAt: new Date().toISOString(), tenantId: tenantId || null };
  }
}

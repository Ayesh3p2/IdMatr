import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(data: any) {
    const tenantId = data.tenantId || 'system';
    this.logger.log(`Audit [${tenantId}]: ${data.action} by ${data.actorId} on ${data.targetId}`);
    const previous = await this.prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
      select: { entryHash: true },
    });
    const details = data.details || {};
    const previousHash = previous?.entryHash || null;
    const entryHash = crypto.createHash('sha256').update(JSON.stringify({
      previousHash,
      tenantId,
      actorId: data.actorId,
      actorType: data.actorType || 'user',
      action: data.action,
      targetId: data.targetId,
      targetType: data.targetType,
      status: data.status || 'success',
      details,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    })).digest('hex');

    const record = await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId: data.actorId,
        actorType: data.actorType || 'user',
        action: data.action,
        targetId: data.targetId,
        targetType: data.targetType,
        status: data.status || 'success',
        details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        previousHash,
        entryHash,
      },
    });

    await this.appendImmutableLedger(record).catch(() => undefined);
    return record;
  }

  async getLogs(tenantId: string, filters: any) {
    this.logger.log(`Fetching audit logs for tenant: ${tenantId}`);

    const where: any = { tenantId };

    if (filters?.actorId) where.actorId = filters.actorId;
    if (filters?.action) where.action = filters.action;
    if (filters?.targetType) where.targetType = filters.targetType;

    if (filters?.startDate) {
      where.timestamp = { ...where.timestamp, gte: new Date(filters.startDate) };
    }
    if (filters?.endDate) {
      where.timestamp = { ...where.timestamp, lte: new Date(filters.endDate) };
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async verifyIntegrity(tenantId?: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { timestamp: 'asc' },
    });

    let previousHash: string | null = null;
    for (const log of logs) {
      const expectedHash = crypto.createHash('sha256').update(JSON.stringify({
        previousHash,
        tenantId: log.tenantId,
        actorId: log.actorId,
        actorType: log.actorType,
        action: log.action,
        targetId: log.targetId,
        targetType: log.targetType,
        status: log.status,
        details: log.details || {},
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

    return {
      valid: true,
      checked: logs.length,
      tenantId: tenantId || null,
      verifiedAt: new Date().toISOString(),
    };
  }

  private async appendImmutableLedger(record: Record<string, any>) {
    const ledgerPath = process.env.IMMUTABLE_AUDIT_SERVICE_PATH || './var/compliance/service-audit-ledger.ndjson';
    await mkdir(dirname(ledgerPath), { recursive: true });
    await appendFile(ledgerPath, `${JSON.stringify(record)}\n`, { encoding: 'utf8' });
  }
}

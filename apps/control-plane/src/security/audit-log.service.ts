import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { mkdir, appendFile } from 'fs/promises';
import { dirname } from 'path';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: {
    operatorId?: string | null;
    tenantId?: string | null;
    action: string;
    category: string;
    severity?: string;
    description: string;
    metadata?: Record<string, any> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    const previous = await this.prisma.operatorAuditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { entryHash: true },
    });

    const metadata = entry.metadata ? JSON.stringify(entry.metadata) : null;
    const previousHash = previous?.entryHash || null;
    const entryHash = crypto.createHash('sha256').update(JSON.stringify({
      previousHash,
      operatorId: entry.operatorId || null,
      tenantId: entry.tenantId || null,
      action: entry.action,
      category: entry.category,
      severity: entry.severity || 'info',
      description: entry.description,
      metadata,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
    })).digest('hex');

    const record = await this.prisma.operatorAuditLog.create({
      data: {
        operatorId: entry.operatorId || null,
        tenantId: entry.tenantId || null,
        action: entry.action,
        category: entry.category,
        severity: entry.severity || 'info',
        description: entry.description,
        metadata,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        previousHash,
        entryHash,
      },
    });

    await this.appendImmutableLedger({
      ...record,
      metadata: metadata ? JSON.parse(metadata) : null,
    }).catch(() => undefined);

    return record;
  }

  async verifyIntegrity(tenantId?: string) {
    const logs = await this.prisma.operatorAuditLog.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'asc' },
    });

    let previousHash: string | null = null;
    for (const log of logs) {
      const expected = crypto.createHash('sha256').update(JSON.stringify({
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

      if (expected !== log.entryHash) {
        return {
          valid: false,
          failedLogId: log.id,
          expectedHash: expected,
          actualHash: log.entryHash,
          checked: logs.length,
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
    const ledgerPath = process.env.IMMUTABLE_AUDIT_LOG_PATH || './var/compliance/operator-audit-ledger.ndjson';
    await mkdir(dirname(ledgerPath), { recursive: true });
    await appendFile(ledgerPath, `${JSON.stringify(record)}\n`, { encoding: 'utf8' });
  }
}

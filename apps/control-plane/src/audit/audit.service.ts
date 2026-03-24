import { Injectable } from '@nestjs/common';
import { EventSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    tenantId: string;
    actorUserId?: string;
    action: string;
    resource: string;
    severity?: EventSeverity;
    metadata?: Record<string, unknown>;
  }) {
    const { tenantId, actorUserId, action, resource, severity, metadata } = params;

    return this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorUserId,
        action,
        resource,
        severity: severity ?? EventSeverity.LOW,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from '../security/audit-log.service.js';
import {
  PublishPrivacyNoticeDto,
  RecordConsentDto,
  SubjectDeletionDto,
  SubjectRectificationDto,
} from '../tenants/dto/privacy.dto.js';

const DEFAULT_RETENTION_SCAN_INTERVAL_MS = 60 * 60 * 1000;
const ONBOARDING_TOKEN_RETENTION_DAYS = 30;
const REQUEST_RETENTION_DAYS = 365;

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async publishNotice(tenantId: string | null, dto: PublishPrivacyNoticeDto, operatorId: string) {
    await this.prisma.$transaction(async (tx) => {
      if (dto.isActive ?? true) {
        await tx.privacyNotice.updateMany({
          where: { tenantId, isActive: true },
          data: { isActive: false },
        });
      }

      await tx.privacyNotice.create({
        data: {
          tenantId,
          version: dto.version,
          title: dto.title,
          content: dto.content,
          isActive: dto.isActive ?? true,
        },
      });
    });

    await this.auditLog.write({
      operatorId,
      tenantId,
      action: 'privacy.notice.published',
      category: 'privacy',
      severity: 'info',
      description: `Privacy notice ${dto.version} published`,
      metadata: { title: dto.title, active: dto.isActive ?? true },
    });

    return this.getActiveNotice(tenantId);
  }

  async getActiveNotice(tenantId?: string | null) {
    const notice = tenantId
      ? await this.prisma.privacyNotice.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { publishedAt: 'desc' },
      }) || await this.prisma.privacyNotice.findFirst({
        where: { tenantId: null, isActive: true },
        orderBy: { publishedAt: 'desc' },
      })
      : await this.prisma.privacyNotice.findFirst({
        where: { tenantId: null, isActive: true },
        orderBy: { publishedAt: 'desc' },
      });

    if (!notice) {
      return {
        version: 'default',
        title: 'IDMatr Privacy Notice',
        content: 'IDMatr processes identity, access, audit, and security telemetry to operate the service.',
        isActive: true,
      };
    }

    return notice;
  }

  async acceptNotice(tenantId: string, tenantUserId: string, privacyNoticeId: string, ipAddress?: string, userAgent?: string) {
    const [user, notice] = await Promise.all([
      this.getTenantUserOrThrow(tenantId, tenantUserId),
      this.prisma.privacyNotice.findFirst({
        where: {
          id: privacyNoticeId,
          OR: [{ tenantId }, { tenantId: null }],
          isActive: true,
        },
      }),
    ]);

    if (!notice) {
      throw new NotFoundException('Active privacy notice not found');
    }

    const acceptance = await this.prisma.$transaction(async (tx) => {
      const record = await tx.privacyNoticeAcceptance.upsert({
        where: {
          tenantUserId_privacyNoticeId: {
            tenantUserId,
            privacyNoticeId: notice.id,
          },
        },
        update: {
          acceptedAt: new Date(),
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
        create: {
          tenantId,
          tenantUserId,
          privacyNoticeId: notice.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      await tx.tenantUser.update({
        where: { id: tenantUserId },
        data: {
          privacyNoticeAcceptedAt: acceptanceTime(record.acceptedAt),
          privacyNoticeVersion: notice.version,
        },
      });

      return record;
    });

    await this.auditLog.write({
      tenantId,
      action: 'privacy.notice.accepted',
      category: 'privacy',
      severity: 'info',
      description: `Privacy notice ${notice.version} accepted by ${user.email}`,
      metadata: { tenantUserId, privacyNoticeId: notice.id },
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    return { success: true, noticeVersion: notice.version, acceptedAt: acceptance.acceptedAt };
  }

  async recordConsent(
    tenantId: string,
    tenantUserId: string,
    dto: RecordConsentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.getTenantUserOrThrow(tenantId, tenantUserId);
    const status = dto.status || 'granted';

    const consent = await this.prisma.consentRecord.create({
      data: {
        tenantId,
        tenantUserId,
        purpose: dto.purpose,
        lawfulBasis: dto.lawfulBasis,
        status,
        source: 'self_service',
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        revokedAt: status === 'revoked' ? new Date() : null,
      },
    });

    await this.auditLog.write({
      tenantId,
      action: status === 'revoked' ? 'privacy.consent.revoked' : 'privacy.consent.granted',
      category: 'privacy',
      severity: 'info',
      description: `${user.email} ${status} consent for ${dto.purpose}`,
      metadata: { tenantUserId, lawfulBasis: dto.lawfulBasis },
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    return {
      ...consent,
      metadata: consent.metadata ? JSON.parse(consent.metadata) : null,
    };
  }

  async listConsents(tenantId: string, tenantUserId: string) {
    await this.getTenantUserOrThrow(tenantId, tenantUserId);
    const consents = await this.prisma.consentRecord.findMany({
      where: { tenantId, tenantUserId },
      orderBy: { createdAt: 'desc' },
    });

    return consents.map((consent) => ({
      ...consent,
      metadata: consent.metadata ? JSON.parse(consent.metadata) : null,
    }));
  }

  async exportSubjectData(tenantId: string, tenantUserId: string) {
    const user = await this.getTenantUserOrThrow(tenantId, tenantUserId);
    const [acceptances, consents, requests, auditLogs] = await Promise.all([
      this.prisma.privacyNoticeAcceptance.findMany({
        where: { tenantId, tenantUserId },
        include: { privacyNotice: true },
        orderBy: { acceptedAt: 'desc' },
      }),
      this.prisma.consentRecord.findMany({
        where: { tenantId, tenantUserId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dataSubjectRequest.findMany({
        where: { tenantId, tenantUserId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.operatorAuditLog.findMany({
        where: {
          tenantId,
          OR: [
            { metadata: { contains: tenantUserId } },
            { description: { contains: user.email } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        legalBasis: user.personalDataLegalBasis,
        dataCategories: user.personalDataCategories,
        privacyNoticeVersion: user.privacyNoticeVersion,
        privacyNoticeAcceptedAt: user.privacyNoticeAcceptedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      privacyNoticeAcceptances: acceptances.map((entry) => ({
        id: entry.id,
        acceptedAt: entry.acceptedAt,
        version: entry.privacyNotice.version,
        title: entry.privacyNotice.title,
      })),
      consents: consents.map((entry) => ({
        ...entry,
        metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
      })),
      requests: requests.map((entry) => ({
        ...entry,
        requestPayload: entry.requestPayload ? JSON.parse(entry.requestPayload) : null,
        resultPayload: entry.resultPayload ? JSON.parse(entry.resultPayload) : null,
      })),
      auditLogs: auditLogs.map((entry) => ({
        ...entry,
        metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
      })),
    };

    await this.prisma.dataSubjectRequest.create({
      data: {
        tenantId,
        tenantUserId,
        requestType: 'export',
        status: 'completed',
        requestedByUserId: tenantUserId,
        resultPayload: JSON.stringify({
          exportedAt: payload.exportedAt,
          consentCount: consents.length,
          requestCount: requests.length,
          auditLogCount: auditLogs.length,
        }),
        completedAt: new Date(),
      },
    });

    await this.auditLog.write({
      tenantId,
      action: 'privacy.subject.exported',
      category: 'privacy',
      severity: 'info',
      description: `Data export completed for ${user.email}`,
      metadata: { tenantUserId },
    });

    return payload;
  }

  async rectifySubjectData(
    tenantId: string,
    tenantUserId: string,
    dto: SubjectRectificationDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.getTenantUserOrThrow(tenantId, tenantUserId);
    const updateData: Record<string, any> = {};

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.tenantUser.findFirst({
        where: { tenantId, email: dto.email, NOT: { id: tenantUserId } },
      });
      if (existing) {
        throw new BadRequestException('Email is already in use for this tenant');
      }
      updateData.email = dto.email.toLowerCase();
    }
    if (dto.name) updateData.name = dto.name;
    if (dto.legalBasis) updateData.personalDataLegalBasis = dto.legalBasis;
    if (dto.dataCategories) updateData.personalDataCategories = dto.dataCategories;

    if (!Object.keys(updateData).length) {
      throw new BadRequestException('No rectification fields supplied');
    }

    const updatedUser = await this.prisma.tenantUser.update({
      where: { id: tenantUserId },
      data: updateData,
    });

    await this.prisma.dataSubjectRequest.create({
      data: {
        tenantId,
        tenantUserId,
        requestType: 'rectify',
        status: 'completed',
        requestedByUserId: tenantUserId,
        requestPayload: JSON.stringify(dto),
        completedAt: new Date(),
      },
    });

    await this.auditLog.write({
      tenantId,
      action: 'privacy.subject.rectified',
      category: 'privacy',
      severity: 'info',
      description: `Data rectification completed for ${user.email}`,
      metadata: { tenantUserId, fields: Object.keys(updateData) },
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      legalBasis: updatedUser.personalDataLegalBasis,
      dataCategories: updatedUser.personalDataCategories,
    };
  }

  async requestSubjectDeletion(
    tenantId: string,
    tenantUserId: string,
    dto: SubjectDeletionDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.getTenantUserOrThrow(tenantId, tenantUserId);
    const tenantSettings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const graceDays = tenantSettings?.deletionGraceDays ?? 30;
    const notBefore = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);

    const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 12);
    const updateResult = await this.prisma.$transaction(async (tx) => {
      const subjectRequest = await tx.dataSubjectRequest.create({
        data: {
          tenantId,
          tenantUserId,
          requestType: 'delete',
          status: 'queued',
          requestedByUserId: tenantUserId,
          requestPayload: JSON.stringify({ reason: dto.reason, scheduledFor: notBefore.toISOString() }),
        },
      });

      await tx.tenantUser.update({
        where: { id: tenantUserId },
        data: {
          isActive: false,
          deletedAt: new Date(),
          deletedReason: dto.reason,
          mfaEnabled: false,
          mfaSecret: null,
          passwordHash: randomPassword,
        },
      });

      await tx.consentRecord.updateMany({
        where: { tenantId, tenantUserId, revokedAt: null },
        data: { status: 'revoked', revokedAt: new Date() },
      });

      await tx.retentionTask.create({
        data: {
          tenantId,
          taskType: 'subject_delete',
          targetType: 'tenant_user',
          targetId: tenantUserId,
          payload: JSON.stringify({ dataSubjectRequestId: subjectRequest.id, reason: dto.reason }),
          notBefore,
        },
      });

      return subjectRequest;
    });

    await this.auditLog.write({
      tenantId,
      action: 'privacy.subject.deletion_requested',
      category: 'privacy',
      severity: 'warning',
      description: `Deletion requested for ${user.email}`,
      metadata: { tenantUserId, scheduledFor: notBefore.toISOString() },
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    return {
      success: true,
      requestId: updateResult.id,
      scheduledFor: notBefore.toISOString(),
      graceDays,
    };
  }

  async listRequests(tenantId?: string) {
    return this.prisma.dataSubjectRequest.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async runRetentionScan(processImmediately = false) {
    const now = new Date();
    const tokenCutoff = new Date(now.getTime() - ONBOARDING_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const requestCutoff = new Date(now.getTime() - REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const [tenants, expiredTokens, expiredRequests] = await Promise.all([
      this.prisma.tenantSettings.findMany({ select: { tenantId: true, deletionGraceDays: true } }),
      this.prisma.onboardingToken.findMany({
        where: {
          OR: [{ usedAt: { lt: tokenCutoff } }, { expiresAt: { lt: tokenCutoff } }],
        },
        select: { id: true, tenantId: true },
      }),
      this.prisma.dataSubjectRequest.findMany({
        where: {
          status: 'completed',
          completedAt: { lt: requestCutoff },
        },
        select: { id: true, tenantId: true },
      }),
    ]);

    let queued = 0;

    for (const tenant of tenants) {
      const cutoff = new Date(now.getTime() - (tenant.deletionGraceDays || 30) * 24 * 60 * 60 * 1000);
      const users = await this.prisma.tenantUser.findMany({
        where: {
          tenantId: tenant.tenantId,
          deletedAt: { lt: cutoff },
          isAnonymized: false,
        },
        select: { id: true },
      });

      for (const user of users) {
        queued += await this.ensureRetentionTask({
          tenantId: tenant.tenantId,
          taskType: 'subject_delete',
          targetType: 'tenant_user',
          targetId: user.id,
          notBefore: now,
        });
      }
    }

    for (const token of expiredTokens) {
      queued += await this.ensureRetentionTask({
        tenantId: token.tenantId,
        taskType: 'retention_purge',
        targetType: 'onboarding_token',
        targetId: token.id,
        notBefore: now,
      });
    }

    for (const request of expiredRequests) {
      queued += await this.ensureRetentionTask({
        tenantId: request.tenantId,
        taskType: 'retention_purge',
        targetType: 'data_subject_request',
        targetId: request.id,
        notBefore: now,
      });
    }

    const processed = processImmediately ? await this.processRetentionTasks() : 0;
    return { queued, processed };
  }

  async processRetentionTasks() {
    const tasks = await this.prisma.retentionTask.findMany({
      where: { status: 'queued', notBefore: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    let processed = 0;

    for (const task of tasks) {
      try {
        if (task.targetType === 'tenant_user') {
          const payload = task.payload ? JSON.parse(task.payload) : null;
          await this.prisma.tenantUser.update({
            where: { id: task.targetId },
            data: {
              name: `Deleted User ${task.targetId.slice(0, 8)}`,
              email: `deleted+${task.targetId}@redacted.invalid`,
              isAnonymized: true,
              personalDataLegalBasis: 'erased',
              personalDataCategories: ['redacted'],
              privacyNoticeAcceptedAt: null,
              privacyNoticeVersion: null,
            },
          }).catch(() => undefined);
          if (payload?.dataSubjectRequestId) {
            await this.prisma.dataSubjectRequest.update({
              where: { id: payload.dataSubjectRequestId },
              data: { status: 'completed', completedAt: new Date() },
            }).catch(() => undefined);
          }
        } else if (task.targetType === 'onboarding_token') {
          await this.prisma.onboardingToken.delete({ where: { id: task.targetId } }).catch(() => undefined);
        } else if (task.targetType === 'data_subject_request') {
          await this.prisma.dataSubjectRequest.delete({ where: { id: task.targetId } }).catch(() => undefined);
        }

        await this.prisma.retentionTask.update({
          where: { id: task.id },
          data: { status: 'processed', processedAt: new Date(), errorMessage: null },
        });

        await this.auditLog.write({
          tenantId: task.tenantId || null,
          action: 'retention.task.processed',
          category: 'retention',
          severity: 'info',
          description: `Retention task processed for ${task.targetType}:${task.targetId}`,
          metadata: { taskType: task.taskType, targetType: task.targetType },
        });

        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await this.prisma.retentionTask.update({
          where: { id: task.id },
          data: { status: 'error', errorMessage: message },
        }).catch(() => undefined);

        this.logger.error(`Retention task ${task.id} failed: ${message}`);
      }
    }

    return processed;
  }

  async listRetentionTasks(tenantId?: string) {
    return this.prisma.retentionTask.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  startRetentionScheduler() {
    if (process.env.RETENTION_SCAN_ENABLED === 'false') {
      this.logger.warn('Retention scheduler disabled by RETENTION_SCAN_ENABLED=false');
      return;
    }

    const intervalMs = Number(process.env.RETENTION_SCAN_INTERVAL_MS || DEFAULT_RETENTION_SCAN_INTERVAL_MS);
    setInterval(async () => {
      try {
        const result = await this.runRetentionScan(true);
        if (result.queued || result.processed) {
          this.logger.log(`Retention scan queued=${result.queued} processed=${result.processed}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Retention scan failed: ${message}`);
      }
    }, intervalMs).unref();
  }

  private async ensureRetentionTask(input: {
    tenantId: string | null;
    taskType: string;
    targetType: string;
    targetId: string;
    notBefore: Date;
  }) {
    const existing = await this.prisma.retentionTask.findFirst({
      where: {
        targetType: input.targetType,
        targetId: input.targetId,
        status: { in: ['queued', 'error'] },
      },
      select: { id: true },
    });

    if (existing) return 0;

    await this.prisma.retentionTask.create({
      data: {
        tenantId: input.tenantId,
        taskType: input.taskType,
        targetType: input.targetType,
        targetId: input.targetId,
        notBefore: input.notBefore,
      },
    });
    return 1;
  }

  private async getTenantUserOrThrow(tenantId: string, tenantUserId: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id: tenantUserId, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Tenant user not found');
    }
    return user;
  }
}

function acceptanceTime(value: Date | null | undefined) {
  return value || new Date();
}

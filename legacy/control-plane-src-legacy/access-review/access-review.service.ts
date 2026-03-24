import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { normalizeOperatorRole } from '../security/roles.js';

@Injectable()
export class AccessReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly jwt: JwtService,
  ) {}

  async startReview(operatorId: string, dueAt?: string) {
    const operators = await this.prisma.operator.findMany({
      where: { isActive: true },
      select: { id: true, role: true },
    });

    const review = await this.prisma.accessReview.create({
      data: {
        startedByOperatorId: operatorId,
        dueAt: dueAt ? new Date(dueAt) : null,
        items: {
          create: operators.map((operator) => ({
            operatorId: operator.id,
            currentRole: normalizeOperatorRole(operator.role),
          })),
        },
      },
      include: { items: true },
    });

    await this.auditLog.write({
      operatorId,
      action: 'access_review.started',
      category: 'governance',
      severity: 'info',
      description: `Access review ${review.id} started`,
      metadata: { operatorCount: operators.length, dueAt: review.dueAt?.toISOString() || null },
    });

    return review;
  }

  async listReviews() {
    return this.prisma.accessReview.findMany({
      include: {
        items: {
          include: {
            operator: {
              select: { id: true, email: true, name: true, role: true, isActive: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewItem(reviewId: string, itemId: string, disposition: string, notes: string | undefined, reviewerId: string) {
    const review = await this.prisma.accessReview.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Access review not found');
    }
    if (review.status !== 'open') {
      throw new BadRequestException('Access review is not open');
    }

    const item = await this.prisma.accessReviewItem.update({
      where: { id: itemId },
      data: {
        disposition,
        notes: notes || null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    await this.auditLog.write({
      operatorId: reviewerId,
      action: 'access_review.item_reviewed',
      category: 'governance',
      severity: disposition === 'revoke' ? 'warning' : 'info',
      description: `Access review item ${item.id} marked ${disposition}`,
      metadata: { reviewId, operatorId: item.operatorId, notes: notes || null },
    });

    return item;
  }

  async finalizeReview(reviewId: string, operatorId: string) {
    const items = await this.prisma.accessReviewItem.findMany({ where: { accessReviewId: reviewId } });
    if (!items.length) {
      throw new NotFoundException('Access review has no items');
    }

    const summary = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.disposition] = (acc[item.disposition] || 0) + 1;
      return acc;
    }, {});

    const review = await this.prisma.accessReview.update({
      where: { id: reviewId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        summaryJson: JSON.stringify(summary),
      },
    });

    await this.auditLog.write({
      operatorId,
      action: 'access_review.finalized',
      category: 'governance',
      severity: 'info',
      description: `Access review ${reviewId} finalized`,
      metadata: summary,
    });

    return { ...review, summary };
  }

  async createBreakGlass(operatorId: string, operatorEmail: string, justification: string) {
    const operator = await this.prisma.operator.findUnique({ where: { email: operatorEmail } });
    if (!operator || !operator.isActive) {
      throw new NotFoundException('Target operator not found');
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.breakGlassAccess.create({
      data: {
        operatorEmail,
        justification,
        requestedByOperatorId: operatorId,
        tokenHash,
        expiresAt,
      },
    });

    await this.auditLog.write({
      operatorId,
      action: 'access_review.break_glass_created',
      category: 'governance',
      severity: 'warning',
      description: `Break-glass access created for ${operatorEmail}`,
      metadata: { expiresAt: expiresAt.toISOString(), justification },
    });

    return { token, expiresAt: expiresAt.toISOString(), operatorEmail };
  }

  async consumeBreakGlassToken(token: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.breakGlassAccess.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new UnauthorizedException('Break-glass token is invalid or expired');
    }

    const operator = await this.prisma.operator.findUnique({ where: { email: record.operatorEmail } });
    if (!operator || !operator.isActive) {
      throw new UnauthorizedException('Break-glass operator is unavailable');
    }

    await this.prisma.breakGlassAccess.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    await this.auditLog.write({
      operatorId: operator.id,
      action: 'auth.operator.break_glass_login',
      category: 'auth',
      severity: 'warning',
      description: `Break-glass login used for ${operator.email}`,
      metadata: { justification: record.justification },
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    const role = normalizeOperatorRole(operator.role);
    const payload = {
      sub: operator.id,
      email: operator.email,
      role,
      type: 'platform_operator',
      breakGlass: true,
    };

    return {
      access_token: this.jwt.sign(payload),
      operator: {
        id: operator.id,
        email: operator.email,
        name: operator.name,
        role,
        mfaEnabled: operator.mfaEnabled,
        breakGlass: true,
      },
    };
  }
}

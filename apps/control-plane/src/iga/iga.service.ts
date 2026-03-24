import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/request-user.interface';
import { IntegrationsService } from '../integrations/integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccessReviewDto } from './dto/create-access-review.dto';

@Injectable()
export class IgaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async list(actor: RequestUser) {
    this.assertAdminActor(actor);
    return this.prisma.accessReview.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        integration: {
          select: { id: true, provider: true, name: true, externalDomain: true },
        },
        externalIdentity: {
          select: {
            id: true,
            primaryEmail: true,
            fullName: true,
            roleNames: true,
            isAdmin: true,
            isDelegatedAdmin: true,
          },
        },
        externalGroup: {
          select: { id: true, email: true, name: true },
        },
        membership: {
          select: { id: true, role: true, memberEmail: true, memberType: true },
        },
        reviewerUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateAccessReviewDto, actor: RequestUser) {
    this.assertAdminActor(actor);
    const membership = await this.prisma.externalGroupMembership.findFirst({
      where: {
        tenantId: actor.tenantId,
        integrationId: dto.integrationId,
        externalGroupId: dto.externalGroupId,
        externalIdentityId: dto.externalIdentityId,
      },
    });

    if (!membership) {
      throw new NotFoundException('No live Google group membership found for the requested identity and group');
    }

    const review = await this.prisma.accessReview.create({
      data: {
        tenantId: actor.tenantId,
        integrationId: dto.integrationId,
        externalIdentityId: dto.externalIdentityId,
        externalGroupId: dto.externalGroupId,
        membershipId: membership.id,
        reviewNotes: dto.notes,
      },
      include: {
        externalIdentity: true,
        externalGroup: true,
        membership: true,
      },
    });

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'iga.review.created',
      resource: 'access_review',
      metadata: {
        reviewId: review.id,
        externalIdentityId: dto.externalIdentityId,
        externalGroupId: dto.externalGroupId,
      },
    });

    return review;
  }

  async approve(id: string, actor: RequestUser, notes?: string) {
    this.assertAdminActor(actor);
    const review = await this.findReviewOrThrow(id, actor.tenantId);

    const updated = await this.prisma.accessReview.update({
      where: { id },
      data: {
        status: ReviewStatus.APPROVED,
        reviewerUserId: actor.userId,
        reviewNotes: notes ?? review.reviewNotes,
        decisionAppliedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'iga.review.approved',
      resource: 'access_review',
      metadata: { reviewId: id },
    });

    return updated;
  }

  async revoke(id: string, actor: RequestUser, notes?: string) {
    this.assertAdminActor(actor);
    const review = await this.findReviewOrThrow(id, actor.tenantId);

    await this.integrationsService.revokeGroupAccess({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      integrationId: review.integrationId,
      externalIdentityId: review.externalIdentityId,
      externalGroupId: review.externalGroupId,
    });

    const updated = await this.prisma.accessReview.update({
      where: { id },
      data: {
        status: ReviewStatus.REVOKED,
        reviewerUserId: actor.userId,
        reviewNotes: notes ?? review.reviewNotes,
        decisionAppliedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'iga.review.revoked',
      resource: 'access_review',
      metadata: { reviewId: id },
    });

    return updated;
  }

  private async findReviewOrThrow(id: string, tenantId: string) {
    const review = await this.prisma.accessReview.findFirst({
      where: { id, tenantId },
    });

    if (!review) {
      throw new NotFoundException('Access review not found');
    }

    return review;
  }

  private assertAdminActor(actor: RequestUser) {
    if (actor.role !== Role.PLATFORM_ADMIN && actor.role !== Role.TENANT_ADMIN) {
      throw new ForbiddenException('Admin role is required for governance operations');
    }
  }
}

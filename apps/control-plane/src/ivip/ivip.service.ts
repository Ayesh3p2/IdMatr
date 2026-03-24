import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestStatus, RequestType, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/request-user.interface';
import { IntegrationsService } from '../integrations/integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class IvipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async list(actor: RequestUser) {
    return this.prisma.identityRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(this.isAdmin(actor.role) ? {} : { requesterUserId: actor.userId }),
      },
      include: {
        integration: {
          select: { id: true, provider: true, name: true },
        },
        externalIdentity: {
          select: { id: true, primaryEmail: true, fullName: true },
        },
        externalGroup: {
          select: { id: true, email: true, name: true },
        },
        requesterUser: {
          select: { id: true, email: true, name: true, role: true },
        },
        approverUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateRequestDto, actor: RequestUser) {
    const [identity, group, existingMembership] = await Promise.all([
      this.prisma.externalIdentity.findFirst({
        where: {
          id: dto.externalIdentityId,
          tenantId: actor.tenantId,
          integrationId: dto.integrationId,
        },
      }),
      this.prisma.externalGroup.findFirst({
        where: {
          id: dto.externalGroupId,
          tenantId: actor.tenantId,
          integrationId: dto.integrationId,
        },
      }),
      this.prisma.externalGroupMembership.findFirst({
        where: {
          tenantId: actor.tenantId,
          integrationId: dto.integrationId,
          externalIdentityId: dto.externalIdentityId,
          externalGroupId: dto.externalGroupId,
        },
      }),
    ]);

    if (!identity || !group) {
      throw new NotFoundException('External identity or group not found');
    }

    if (!this.isAdmin(actor.role) && identity.mappedTenantUserId !== actor.userId) {
      throw new ForbiddenException('Users can only request access for their own mapped identity');
    }

    if (existingMembership) {
      throw new BadRequestException('The identity already has access to this Google group');
    }

    const request = await this.prisma.identityRequest.create({
      data: {
        tenantId: actor.tenantId,
        integrationId: dto.integrationId,
        requesterUserId: actor.userId,
        externalIdentityId: dto.externalIdentityId,
        externalGroupId: dto.externalGroupId,
        type: RequestType.APP_ACCESS,
        title: dto.title ?? `Access request for ${group.name}`,
        description:
          dto.description ??
          `${identity.primaryEmail} requests access to ${group.email}`,
        requestedAccessRole: dto.requestedAccessRole ?? 'MEMBER',
      },
      include: {
        externalIdentity: true,
        externalGroup: true,
      },
    });

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'ivip.request.created',
      resource: 'identity_request',
      metadata: {
        requestId: request.id,
        integrationId: dto.integrationId,
        externalIdentityId: dto.externalIdentityId,
        externalGroupId: dto.externalGroupId,
      },
    });

    return request;
  }

  async approve(id: string, actor: RequestUser, notes?: string) {
    const request = await this.findRequestOrThrow(id, actor.tenantId);

    const membership = await this.integrationsService.grantGroupAccess({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      integrationId: request.integrationId,
      externalIdentityId: request.externalIdentityId,
      externalGroupId: request.externalGroupId,
      role: request.requestedAccessRole ?? 'MEMBER',
    });

    const updated = await this.prisma.identityRequest.update({
      where: { id },
      data: {
        status: RequestStatus.APPLIED,
        approverUserId: actor.userId,
        reviewNotes: notes,
        reviewedAt: new Date(),
        externalOperationStatus: `APPLIED:${membership.id}`,
        externalOperationError: null,
      },
    });

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'ivip.request.applied',
      resource: 'identity_request',
      metadata: {
        requestId: id,
        membershipId: membership.id,
      },
    });

    return updated;
  }

  async reject(id: string, actor: RequestUser, notes?: string) {
    await this.findRequestOrThrow(id, actor.tenantId);

    const updated = await this.prisma.identityRequest.update({
      where: { id },
      data: {
        status: RequestStatus.REJECTED,
        approverUserId: actor.userId,
        reviewNotes: notes,
        reviewedAt: new Date(),
        externalOperationStatus: 'NOT_APPLIED',
      },
    });

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'ivip.request.rejected',
      resource: 'identity_request',
      metadata: { requestId: id },
    });

    return updated;
  }

  private async findRequestOrThrow(id: string, tenantId: string) {
    const request = await this.prisma.identityRequest.findFirst({
      where: { id, tenantId },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return request;
  }

  private isAdmin(role: Role) {
    return role === Role.PLATFORM_ADMIN || role === Role.TENANT_ADMIN;
  }
}

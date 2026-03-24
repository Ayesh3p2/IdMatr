import { ForbiddenException, Injectable } from '@nestjs/common';
import { EventSeverity, IntegrationProvider, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class ItdrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: RequestUser, severity?: EventSeverity) {
    this.assertAdminActor(actor);
    return this.prisma.auditEvent.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(severity ? { severity } : {}),
      },
      include: {
        actorUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateEventDto, actor: RequestUser) {
    this.assertAdminActor(actor);
    return this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: dto.action,
      resource: dto.resource,
      severity: dto.severity,
      metadata: dto.metadata,
    });
  }

  async detectGoogleSignals(actor: RequestUser, integrationId?: string) {
    this.assertAdminActor(actor);
    const integration = await this.prisma.integration.findFirstOrThrow({
      where: {
        tenantId: actor.tenantId,
        provider: IntegrationProvider.GOOGLE,
        ...(integrationId ? { id: integrationId } : {}),
      },
    });

    const [identities, memberships] = await Promise.all([
      this.prisma.externalIdentity.findMany({
        where: {
          tenantId: actor.tenantId,
          integrationId: integration.id,
        },
      }),
      this.prisma.externalGroupMembership.findMany({
        where: {
          tenantId: actor.tenantId,
          integrationId: integration.id,
        },
      }),
    ]);

    const inactiveThreshold = new Date();
    inactiveThreshold.setDate(inactiveThreshold.getDate() - Number(process.env.ITDR_INACTIVE_DAYS ?? 90));

    let inactiveCount = 0;
    let privilegeCount = 0;
    let multipleAccessCount = 0;
    const privilegedIdentityIds = new Set<string>();
    const membershipsByIdentityId = new Map<string, number>();

    for (const membership of memberships) {
      if (membership.externalIdentityId) {
        membershipsByIdentityId.set(
          membership.externalIdentityId,
          (membershipsByIdentityId.get(membership.externalIdentityId) ?? 0) + 1,
        );

        if (membership.role === 'OWNER' || membership.role === 'MANAGER') {
          privilegedIdentityIds.add(membership.externalIdentityId);
        }
      }
    }

    for (const identity of identities) {
      let riskScore = 0;
      const isInactive = !identity.lastLoginAt || identity.lastLoginAt < inactiveThreshold;
      if (isInactive) {
        riskScore += 10;
        inactiveCount += 1;
        await this.auditService.log({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'itdr.inactive_user.detected',
          resource: 'external_identity',
          severity: EventSeverity.MEDIUM,
          metadata: {
            integrationId: integration.id,
            externalIdentityId: identity.id,
            primaryEmail: identity.primaryEmail,
            lastLoginAt: identity.lastLoginAt?.toISOString() ?? null,
          },
        });
      }

      const hasPrivilege =
        identity.isAdmin ||
        identity.isDelegatedAdmin ||
        identity.roleNames.length > 0 ||
        privilegedIdentityIds.has(identity.id);

      if (hasPrivilege) {
        riskScore += 20;
        privilegeCount += 1;
        await this.auditService.log({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'itdr.high_privilege_user.detected',
          resource: 'external_identity',
          severity: EventSeverity.HIGH,
          metadata: {
            integrationId: integration.id,
            externalIdentityId: identity.id,
            primaryEmail: identity.primaryEmail,
            roles: identity.roleNames,
            isAdmin: identity.isAdmin,
            isDelegatedAdmin: identity.isDelegatedAdmin,
          },
        });
      }

      const membershipCount = membershipsByIdentityId.get(identity.id) ?? 0;
      if (membershipCount > 1) {
        riskScore += 15;
        multipleAccessCount += 1;
        await this.auditService.log({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'itdr.multiple_access.detected',
          resource: 'external_identity',
          severity: EventSeverity.MEDIUM,
          metadata: {
            integrationId: integration.id,
            externalIdentityId: identity.id,
            primaryEmail: identity.primaryEmail,
            membershipCount,
          },
        });
      }

      await this.prisma.externalIdentity.update({
        where: { id: identity.id },
        data: { riskScore },
      });
    }

    return {
      integrationId: integration.id,
      inactiveUsersDetected: inactiveCount,
      highPrivilegeUsersDetected: privilegeCount,
      multipleAccessUsersDetected: multipleAccessCount,
    };
  }

  private assertAdminActor(actor: RequestUser) {
    if (actor.role !== Role.PLATFORM_ADMIN && actor.role !== Role.TENANT_ADMIN) {
      throw new ForbiddenException('Admin role is required for threat detection operations');
    }
  }
}

import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';
import { RequestUser } from '../common/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';

const INACTIVE_DAYS = Number(process.env.ITDR_INACTIVE_DAYS ?? 90);

@Injectable()
export class IspmService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: RequestUser) {
    const integrations = await this.prisma.integration.findMany({
      where: {
        tenantId: actor.tenantId,
        provider: IntegrationProvider.GOOGLE,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(integrations.map((integration) => this.buildIntegrationSnapshot(actor.tenantId, integration.id)));
  }

  async getOne(actor: RequestUser, integrationId: string) {
    return this.buildIntegrationSnapshot(actor.tenantId, integrationId);
  }

  private async buildIntegrationSnapshot(tenantId: string, integrationId: string) {
    const [integration, identities, memberships, groups] = await Promise.all([
      this.prisma.integration.findFirstOrThrow({
        where: { id: integrationId, tenantId },
      }),
      this.prisma.externalIdentity.findMany({
        where: { tenantId, integrationId },
      }),
      this.prisma.externalGroupMembership.findMany({
        where: { tenantId, integrationId },
      }),
      this.prisma.externalGroup.findMany({
        where: { tenantId, integrationId },
      }),
    ]);

    const permissionTypes = [...new Set(memberships.map((membership) => membership.role))];
    const highPrivilegeUsers = new Set<string>();

    for (const identity of identities) {
      if (identity.isAdmin || identity.isDelegatedAdmin || identity.roleNames.length > 0) {
        highPrivilegeUsers.add(identity.id);
      }
    }

    for (const membership of memberships) {
      if (membership.role === 'OWNER' || membership.role === 'MANAGER') {
        if (membership.externalIdentityId) {
          highPrivilegeUsers.add(membership.externalIdentityId);
        }
      }
    }

    const inactiveThreshold = new Date();
    inactiveThreshold.setDate(inactiveThreshold.getDate() - INACTIVE_DAYS);

    const inactiveUsers = identities.filter(
      (identity) => !identity.lastLoginAt || identity.lastLoginAt < inactiveThreshold,
    ).length;

    return {
      id: integration.id,
      provider: integration.provider,
      name: integration.name,
      status: integration.status,
      domain: integration.externalDomain,
      lastSyncAt: integration.lastSyncAt,
      userCount: identities.length,
      groupCount: groups.length,
      permissionTypes,
      riskIndicators: {
        highPrivilegeUsers: highPrivilegeUsers.size,
        inactiveUsers,
        suspendedUsers: identities.filter((identity) => identity.suspended).length,
      },
    };
  }
}

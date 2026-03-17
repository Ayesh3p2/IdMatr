import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkPolicy(data: { tenantId: string; userId: string; resource: string; action: string }) {
    this.logger.log(`Checking policy for tenant ${data.tenantId} user ${data.userId} on ${data.resource}:${data.action}`);

    const grants = await this.prisma.accessGrant.findMany({
      where: {
        tenantId: data.tenantId,
        userId: data.userId,
        status: 'active',
        role: {
          tenantId: data.tenantId,
          permissions: {
            some: {
              tenantId: data.tenantId,
              action: data.action,
              resource: data.resource,
            },
          },
        },
      },
      include: {
        role: {
          include: {
            permissions: {
              where: { tenantId: data.tenantId },
            },
          },
        },
      },
    });

    if (grants.length > 0) {
      return { allowed: true, grantId: grants[0].id };
    }

    return { allowed: false, reason: 'Insufficient privileges' };
  }

  async getPolicies(tenantId: string) {
    return [
      {
        id: `${tenantId}-read`,
        tenantId,
        name: 'Tenant Read Access',
        description: 'Allows authenticated tenant users to read tenant-scoped resources',
        effect: 'allow',
        actions: ['read'],
        resources: ['tenant:*'],
      },
      {
        id: `${tenantId}-admin`,
        tenantId,
        name: 'Tenant Admin Write Access',
        description: 'Allows tenant administrators to write tenant-scoped resources',
        effect: 'allow',
        actions: ['write', 'delete'],
        resources: ['tenant:*'],
        conditions: { role: 'tenant_admin' },
      },
    ];
  }

  async getPolicyViolations(tenantId: string) {
    const permissions = await this.prisma.permission.findMany({
      where: {
        tenantId,
        riskLevel: { in: ['high', 'critical'] },
      },
      include: {
        role: {
          include: {
            accessGrants: {
              where: { tenantId, status: 'active' },
            },
          },
        },
      },
    });

    return permissions
      .filter((permission) => permission.role && permission.role.accessGrants.length > 0)
      .map((permission) => ({
        id: `PV-${permission.id.slice(0, 6)}`,
        tenantId,
        permissionId: permission.id,
        permissionName: permission.name,
        riskLevel: permission.riskLevel,
        affectedUsers: permission.role?.accessGrants.length || 0,
        policy: `${permission.name} Restriction Policy`,
        status: 'Open',
      }));
  }
}

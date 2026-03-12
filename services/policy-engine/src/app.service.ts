import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkPolicy(data: { userId: string; resource: string; action: string }) {
    this.logger.log(`Checking policy for user ${data.userId} on ${data.resource}:${data.action}`);
    
    // Real RBAC lookup using Prisma
    // We check if the user has an AccessGrant that links to a Role 
    // that contains the required action on the given resource.
    const grants = await this.prisma.accessGrant.findMany({
      where: {
        userId: data.userId,
        status: 'active',
        role: {
          permissions: {
            some: {
              action: data.action,
              resource: data.resource,
            },
          },
        },
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (grants.length > 0) {
      return { allowed: true, grantId: grants[0].id };
    }
    
    return { allowed: false, reason: 'Insufficient privileges' };
  }

  async getPolicies() {
    // In a real system, these would also come from DB
    return [
      { id: '1', name: 'Global Read Access', description: 'Allows all users to read public resources', effect: 'allow', actions: ['read'], resources: ['*'] },
      { id: '2', name: 'Admin Write Access', description: 'Allows admins to write to all resources', effect: 'allow', actions: ['write', 'delete'], resources: ['*'], conditions: { role: 'admin' } },
    ];
  }

  async getPolicyViolations() {
    // Query for policy violations based on permissions that exceed policy constraints
    const permissions = await this.prisma.permission.findMany({
      where: { riskLevel: { in: ['high', 'critical'] } },
      include: { role: { include: { accessGrants: { where: { status: 'active' } } } } },
    });

    return permissions
      .filter(p => p.role && p.role.accessGrants.length > 0)
      .map(p => ({
        id: `PV-${p.id.slice(0, 6)}`,
        permissionId: p.id,
        permissionName: p.name,
        riskLevel: p.riskLevel,
        affectedUsers: p.role?.accessGrants.length || 0,
        policy: `${p.name} Restriction Policy`,
        status: 'Open',
      }));
  }
}

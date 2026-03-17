import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllIdentities(tenantId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { tenantId },
      include: {
        accessGrants: true,
      },
    });
  }

  async getIdentity(tenantId: string, id: string): Promise<User | null> {
    this.logger.log(`Getting identity: ${id} for tenant: ${tenantId}`);
    return this.prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        accessGrants: {
          include: {
            application: true,
            role: true,
          },
        },
      },
    });
  }

  async createUser(tenantId: string, data: any): Promise<User> {
    return this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        name: data.name,
        status: data.status || 'active',
        riskScore: data.riskScore || 0,
        metadata: data.metadata || {},
      },
    });
  }

  async updateUserRisk(tenantId: string, id: string, score: number): Promise<User> {
    // Verify user belongs to tenant before update
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new Error(`User ${id} not found for tenant ${tenantId}`);
    return this.prisma.user.update({
      where: { id },
      data: { riskScore: score },
    });
  }

  async getIdentityAnalytics(tenantId: string) {
    const [users, apps, grants] = await Promise.all([
      this.prisma.user.findMany({ where: { tenantId } }),
      this.prisma.application.findMany({ where: { tenantId } }),
      this.prisma.accessGrant.findMany({ where: { tenantId, status: 'active' } }),
    ]);

    const highRisk = users.filter(u => (u.riskScore || 0) > 70).length;
    const avgRisk = users.length > 0
      ? users.reduce((sum, u) => sum + (u.riskScore || 0), 0) / users.length
      : 0;

    const deptStats = users.reduce((acc: Record<string, number>, u) => {
      const dept = (u.metadata as any)?.department || 'Unknown';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'active').length,
      highRiskUsers: highRisk,
      averageRiskScore: Math.round(avgRisk),
      totalApps: apps.length,
      totalGrants: grants.length,
      avgGrantsPerUser: users.length > 0 ? Math.round(grants.length / users.length) : 0,
      departmentBreakdown: deptStats,
      generatedAt: new Date(),
    };
  }
}

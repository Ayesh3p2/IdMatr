import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllIdentities(): Promise<User[]> {
    return this.prisma.user.findMany({
      include: {
        accessGrants: true,
      },
    });
  }

  async getIdentity(id: string): Promise<User | null> {
    this.logger.log(`Getting identity: ${id}`);
    return this.prisma.user.findUnique({
      where: { id },
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

  async createUser(data: any): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        status: data.status || 'active',
        riskScore: data.riskScore || 0,
        metadata: data.metadata || {},
      },
    });
  }

  async updateUserRisk(id: string, score: number): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { riskScore: score },
    });
  }

  async getIdentityAnalytics() {
    const [users, apps, grants] = await Promise.all([
      this.prisma.user.findMany(),
      this.prisma.application.findMany(),
      this.prisma.accessGrant.findMany({ where: { status: 'active' } }),
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

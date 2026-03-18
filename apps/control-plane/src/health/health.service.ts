import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    dependencies: Record<string, ComponentHealth>;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async getLiveness(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {
      database: { status: 'down' },
      dependencies: {},
    };

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    const dbCheck = await this.checkDatabase();
    checks.database = dbCheck;
    if (dbCheck.status === 'down') {
      overallStatus = 'unhealthy';
    }

    const redisCheck = await this.checkRedis();
    checks.dependencies['redis'] = redisCheck;
    if (redisCheck.status === 'down') {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: process.uptime(),
      checks,
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        return { status: 'down', message: 'REDIS_URL not configured' };
      }
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  async getOverview() {
    const [tenantStats, recentAudit, integrationStats] = await Promise.all([
      this.prisma.tenant.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.operatorAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          operator: { select: { email: true, name: true } },
          tenant: { select: { name: true, slug: true } },
        },
      }),
      this.prisma.tenantIntegration.groupBy({ by: ['provider', 'status'], _count: { id: true } }),
    ]);

    const totalTenants = tenantStats.reduce((s, r) => s + r._count.id, 0);
    const statusMap = Object.fromEntries(tenantStats.map(s => [s.status, s._count.id]));

    const integrationSummary: Record<string, { total: number; active: number; error: number }> = {};
    for (const row of integrationStats) {
      const p = row.provider;
      if (!integrationSummary[p]) integrationSummary[p] = { total: 0, active: 0, error: 0 };
      integrationSummary[p].total += row._count.id;
      if (row.status === 'ACTIVE') integrationSummary[p].active += row._count.id;
      if (row.status === 'ERROR')  integrationSummary[p].error  += row._count.id;
    }

    return {
      platform: {
        status: 'operational',
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0',
        timestamp: new Date().toISOString(),
      },
      tenants: {
        total: totalTenants,
        active:    statusMap['ACTIVE']    || 0,
        suspended: statusMap['SUSPENDED'] || 0,
        trial:     statusMap['TRIAL']     || 0,
        pending:   statusMap['PENDING']   || 0,
      },
      integrations: integrationSummary,
      recentActivity: recentAudit,
    };
  }
}

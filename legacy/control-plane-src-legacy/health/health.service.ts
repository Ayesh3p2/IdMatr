import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoggerService } from '../common/logging/logger.service.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  memory: MemoryUsage;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    externalServices: Record<string, ComponentHealth>;
    system: SystemHealth;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
  lastCheck?: string;
  details?: Record<string, any>;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
  heapPercentage: number;
}

export interface SystemHealth {
  status: 'up' | 'down';
  cpu: number;
  memory: MemoryUsage;
  disk: DiskUsage;
  uptime: number;
  loadAverage: number[];
}

export interface DiskUsage {
  used: number;
  total: number;
  percentage: number;
}

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private readonly logger: LoggerService
  ) {}

  async getLiveness(): Promise<{ status: string; timestamp: string; uptime: number }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async getReadiness(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {
      database: { status: 'down' },
      redis: { status: 'down' },
      externalServices: {},
      system: { status: 'down', cpu: 0, memory: this.getMemoryUsage(), disk: await this.getDiskUsage(), uptime: process.uptime(), loadAverage: [] },
    };

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database check
    const dbCheck = await this.checkDatabase();
    checks.database = dbCheck;
    if (dbCheck.status === 'down') {
      overallStatus = 'unhealthy';
    } else if (dbCheck.status === 'degraded') {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    }

    // Redis check
    const redisCheck = await this.checkRedis();
    checks.redis = redisCheck;
    if (redisCheck.status === 'down') {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
    } else if (redisCheck.status === 'degraded') {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    }

    // External services check
    const externalChecks = await this.checkExternalServices();
    checks.externalServices = externalChecks;
    for (const [service, health] of Object.entries(externalChecks)) {
      if (health.status === 'down') {
        overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
      }
    }

    // System health check
    const systemCheck = await this.checkSystemHealth();
    checks.system = systemCheck;
    if (systemCheck.status === 'down') {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: process.uptime(),
      memory: this.getMemoryUsage(),
      checks,
    };

    // Log health status
    this.logger.logHealthCheck('system', overallStatus, {
      overallStatus,
      database: dbCheck.status,
      redis: redisCheck.status,
      externalServices: Object.fromEntries(
        Object.entries(externalChecks).map(([k, v]) => [k, v.status])
      ),
      system: systemCheck.status,
    });

    return healthStatus;
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Additional database checks
      const connectionCount = await this.checkDatabaseConnections();
      const slowQueries = await this.checkSlowQueries();
      
      const health: ComponentHealth = {
        status: 'up',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: {
          connectionCount,
          slowQueries,
        },
      };

      // Check for performance issues
      if (slowQueries > 10 || connectionCount > 80) {
        health.status = 'degraded';
        health.message = 'Database performance degraded';
      }

      return health;
    } catch (error) {
      const health: ComponentHealth = {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Database connection failed',
        lastCheck: new Date().toISOString(),
      };
      
      this.logger.logErrorWithStack('Database health check failed', error as Error, {
        latencyMs: health.latencyMs,
      });
      
      return health;
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        return { 
          status: 'down', 
          message: 'REDIS_URL not configured',
          lastCheck: new Date().toISOString(),
        };
      }

      // Simulate Redis check (implement actual Redis client)
      // const redis = new Redis(redisUrl);
      // await redis.ping();
      
      const health: ComponentHealth = {
        status: 'up',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: {
          // Add Redis-specific metrics
          memory: 'N/A',
          connections: 'N/A',
        },
      };

      return health;
    } catch (error) {
      const health: ComponentHealth = {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Redis connection failed',
        lastCheck: new Date().toISOString(),
      };
      
      this.logger.logErrorWithStack('Redis health check failed', error as Error, {
        latencyMs: health.latencyMs,
      });
      
      return health;
    }
  }

  private async checkExternalServices(): Promise<Record<string, ComponentHealth>> {
    const services: Record<string, ComponentHealth> = {};

    // Check email service
    services.email = await this.checkEmailService();

    // Check external APIs
    services.apiGateway = await this.checkApiGateway();

    // Check monitoring service
    services.monitoring = await this.checkMonitoringService();

    return services;
  }

  private async checkEmailService(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Simulate email service check
      // const emailService = this.emailService;
      // await emailService.healthCheck();
      
      return {
        status: 'up',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: {
          provider: 'smtp',
          queueSize: 0,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Email service unavailable',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkApiGateway(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Simulate API gateway check
      return {
        status: 'up',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: {
          endpoint: process.env.API_GATEWAY_URL || 'N/A',
        },
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'API gateway unavailable',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkMonitoringService(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Simulate monitoring service check
      return {
        status: 'up',
        latencyMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: {
          endpoint: process.env.MONITORING_URL || 'N/A',
        },
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Monitoring service unavailable',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkSystemHealth(): Promise<SystemHealth> {
    const cpuUsage = await this.getCpuUsage();
    const memory = this.getMemoryUsage();
    const disk = await this.getDiskUsage();
    const loadAverage = process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0];

    let status: 'up' | 'down' = 'up';
    const issues: string[] = [];

    // Check CPU usage
    if (cpuUsage > 90) {
      status = 'down';
      issues.push('High CPU usage');
    } else if (cpuUsage > 70) {
      status = 'down';
      issues.push('Elevated CPU usage');
    }

    // Check memory usage
    if (memory.percentage > 90) {
      status = 'down';
      issues.push('High memory usage');
    } else if (memory.percentage > 80) {
      status = 'down';
      issues.push('Elevated memory usage');
    }

    // Check disk usage
    if (disk.percentage > 90) {
      status = 'down';
      issues.push('Low disk space');
    } else if (disk.percentage > 80) {
      status = 'down';
      issues.push('Low disk space');
    }

    return {
      status,
      cpu: cpuUsage,
      memory,
      disk,
      uptime: process.uptime(),
      loadAverage,
      details: issues.length > 0 ? { issues } : undefined,
    };
  }

  private getMemoryUsage(): MemoryUsage {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const usedMemory = totalMemory - require('os').freemem();

    return {
      used: usedMemory,
      total: totalMemory,
      percentage: Math.round((usedMemory / totalMemory) * 100),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapPercentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    };
  }

  private async getDiskUsage(): Promise<DiskUsage> {
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      // Simulate disk usage check (implement actual disk usage check)
      return {
        used: 0,
        total: 0,
        percentage: 0,
      };
    } catch (error) {
      return {
        used: 0,
        total: 0,
        percentage: 0,
      };
    }
  }

  private async getCpuUsage(): Promise<number> {
    try {
      const startUsage = process.cpuUsage();
      await new Promise(resolve => setTimeout(resolve, 100));
      const endUsage = process.cpuUsage(startUsage);
      
      const totalUsage = endUsage.user + endUsage.system;
      return Math.round(totalUsage / 1000000); // Convert to percentage
    } catch (error) {
      return 0;
    }
  }

  private async checkDatabaseConnections(): Promise<number> {
    try {
      // Implement actual connection count check
      return 5; // Placeholder
    } catch (error) {
      return 0;
    }
  }

  private async checkSlowQueries(): Promise<number> {
    try {
      // Implement actual slow query count check
      return 2; // Placeholder
    } catch (error) {
      return 0;
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

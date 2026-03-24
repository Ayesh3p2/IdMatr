import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class IspnService {
  private readonly logger = new Logger(IspnService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listApplications(
    tenantId: string,
    user: { id: string; role: string },
    filters: { search?: string; status?: string; page: string; limit: string }
  ) {
    const { search, status, page, limit } = filters;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          status: true,
          riskScore: true,
          criticality: true,
          owner: true,
          lastScanAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.application.count({ where })
    ]);

    return {
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  async getApplication(tenantId: string, id: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, tenantId },
      include: {
        integrations: {
          select: {
            id: true,
            provider: true,
            status: true,
            lastSyncAt: true,
            lastSyncStatus: true,
          }
        },
        riskAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  async createApplication(tenantId: string, user: { id: string; email: string }, createAppDto: any) {
    const { name, description, category, criticality = 'MEDIUM', owner } = createAppDto;

    const application = await this.prisma.application.create({
      data: {
        tenantId,
        name,
        description,
        category,
        criticality,
        owner,
        status: 'ACTIVE',
        riskScore: 50, // Default risk score
        createdBy: user.id,
      }
    });

    this.logger.log(`Application created: ${application.id} by ${user.email}`);

    return application;
  }

  async updateApplication(tenantId: string, id: string, updateAppDto: any, user: { id: string; email: string }) {
    const application = await this.prisma.application.findFirst({
      where: { id, tenantId }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: {
        ...updateAppDto,
        updatedAt: new Date(),
        updatedBy: user.id,
      }
    });

    this.logger.log(`Application updated: ${id} by ${user.email}`);

    return updatedApplication;
  }

  async deleteApplication(tenantId: string, id: string, user: { id: string; email: string }) {
    const application = await this.prisma.application.findFirst({
      where: { id, tenantId }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    await this.prisma.application.delete({
      where: { id }
    });

    this.logger.log(`Application deleted: ${id} by ${user.email}`);

    return { message: 'Application deleted successfully' };
  }

  async getRiskAssessment(tenantId: string, periodDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const [totalApps, highRiskApps, criticalApps, scannedApps] = await Promise.all([
      this.prisma.application.count({ where: { tenantId } }),
      this.prisma.application.count({ 
        where: { 
          tenantId,
          riskScore: { gte: 70 }
        } 
      }),
      this.prisma.application.count({ 
        where: { 
          tenantId,
          criticality: 'CRITICAL'
        } 
      }),
      this.prisma.application.count({ 
        where: { 
          tenantId,
          lastScanAt: { gte: cutoffDate }
        } 
      })
    ]);

    const appsByCategory = await this.prisma.application.groupBy({
      by: ['category'],
      where: { tenantId },
      _count: true
    });

    const appsByRisk = await this.prisma.application.groupBy({
      by: ['criticality'],
      where: { tenantId },
      _count: true
    });

    return {
      summary: {
        totalApps,
        highRiskApps,
        lowRiskApps: totalApps - highRiskApps,
        criticalApps,
        standardApps: totalApps - criticalApps,
        scannedApps,
        unscannedApps: totalApps - scannedApps,
        scanCoverage: totalApps > 0 ? Math.round((scannedApps / totalApps) * 100) : 0
      },
      byCategory: appsByCategory.map(app => ({
        category: app.category,
        count: app._count
      })),
      byRisk: appsByRisk.map(app => ({
        criticality: app.criticality,
        count: app._count
      })),
      period: `${periodDays} days`
    };
  }

  async getComplianceStatus(tenantId: string) {
    const frameworks = ['SOC2', 'ISO27001', 'NIST', 'HIPAA'];
    const complianceData = [];

    for (const framework of frameworks) {
      const totalControls = 50; // Simplified - in real implementation would fetch from database
      const compliantControls = Math.floor(Math.random() * totalControls);
      
      complianceData.push({
        framework,
        totalControls,
        compliantControls,
        complianceRate: Math.round((compliantControls / totalControls) * 100),
        status: compliantControls / totalControls > 0.8 ? 'COMPLIANT' : 'PARTIAL'
      });
    }

    return {
      frameworks: complianceData,
      overallCompliance: Math.round(complianceData.reduce((sum, f) => sum + f.complianceRate, 0) / frameworks.length),
      lastAssessment: new Date()
    };
  }

  async scanApplications(tenantId: string, user: { id: string; email: string }) {
    const applications = await this.prisma.application.findMany({
      where: { tenantId },
      select: { id: true, name: true }
    });

    const scanResults = [];

    for (const app of applications) {
      // Simulate security scan
      const riskScore = Math.floor(Math.random() * 100);
      const vulnerabilities = Math.floor(Math.random() * 10);
      
      await this.prisma.application.update({
        where: { id: app.id },
        data: {
          riskScore,
          lastScanAt: new Date(),
          lastScanStatus: 'SUCCESS'
        }
      });

      // Create risk assessment record
      await this.prisma.riskAssessment.create({
        data: {
          tenantId,
          applicationId: app.id,
          riskScore,
          vulnerabilities,
          status: riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW',
          assessedBy: user.id,
          findings: `Scan completed with ${vulnerabilities} vulnerabilities found`
        }
      });

      scanResults.push({
        applicationId: app.id,
        applicationName: app.name,
        riskScore,
        vulnerabilities,
        status: 'SUCCESS'
      });
    }

    this.logger.log(`Security scan completed for ${applications.length} applications by ${user.email}`);

    return {
      scanned: applications.length,
      results: scanResults,
      scanDate: new Date()
    };
  }

  async getVulnerabilities(tenantId: string, severity?: string) {
    const where: any = { tenantId };
    
    if (severity) {
      where.severity = severity.toUpperCase();
    }

    const vulnerabilities = await this.prisma.vulnerability.findMany({
      where,
      include: {
        application: {
          select: {
            name: true,
            category: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return {
      vulnerabilities,
      count: vulnerabilities.length,
      severity: severity || 'ALL'
    };
  }

  async getIntegrations(tenantId: string) {
    const integrations = await this.prisma.tenantIntegration.findMany({
      where: { tenantId },
      select: {
        id: true,
        provider: true,
        status: true,
        enabled: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        errorCount: true,
        syncCount: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      integrations,
      total: integrations.length,
      active: integrations.filter(i => i.enabled).length,
      healthy: integrations.filter(i => i.lastSyncStatus === 'success').length
    };
  }
}

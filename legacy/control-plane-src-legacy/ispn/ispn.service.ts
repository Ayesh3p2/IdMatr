import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IspnService {
  constructor(private readonly prisma: PrismaService) {}

  // 🔒 FIXED: Real application security posture management
  async getApplications(tenantId: string) {
    return this.prisma.integration.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        provider: true,
        configJson: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplication(id: string, tenantId: string) {
    const application = await this.prisma.integration.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        provider: true,
        configJson: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  async createApplication(tenantId: string, data: any) {
    const { name, provider, configJson, enabled = true } = data;

    return this.prisma.integration.create({
      data: {
        name,
        provider,
        configJson: configJson || {},
        enabled,
        tenantId,
      },
      select: {
        id: true,
        name: true,
        provider: true,
        configJson: true,
        enabled: true,
        createdAt: true,
      },
    });
  }

  async updateApplication(id: string, tenantId: string, data: any) {
    const application = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const { name, provider, configJson, enabled } = data;

    return this.prisma.integration.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(provider && { provider }),
        ...(configJson && { configJson }),
        ...(enabled !== undefined && { enabled }),
      },
      select: {
        id: true,
        name: true,
        provider: true,
        configJson: true,
        enabled: true,
        updatedAt: true,
      },
    });
  }

  async deleteApplication(id: string, tenantId: string) {
    const application = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    await this.prisma.integration.delete({
      where: { id },
    });

    return { message: 'Application deleted successfully' };
  }

  // 🔒 FIXED: Real risk assessment based on application data
  async getRiskAssessment(id: string, tenantId: string) {
    const application = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Calculate real risk score based on application properties
    const riskFactors = {
      externalApi: application.configJson?.externalApi ? 20 : 0,
      authentication: application.configJson?.authRequired ? 10 : 30,
      dataSensitivity: application.configJson?.sensitiveData ? 25 : 5,
      userAccess: application.configJson?.userFacing ? 15 : 5,
      integrationComplexity: Object.keys(application.configJson || {}).length * 2,
    };

    const riskScore = Math.min(100, Object.values(riskFactors).reduce((a, b) => a + b, 0));

    return {
      applicationId: id,
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      factors: riskFactors,
      recommendations: this.getRecommendations(riskScore, riskFactors),
      lastAssessed: new Date(),
    };
  }

  // 🔒 FIXED: Real compliance status based on application properties
  async getComplianceStatus(id: string, tenantId: string) {
    const application = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const config = application.configJson || {};
    
    const complianceChecks = {
      dataEncryption: config.encryptionEnabled || false,
      accessControl: config.accessControl || false,
      auditLogging: config.auditLogging || false,
      dataRetention: config.dataRetentionPolicy || false,
      secureCommunication: config.httpsOnly || false,
    };

    const complianceScore = Object.values(complianceChecks).filter(Boolean).length / Object.keys(complianceChecks).length * 100;

    return {
      applicationId: id,
      complianceScore: Math.round(complianceScore),
      status: complianceScore >= 80 ? 'COMPLIANT' : complianceScore >= 60 ? 'PARTIAL' : 'NON_COMPLIANT',
      checks: complianceChecks,
      lastUpdated: new Date(),
      nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
  }

  async scanApplication(id: string, tenantId: string) {
    const application = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Simulate security scan results
    const scanResults = {
      scanId: crypto.randomUUID(),
      timestamp: new Date(),
      status: 'COMPLETED',
      vulnerabilities: this.generateVulnerabilities(application),
      securityScore: Math.floor(Math.random() * 30) + 70, // 70-100
      recommendations: [
        'Enable multi-factor authentication',
        'Implement rate limiting',
        'Update dependencies regularly',
        'Enable security headers',
      ],
    };

    return scanResults;
  }

  async getVulnerabilities(tenantId: string) {
    const applications = await this.prisma.integration.findMany({
      where: { tenantId },
    });

    const vulnerabilities = applications.flatMap(app => 
      this.generateVulnerabilities(app).map(vuln => ({
        ...vuln,
        applicationId: app.id,
        applicationName: app.name,
      }))
    );

    return vulnerabilities.sort((a, b) => b.severityScore - a.severityScore);
  }

  async getIntegrations(tenantId: string) {
    return this.prisma.integration.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        provider: true,
        enabled: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  private getRiskLevel(score: number): string {
    if (score >= 80) return 'HIGH';
    if (score >= 60) return 'MEDIUM';
    if (score >= 40) return 'LOW';
    return 'MINIMAL';
  }

  private getRecommendations(score: number, factors: any): string[] {
    const recommendations = [];
    
    if (score >= 80) {
      recommendations.push('Implement additional security controls');
      recommendations.push('Conduct regular security assessments');
    }
    
    if (factors.externalApi) {
      recommendations.push('Implement API rate limiting');
      recommendations.push('Add API authentication');
    }
    
    if (factors.dataSensitivity) {
      recommendations.push('Enable data encryption');
      recommendations.push('Implement access controls');
    }
    
    return recommendations;
  }

  private generateVulnerabilities(application: any) {
    const vulnerabilities = [];
    const config = application.configJson || {};
    
    if (!config.encryptionEnabled) {
      vulnerabilities.push({
        id: crypto.randomUUID(),
        type: 'DATA_ENCRYPTION',
        severity: 'HIGH',
        severityScore: 90,
        description: 'Data encryption is not enabled',
        recommendation: 'Enable encryption for sensitive data',
      });
    }
    
    if (!config.accessControl) {
      vulnerabilities.push({
        id: crypto.randomUUID(),
        type: 'ACCESS_CONTROL',
        severity: 'MEDIUM',
        severityScore: 70,
        description: 'Access controls are not implemented',
        recommendation: 'Implement proper access controls',
      });
    }
    
    if (!config.auditLogging) {
      vulnerabilities.push({
        id: crypto.randomUUID(),
        type: 'AUDIT_LOGGING',
        severity: 'MEDIUM',
        severityScore: 60,
        description: 'Audit logging is not enabled',
        recommendation: 'Enable comprehensive audit logging',
      });
    }
    
    return vulnerabilities;
  }
}

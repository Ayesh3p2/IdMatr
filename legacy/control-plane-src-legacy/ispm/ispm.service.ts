import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IspmService {
  private readonly logger = new Logger(IspmService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listApplications(
    tenantId: string,
    user: { id: string; role: string },
    filters: { status?: string; category?: string; risk?: string; page: string; limit: string }
  ) {
    const { status, category, risk, page, limit } = filters;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { tenantId };

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    if (risk) {
      where.riskLevel = risk;
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
          riskLevel: true,
          owner: true,
          contactEmail: true,
          lastReviewed: true,
          nextReviewDate: true,
          complianceStatus: true,
          userCount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
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

  async getApplication(tenantId: string, id: string, user: { id: string; role: string }) {
    const application = await this.prisma.application.findFirst({
      where: { id, tenantId },
      include: {
        accessPolicies: true,
        complianceChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 10
        },
        recentAccess: {
          orderBy: { accessedAt: 'desc' },
          take: 50
        }
      }
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  async createApplication(tenantId: string, user: { id: string; email: string }, createAppDto: any) {
    const {
      name,
      description,
      category,
      riskLevel = 'MEDIUM',
      owner,
      contactEmail,
      accessUrl,
      authenticationMethod,
      dataClassification = 'INTERNAL'
    } = createAppDto;

    // Validate required fields
    if (!name || !owner || !contactEmail) {
      throw new BadRequestException('Name, owner, and contact email are required');
    }

    // Check for duplicate application
    const existing = await this.prisma.application.findFirst({
      where: { 
        tenantId, 
        name: { equals: name, mode: 'insensitive' } 
      }
    });

    if (existing) {
      throw new BadRequestException('Application with this name already exists');
    }

    const application = await this.prisma.application.create({
      data: {
        tenantId,
        name,
        description,
        category,
        riskLevel,
        owner,
        contactEmail,
        accessUrl,
        authenticationMethod,
        dataClassification,
        status: 'ACTIVE',
        complianceStatus: 'PENDING_REVIEW',
        nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        createdBy: user.id,
      }
    });

    this.logger.log(`Application created: ${application.id} by ${user.email}`);

    return application;
  }

  async updateApplication(tenantId: string, id: string, user: { id: string; email: string }, updateAppDto: any) {
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

  async listPolicies(tenantId: string, filters: { type?: string; status?: string }) {
    const { type, status } = filters;
    const where: any = { tenantId };

    if (type) {
      where.policyType = type;
    }

    if (status) {
      where.status = status;
    }

    const policies = await this.prisma.securityPolicy.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        policyType: true,
        status: true,
        severity: true,
        rules: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
      orderBy: { name: 'asc' }
    });

    return {
      policies,
      count: policies.length
    };
  }

  async createPolicy(tenantId: string, user: { id: string; email: string }, createPolicyDto: any) {
    const {
      name,
      description,
      policyType,
      severity = 'MEDIUM',
      rules,
      effectiveDate
    } = createPolicyDto;

    if (!name || !policyType || !rules) {
      throw new BadRequestException('Name, policy type, and rules are required');
    }

    const policy = await this.prisma.securityPolicy.create({
      data: {
        tenantId,
        name,
        description,
        policyType,
        severity,
        rules,
        status: 'DRAFT',
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        createdBy: user.id,
      }
    });

    this.logger.log(`Security policy created: ${policy.id} by ${user.email}`);

    return policy;
  }

  async updatePolicy(tenantId: string, id: string, user: { id: string; email: string }, updatePolicyDto: any) {
    const policy = await this.prisma.securityPolicy.findFirst({
      where: { id, tenantId }
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    const updatedPolicy = await this.prisma.securityPolicy.update({
      where: { id },
      data: {
        ...updatePolicyDto,
        updatedAt: new Date(),
        updatedBy: user.id,
      }
    });

    this.logger.log(`Security policy updated: ${id} by ${user.email}`);

    return updatedPolicy;
  }

  async getRiskAssessment(tenantId: string) {
    const [totalApps, highRiskApps, mediumRiskApps, lowRiskApps, criticalApps] = await Promise.all([
      this.prisma.application.count({ where: { tenantId } }),
      this.prisma.application.count({ 
        where: { tenantId, riskLevel: 'HIGH' } 
      }),
      this.prisma.application.count({ 
        where: { tenantId, riskLevel: 'MEDIUM' } 
      }),
      this.prisma.application.count({ 
        where: { tenantId, riskLevel: 'LOW' } 
      }),
      this.prisma.application.count({ 
        where: { tenantId, riskLevel: 'CRITICAL' } 
      })
    ]);

    const appsByCategory = await this.prisma.application.groupBy({
      by: ['category'],
      where: { tenantId },
      _count: true
    });

    const complianceStatus = await this.prisma.application.groupBy({
      by: ['complianceStatus'],
      where: { tenantId },
      _count: true
    });

    // Calculate risk score
    const riskScore = (criticalApps * 4) + (highRiskApps * 3) + (mediumRiskApps * 2) + (lowRiskApps * 1);
    const maxRiskScore = totalApps * 4;
    const riskPercentage = maxRiskScore > 0 ? Math.round((riskScore / maxRiskScore) * 100) : 0;

    return {
      summary: {
        totalApplications: totalApps,
        riskDistribution: {
          critical: criticalApps,
          high: highRiskApps,
          medium: mediumRiskApps,
          low: lowRiskApps
        },
        riskScore: Math.round(riskPercentage),
        byCategory: appsByCategory.map(c => ({
          category: c.category,
          count: c._count
        })),
        complianceStatus: complianceStatus.map(c => ({
          status: c.complianceStatus,
          count: c._count
        }))
      },
      recommendations: this.generateRiskRecommendations({
        critical: criticalApps,
        high: highRiskApps,
        medium: mediumRiskApps,
        low: lowRiskApps
      })
    };
  }

  async getComplianceReport(tenantId: string, standard: string) {
    const applications = await this.prisma.application.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        category: true,
        riskLevel: true,
        complianceStatus: true,
        lastReviewed: true,
        nextReviewDate: true,
      }
    });

    const complianceRequirements = this.getComplianceRequirements(standard);
    
    const report = {
      standard,
      generatedAt: new Date(),
      summary: {
        totalApplications: applications.length,
        compliant: applications.filter(app => app.complianceStatus === 'COMPLIANT').length,
        nonCompliant: applications.filter(app => app.complianceStatus === 'NON_COMPLIANT').length,
        pendingReview: applications.filter(app => app.complianceStatus === 'PENDING_REVIEW').length,
        overallScore: 0 // Will be calculated
      },
      applications: applications.map(app => ({
        ...app,
        requirements: complianceRequirements[app.category] || [],
        status: this.evaluateCompliance(app, complianceRequirements[app.category] || [])
      })),
      recommendations: this.generateComplianceRecommendations(applications, standard)
    };

    // Calculate overall compliance score
    const totalRequirements = Object.values(complianceRequirements).flat().length;
    const metRequirements = report.applications.reduce((total, app) => {
      const met = app.requirements.filter(req => app.status[req] === true).length;
      return total + met;
    }, 0);
    
    report.summary.overallScore = totalRequirements > 0 ? Math.round((metRequirements / totalRequirements) * 100) : 0;

    return report;
  }

  async getAnalytics(tenantId: string, periodDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const [totalApps, newApps, updatedApps, complianceChecks] = await Promise.all([
      this.prisma.application.count({ where: { tenantId } }),
      this.prisma.application.count({
        where: {
          tenantId,
          createdAt: { gte: cutoffDate }
        }
      }),
      this.prisma.application.count({
        where: {
          tenantId,
          updatedAt: { gte: cutoffDate }
        }
      }),
      this.prisma.complianceCheck.count({
        where: {
          tenantId,
          checkedAt: { gte: cutoffDate }
        }
      })
    ]);

    const appsByRisk = await this.prisma.application.groupBy({
      by: ['riskLevel'],
      where: { tenantId },
      _count: true
    });

    const policiesByType = await this.prisma.securityPolicy.groupBy({
      by: ['policyType'],
      where: { tenantId },
      _count: true
    });

    return {
      summary: {
        totalApplications: totalApps,
        newApplications: newApps,
        updatedApplications: updatedApps,
        complianceChecks: complianceChecks,
        avgRiskScore: this.calculateAvgRiskScore(appsByRisk)
      },
      trends: {
        applicationsByRisk: appsByRisk.map(r => ({
          risk: r.riskLevel,
          count: r._count
        })),
        policiesByType: policiesByType.map(p => ({
          type: p.policyType,
          count: p._count
        }))
      },
      period: `${periodDays} days`
    };
  }

  private generateRiskRecommendations(riskDistribution: any) {
    const recommendations = [];

    if (riskDistribution.critical > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Risk Mitigation',
        recommendation: 'Immediate review and remediation required for critical risk applications',
        action: 'Schedule security assessment within 7 days'
      });
    }

    if (riskDistribution.high > riskDistribution.critical * 2) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Risk Management',
        recommendation: 'High number of high-risk applications detected',
        action: 'Implement additional security controls'
      });
    }

    if (riskDistribution.medium > riskDistribution.low) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Risk Reduction',
        recommendation: 'Consider security enhancements for medium-risk applications',
        action: 'Plan security improvements in next quarter'
      });
    }

    return recommendations;
  }

  private getComplianceRequirements(standard: string) {
    const requirements = {
      SOC2: {
        'Access Control': ['Multi-factor authentication', 'Role-based access', 'Access reviews'],
        'Encryption': ['Data at rest', 'Data in transit'],
        'Monitoring': ['Audit logging', 'Security monitoring'],
        'Incident Response': ['Breach notification', 'Response procedures']
      },
      ISO27001: {
        'Information Security': ['Security policy', 'Risk assessment'],
        'Access Control': ['User access management', 'System access control'],
        'Cryptography': ['Key management', 'Encryption standards'],
        'Operations Security': ['Backup procedures', 'Malware protection']
      },
      GDPR: {
        'Data Protection': ['Data minimization', 'Consent management'],
        'User Rights': ['Access requests', 'Data portability', 'Right to be forgotten'],
        'Security': 'Encryption and pseudonymization',
        'Breach Management': ['72-hour notification', 'Impact assessment']
      },
      HIPAA: {
        'Administrative': ['Security officer', 'Training programs'],
        'Physical': ['Facility access', 'Workstation security'],
        'Technical': ['Access control', 'Audit controls', 'Integrity controls']
      }
    };

    return requirements[standard] || {};
  }

  private evaluateCompliance(application: any, requirements: string[]) {
    const status: any = {};
    
    requirements.forEach(req => {
      // Simplified compliance evaluation
      status[req] = application.complianceStatus === 'COMPLIANT';
    });

    return status;
  }

  private generateComplianceRecommendations(applications: any[], standard: string) {
    const nonCompliant = applications.filter(app => app.complianceStatus === 'NON_COMPLIANT');
    
    if (nonCompliant.length === 0) {
      return [{
        priority: 'LOW',
        category: 'Maintenance',
        recommendation: 'All applications are compliant',
        action: 'Continue regular compliance monitoring'
      }];
    }

    const recommendations = [
      {
        priority: 'HIGH',
        category: 'Compliance',
        recommendation: `${nonCompliant.length} applications require compliance remediation`,
        action: 'Schedule compliance review within 30 days'
      }
    ];

    if (standard === 'SOC2' || standard === 'ISO27001') {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Documentation',
        recommendation: 'Update security policies and procedures',
        action: 'Review and update documentation quarterly'
      });
    }

    return recommendations;
  }

  private calculateAvgRiskScore(appsByRisk: any[]) {
    const total = appsByRisk.reduce((sum, app) => {
      const riskValue = this.getRiskValue(app.riskLevel);
      return sum + (riskValue * app._count);
    }, 0);

    const count = appsByRisk.reduce((sum, app) => sum + app._count, 0);
    
    return count > 0 ? Math.round(total / count) : 0;
  }

  private getRiskValue(riskLevel: string): number {
    const values = {
      'LOW': 1,
      'MEDIUM': 2,
      'HIGH': 3,
      'CRITICAL': 4
    };

    return values[riskLevel] || 2;
  }
}

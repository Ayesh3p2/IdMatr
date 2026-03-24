import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ItdrService {
  private readonly logger = new Logger(ItdrService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listEvents(
    tenantId: string,
    filters: { 
      severity?: string; 
      type?: string; 
      status?: string; 
      startDate?: string; 
      endDate?: string; 
      page: string; 
      limit: string 
    }
  ) {
    const { severity, type, status, startDate, endDate, page, limit } = filters;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { tenantId };

    if (severity) {
      where.severity = severity;
    }

    if (type) {
      where.eventType = type;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    const [events, total] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where,
        select: {
          id: true,
          eventType: true,
          severity: true,
          status: true,
          title: true,
          description: true,
          sourceIp: true,
          userAgent: true,
          userId: true,
          timestamp: true,
          metadata: true,
          relatedAlertId: true,
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take,
      }),
      this.prisma.securityEvent.count({ where })
    ]);

    return {
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  async getEvent(tenantId: string, id: string) {
    const event = await this.prisma.securityEvent.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        },
        relatedAlert: true,
        investigation: {
          include: {
            investigator: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async getAlerts(tenantId: string, filters: { priority?: string; status?: string; page: string; limit: string }) {
    const { priority, status, page, limit } = filters;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { tenantId };

    if (priority) {
      where.priority = priority;
    }

    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['ACTIVE', 'ACKNOWLEDGED'] }; // Don't show resolved by default
    }

    const [alerts, total] = await Promise.all([
      this.prisma.securityAlert.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          category: true,
          sourceEventId: true,
          createdAt: true,
          acknowledgedAt: true,
          resolvedAt: true,
          acknowledgedBy: true,
          resolvedBy: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.securityAlert.count({ where })
    ]);

    return {
      alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  async acknowledgeAlert(tenantId: string, id: string, user: { id: string; email: string }, comments?: string) {
    const alert = await this.prisma.securityAlert.findFirst({
      where: { id, tenantId, status: 'ACTIVE' }
    });

    if (!alert) {
      throw new NotFoundException('Active alert not found');
    }

    const updatedAlert = await this.prisma.securityAlert.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: user.id,
      }
    });

    // Add acknowledgment comment
    if (comments) {
      await this.prisma.alertComment.create({
        data: {
          alertId: id,
          userId: user.id,
          comment: comments,
          type: 'ACKNOWLEDGMENT'
        }
      });
    }

    this.logger.log(`Alert ${id} acknowledged by ${user.email}`);

    return updatedAlert;
  }

  async resolveAlert(tenantId: string, id: string, user: { id: string; email: string }, resolution: string, comments?: string) {
    const alert = await this.prisma.securityAlert.findFirst({
      where: { id, tenantId, status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } }
    });

    if (!alert) {
      throw new NotFoundException('Alert not found or already resolved');
    }

    const updatedAlert = await this.prisma.securityAlert.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: user.id,
        resolution: resolution,
      }
    });

    // Add resolution comment
    if (comments) {
      await this.prisma.alertComment.create({
        data: {
          alertId: id,
          userId: user.id,
          comment: comments,
          type: 'RESOLUTION'
        }
      });
    }

    this.logger.log(`Alert ${id} resolved by ${user.email}: ${resolution}`);

    return updatedAlert;
  }

  async getDashboard(tenantId: string, period: string) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const [totalEvents, criticalAlerts, activeIncidents, blockedAttempts] = await Promise.all([
      this.prisma.securityEvent.count({
        where: {
          tenantId,
          timestamp: { gte: startDate }
        }
      }),
      this.prisma.securityAlert.count({
        where: {
          tenantId,
          priority: 'CRITICAL',
          status: 'ACTIVE',
          createdAt: { gte: startDate }
        }
      }),
      this.prisma.securityIncident.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'INVESTIGATING'] },
          createdAt: { gte: startDate }
        }
      }),
      this.prisma.securityEvent.count({
        where: {
          tenantId,
          eventType: 'FAILED_LOGIN',
          timestamp: { gte: startDate }
        }
      })
    ]);

    const recentEvents = await this.prisma.securityEvent.findMany({
      where: {
        tenantId,
        timestamp: { gte: startDate }
      },
      select: {
        id: true,
        eventType: true,
        severity: true,
        title: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    const topThreats = await this.prisma.securityEvent.groupBy({
      by: ['eventType'],
      where: {
        tenantId,
        timestamp: { gte: startDate }
      },
      _count: true,
      orderBy: {
        _count: 'desc'
      },
      take: 5
    });

    return {
      summary: {
        totalEvents,
        criticalAlerts,
        activeIncidents,
        blockedAttempts,
        period
      },
      recentEvents,
      topThreats: topThreats.map(t => ({
        type: t.eventType,
        count: t._count
      })),
      lastUpdated: now
    };
  }

  async getThreatIntelligence(tenantId: string, type?: string) {
    // Mock threat intelligence data
    const indicators = [
      {
        id: '1',
        type: 'IP_ADDRESS',
        value: '192.168.1.100',
        severity: 'HIGH',
        source: 'Internal Threat Feed',
        firstSeen: new Date('2024-01-15'),
        description: 'Known malicious IP address'
      },
      {
        id: '2',
        type: 'DOMAIN',
        value: 'malicious-example.com',
        severity: 'CRITICAL',
        source: 'External Threat Intel',
        firstSeen: new Date('2024-02-01'),
        description: 'C2 server domain'
      }
    ];

    const campaigns = [
      {
        id: '1',
        name: 'Credential Stuffing Attack',
        severity: 'HIGH',
        status: 'ACTIVE',
        startDate: new Date('2024-03-01'),
        description: 'Ongoing credential stuffing attacks targeting user accounts',
        affectedSystems: ['Auth Service', 'API Gateway']
      }
    ];

    const vulnerabilities = [
      {
        id: '1',
        cve: 'CVE-2024-1234',
        severity: 'CRITICAL',
        cvssScore: 9.8,
        affectedComponent: 'Authentication Module',
        description: 'Remote code execution vulnerability in auth module',
        publishedDate: new Date('2024-02-15'),
        remediation: 'Update to version 2.1.0 or later'
      }
    ];

    let data: any = {};

    if (!type || type === 'INDICATORS') {
      data.indicators = indicators;
    }

    if (!type || type === 'CAMPAIGNS') {
      data.campaigns = campaigns;
    }

    if (!type || type === 'VULNERABILITIES') {
      data.vulnerabilities = vulnerabilities;
    }

    return data;
  }

  async getIncidents(tenantId: string, filters: { status?: string; severity?: string; page: string; limit: string }) {
    const { status, severity, page, limit } = filters;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { tenantId };

    if (status) {
      where.status = status;
    }

    if (severity) {
      where.severity = severity;
    }

    const [incidents, total] = await Promise.all([
      this.prisma.securityIncident.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          severity: true,
          status: true,
          category: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
          assignedTo: true,
          reporter: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.securityIncident.count({ where })
    ]);

    return {
      incidents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  async createIncident(tenantId: string, user: { id: string; email: string }, createIncidentDto: any) {
    const {
      title,
      description,
      severity = 'MEDIUM',
      category,
      affectedSystems,
      impact
    } = createIncidentDto;

    if (!title || !description || !category) {
      throw new BadRequestException('Title, description, and category are required');
    }

    const incident = await this.prisma.securityIncident.create({
      data: {
        tenantId,
        title,
        description,
        severity,
        category,
        affectedSystems,
        impact,
        status: 'OPEN',
        reporterId: user.id,
      }
    });

    this.logger.log(`Security incident created: ${incident.id} by ${user.email}`);

    return incident;
  }

  async getAnalytics(tenantId: string, periodDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const [totalEvents, eventsBySeverity, eventsByType, alertsByPriority, resolvedIncidents] = await Promise.all([
      this.prisma.securityEvent.count({
        where: {
          tenantId,
          timestamp: { gte: cutoffDate }
        }
      }),
      this.prisma.securityEvent.groupBy({
        by: ['severity'],
        where: {
          tenantId,
          timestamp: { gte: cutoffDate }
        },
        _count: true
      }),
      this.prisma.securityEvent.groupBy({
        by: ['eventType'],
        where: {
          tenantId,
          timestamp: { gte: cutoffDate }
        },
        _count: true
      }),
      this.prisma.securityAlert.groupBy({
        by: ['priority'],
        where: {
          tenantId,
          createdAt: { gte: cutoffDate }
        },
        _count: true
      }),
      this.prisma.securityIncident.count({
        where: {
          tenantId,
          status: 'RESOLVED',
          resolvedAt: { gte: cutoffDate }
        }
      })
    ]);

    const avgResolutionTime = await this.prisma.securityIncident.aggregate({
      where: {
        tenantId,
        status: 'RESOLVED',
        resolvedAt: { gte: cutoffDate }
      },
      _avg: {
        resolvedAt: {
          subtract: 'createdAt'
        }
      }
    });

    return {
      summary: {
        totalEvents,
        resolvedIncidents,
        avgResolutionTimeHours: avgResolutionTime._avg ? Math.round(avgResolutionTime._avg.resolvedAt / (1000 * 60 * 60)) : 0
      },
      eventsBySeverity: eventsBySeverity.map(e => ({
        severity: e.severity,
        count: e._count
      })),
      eventsByType: eventsByType.map(e => ({
        type: e.eventType,
        count: e._count
      })),
      alertsByPriority: alertsByPriority.map(a => ({
        priority: a.priority,
        count: a._count
      })),
      period: `${periodDays} days`
    };
  }

  async getPlaybooks(tenantId: string, category?: string) {
    const playbooks = [
      {
        id: '1',
        name: 'Malware Detection Response',
        category: 'Incident Response',
        severity: 'HIGH',
        steps: [
          { step: 1, action: 'Isolate affected system', estimatedTime: '15 min' },
          { step: 2, action: 'Run malware scan', estimatedTime: '30 min' },
          { step: 3, action: 'Collect forensic evidence', estimatedTime: '45 min' },
          { step: 4, action: 'Eradicate malware', estimatedTime: '60 min' },
          { step: 5, action: 'Recover systems', estimatedTime: '30 min' }
        ],
        lastUpdated: new Date('2024-02-01')
      },
      {
        id: '2',
        name: 'Data Breach Response',
        category: 'Incident Response',
        severity: 'CRITICAL',
        steps: [
          { step: 1, action: 'Activate incident response team', estimatedTime: '5 min' },
          { step: 2, action: 'Assess breach scope', estimatedTime: '60 min' },
          { step: 3, action: 'Contain breach', estimatedTime: '120 min' },
          { step: 4, action: 'Notify stakeholders', estimatedTime: '30 min' },
          { step: 5, action: 'Initiate forensic investigation', estimatedTime: '180 min' }
        ],
        lastUpdated: new Date('2024-01-15')
      },
      {
        id: '3',
        name: 'DDoS Mitigation',
        category: 'Incident Response',
        severity: 'HIGH',
        steps: [
          { step: 1, action: 'Identify attack vectors', estimatedTime: '10 min' },
          { step: 2, action: 'Activate DDoS protection', estimatedTime: '5 min' },
          { step: 3, action: 'Rate limiting configuration', estimatedTime: '15 min' },
          { step: 4, action: 'Block malicious IPs', estimatedTime: '20 min' },
          { step: 5, action: 'Monitor attack patterns', estimatedTime: 'Ongoing' }
        ],
        lastUpdated: new Date('2024-02-10')
      }
    ];

    let filteredPlaybooks = playbooks;
    if (category) {
      filteredPlaybooks = playbooks.filter(pb => pb.category === category);
    }

    return {
      playbooks: filteredPlaybooks,
      count: filteredPlaybooks.length
    };
  }

  async investigateEvent(tenantId: string, id: string, user: { id: string; email: string }, investigationData: any) {
    const event = await this.prisma.securityEvent.findFirst({
      where: { id, tenantId }
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Create investigation record
    const investigation = await this.prisma.eventInvestigation.create({
      data: {
        eventId: id,
        investigatorId: user.id,
        status: 'INVESTIGATING',
        priority: investigationData.priority || 'MEDIUM',
        notes: investigationData.notes || '',
        assignedTo: investigationData.assignedTo || user.id,
        startedAt: new Date()
      }
    });

    // Update event status
    await this.prisma.securityEvent.update({
      where: { id },
      data: {
        status: 'INVESTIGATING'
      }
    });

    this.logger.log(`Investigation started for event ${id} by ${user.email}`);

    return investigation;
  }
}

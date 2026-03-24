import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ItdrService {
  constructor(private readonly prisma: PrismaService) {}

  // 🔒 FIXED: Real security event management using audit logs
  async getEvents(tenantId: string, page = 1, limit = 20, severity?: string) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      ...(severity && { severity }),
    };

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        select: {
          id: true,
          action: true,
          resource: true,
          severity: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getEvent(id: string, tenantId: string) {
    const event = await this.prisma.auditEvent.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  // 🔒 FIXED: Real alert management based on security events
  async getAlerts(tenantId: string, status?: string) {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        severity: { in: ['HIGH', 'CRITICAL'] },
        ...(status && { status }),
      },
      select: {
        id: true,
        action: true,
        resource: true,
        severity: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform events into alerts
    const alerts = events.map(event => ({
      id: event.id,
      type: this.getAlertType(event.action),
      severity: event.severity,
      title: this.getAlertTitle(event),
      description: event.metadata?.description || event.action,
      status: status || 'ACTIVE',
      source: event.resource,
      createdAt: event.createdAt,
      acknowledgedAt: null,
      resolvedAt: null,
    }));

    return alerts;
  }

  async acknowledgeAlert(id: string, tenantId: string) {
    const event = await this.prisma.auditEvent.findFirst({
      where: { id, tenantId },
    });

    if (!event) {
      throw new NotFoundException('Alert not found');
    }

    // Update event metadata to mark as acknowledged
    await this.prisma.auditEvent.update({
      where: { id },
      data: {
        metadata: {
          ...event.metadata,
          acknowledgedAt: new Date(),
          acknowledged: true,
        },
      },
    });

    return { message: 'Alert acknowledged successfully' };
  }

  async resolveAlert(id: string, tenantId: string, resolution?: string) {
    const event = await this.prisma.auditEvent.findFirst({
      where: { id, tenantId },
    });

    if (!event) {
      throw new NotFoundException('Alert not found');
    }

    // Update event metadata to mark as resolved
    await this.prisma.auditEvent.update({
      where: { id },
      data: {
        metadata: {
          ...event.metadata,
          resolvedAt: new Date(),
          resolved: true,
          resolution,
        },
      },
    });

    return { message: 'Alert resolved successfully' };
  }

  // 🔒 FIXED: Real dashboard analytics
  async getDashboard(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalEvents,
      criticalEvents,
      highEvents,
      recentEvents,
      alerts,
    ] = await Promise.all([
      this.prisma.auditEvent.count({ where: { tenantId } }),
      this.prisma.auditEvent.count({ where: { tenantId, severity: 'CRITICAL' } }),
      this.prisma.auditEvent.count({ where: { tenantId, severity: 'HIGH' } }),
      this.prisma.auditEvent.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
      this.getAlerts(tenantId, 'ACTIVE'),
    ]);

    const securityScore = Math.max(0, 100 - (criticalEvents * 10) - (highEvents * 5));

    return {
      overview: {
        totalEvents,
        criticalEvents,
        highEvents,
        recentEvents,
        securityScore,
      },
      alerts: {
        active: alerts.length,
        critical: alerts.filter(a => a.severity === 'CRITICAL').length,
        high: alerts.filter(a => a.severity === 'HIGH').length,
      },
      trends: {
        eventsThisMonth: recentEvents,
        averageDaily: Math.round(recentEvents / 30),
      },
    };
  }

  // 🔒 FIXED: Real threat intelligence based on events
  async getThreatIntelligence(tenantId: string) {
    const events = await this.prisma.auditEvent.findMany({
      where: { tenantId },
      select: {
        action: true,
        severity: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Analyze patterns from real events
    const threats = this.analyzeThreats(events);

    return {
      threats,
      indicators: this.getIndicators(events),
      recommendations: this.getRecommendations(events),
      lastUpdated: new Date(),
    };
  }

  async getAnalytics(tenantId: string, period = '30d') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      select: {
        action: true,
        severity: true,
        createdAt: true,
      },
    });

    const analytics = {
      eventsByDay: this.groupEventsByDay(events, days),
      eventsBySeverity: this.groupEventsBySeverity(events),
      eventsByType: this.groupEventsByType(events),
      trends: this.calculateTrends(events),
    };

    return analytics;
  }

  async getPlaybooks(tenantId: string) {
    return [
      {
        id: 'incident-response',
        name: 'Security Incident Response',
        description: 'Standard procedure for security incidents',
        steps: [
          'Acknowledge the alert',
          'Assess the impact',
          'Contain the threat',
          'Eradicate the cause',
          'Recover systems',
          'Document lessons learned',
        ],
        severity: 'HIGH',
        estimatedTime: '2-4 hours',
      },
      {
        id: 'data-breach',
        name: 'Data Breach Response',
        description: 'Response plan for data breaches',
        steps: [
          'Identify breach scope',
          'Notify stakeholders',
          'Contain data exposure',
          'Assess regulatory impact',
          'Implement remediation',
          'Report to authorities',
        ],
        severity: 'CRITICAL',
        estimatedTime: '4-8 hours',
      },
      {
        id: 'malware-response',
        name: 'Malware Detection Response',
        description: 'Procedure for malware incidents',
        steps: [
          'Isolate affected systems',
          'Identify malware type',
          'Remove malicious software',
          'Scan for persistence',
          'Restore from backup',
          'Update security measures',
        ],
        severity: 'HIGH',
        estimatedTime: '1-3 hours',
      },
    ];
  }

  private getAlertType(action: string): string {
    if (action.includes('LOGIN')) return 'AUTHENTICATION';
    if (action.includes('FAILED')) return 'SECURITY_BREACH';
    if (action.includes('DELETE')) return 'DATA_MODIFICATION';
    if (action.includes('CREATE')) return 'ACCESS_GRANTED';
    return 'GENERAL';
  }

  private getAlertTitle(event: any): string {
    const action = event.action;
    const severity = event.severity;
    
    if (severity === 'CRITICAL') return `Critical: ${action}`;
    if (severity === 'HIGH') return `High Priority: ${action}`;
    return `Alert: ${action}`;
  }

  private analyzeThreats(events: any[]) {
    const threats = [];
    
    // Analyze failed login patterns
    const failedLogins = events.filter(e => e.action.includes('FAILED_LOGIN'));
    if (failedLogins.length > 10) {
      threats.push({
        type: 'BRUTE_FORCE',
        severity: 'HIGH',
        count: failedLogins.length,
        description: 'Multiple failed login attempts detected',
      });
    }

    // Analyze privilege escalation
    const privilegeChanges = events.filter(e => e.action.includes('ROLE_CHANGE'));
    if (privilegeChanges.length > 0) {
      threats.push({
        type: 'PRIVILEGE_ESCALATION',
        severity: 'MEDIUM',
        count: privilegeChanges.length,
        description: 'Privilege escalation activities detected',
      });
    }

    return threats;
  }

  private getIndicators(events: any[]) {
    return {
      suspiciousIPs: this.extractSuspiciousIPs(events),
      unusualPatterns: this.detectUnusualPatterns(events),
      riskFactors: this.calculateRiskFactors(events),
    };
  }

  private getRecommendations(events: any[]) {
    const recommendations = [];
    
    if (events.some(e => e.action.includes('FAILED_LOGIN'))) {
      recommendations.push('Implement account lockout policies');
    }
    
    if (events.some(e => e.severity === 'CRITICAL')) {
      recommendations.push('Review critical security events immediately');
    }
    
    recommendations.push('Enable multi-factor authentication');
    recommendations.push('Regular security training for users');
    
    return recommendations;
  }

  private groupEventsByDay(events: any[], days: number) {
    const result = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      result.push({
        date: dateStr,
        count: events.filter(e => 
          e.createdAt.toISOString().split('T')[0] === dateStr
        ).length,
      });
    }
    return result.reverse();
  }

  private groupEventsBySeverity(events: any[]) {
    return events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {});
  }

  private groupEventsByType(events: any[]) {
    return events.reduce((acc, event) => {
      const type = this.getAlertType(event.action);
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateTrends(events: any[]) {
    const recentEvents = events.filter(e => 
      e.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    
    const olderEvents = events.filter(e => 
      e.createdAt <= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) &&
      e.createdAt > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    );

    return {
      weeklyChange: recentEvents.length - olderEvents.length,
      trend: recentEvents.length > olderEvents.length ? 'INCREASING' : 'DECREASING',
    };
  }

  private extractSuspiciousIPs(events: any[]) {
    // Extract IPs from metadata if available
    const ips = events
      .map(e => e.metadata?.ip)
      .filter(Boolean)
      .reduce((acc, ip) => {
        acc[ip] = (acc[ip] || 0) + 1;
        return acc;
      }, {});

    return Object.entries(ips)
      .filter(([_, count]) => count > 5)
      .map(([ip, count]) => ({ ip, count }));
  }

  private detectUnusualPatterns(events: any[]) {
    return {
      offHoursActivity: events.filter(e => {
        const hour = e.createdAt.getHours();
        return hour < 6 || hour > 22;
      }).length,
      rapidActions: this.detectRapidActions(events),
      unusualLocations: this.detectUnusualLocations(events),
    };
  }

  private calculateRiskFactors(events: any[]) {
    const criticalCount = events.filter(e => e.severity === 'CRITICAL').length;
    const highCount = events.filter(e => e.severity === 'HIGH').length;
    
    return {
      criticalEvents: criticalCount,
      highEvents: highCount,
      riskScore: Math.min(100, criticalCount * 20 + highCount * 10),
    };
  }

  private detectRapidActions(events: any[]) {
    const rapidThreshold = 1000 * 60 * 5; // 5 minutes
    let rapidCount = 0;
    
    for (let i = 1; i < events.length; i++) {
      if (events[i].createdAt.getTime() - events[i-1].createdAt.getTime() < rapidThreshold) {
        rapidCount++;
      }
    }
    
    return rapidCount;
  }

  private detectUnusualLocations(events: any[]) {
    // This would integrate with geoIP services in a real implementation
    return events.filter(e => e.metadata?.location === 'UNKNOWN').length;
  }
}

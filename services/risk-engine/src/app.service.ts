import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRiskScores(tenantId: string) {
    return this.prisma.riskProfile.findMany({ where: { tenantId } });
  }

  async getRiskEvents(tenantId: string) {
    return this.prisma.riskEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getITDRThreats(tenantId: string) {
    const events = await this.prisma.riskEvent.findMany({
      where: {
        tenantId,
        severity: { in: ['critical', 'high'] },
        resolved: false,
      },
      orderBy: { timestamp: 'desc' },
    });

    return events.map(event => ({
      id: `T-${event.id}`,
      type: event.type,
      severity: event.severity,
      status: 'Active',
      target: event.userId,
      description: event.description,
      timestamp: event.timestamp,
      mitre: this.getMITRETactic(event.type),
      confidence: this.calculateConfidence(event.severity),
      playbook: this.getPlaybook(event.type),
    }));
  }

  async respondToThreat(tenantId: string, id: string, action: string, notes?: string) {
    const eventId = id.replace('T-', '');
    const event = await this.prisma.riskEvent.findFirst({ where: { id: eventId, tenantId } });
    if (!event) throw new Error(`Threat ${id} not found for tenant ${tenantId}`);
    return this.prisma.riskEvent.update({
      where: { id: eventId },
      data: {
        resolved: action === 'resolve',
        resolutionNotes: notes || `Action: ${action} taken by security team`,
      },
    });
  }

  async getRiskTrends(tenantId: string) {
    const events = await this.prisma.riskEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    });

    const monthlyData: Record<string, number[]> = {};
    events.forEach(event => {
      const month = event.timestamp.toISOString().slice(0, 7);
      if (!monthlyData[month]) monthlyData[month] = [];
      const score = event.severity === 'critical' ? 90 : event.severity === 'high' ? 70 : event.severity === 'medium' ? 50 : 30;
      monthlyData[month].push(score);
    });

    return Object.entries(monthlyData).map(([month, scores]) => ({
      month,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      eventCount: scores.length,
    }));
  }

  async detectITDRPatterns(tenantId: string, userId: string) {
    const userEvents = await this.prisma.riskEvent.findMany({
      where: { tenantId, userId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    const patterns = [];

    const loginEvents = userEvents.filter(e => e.type === 'abnormal_behavior');
    if (loginEvents.length >= 2) {
      patterns.push({
        type: 'impossible_travel',
        severity: 'critical',
        description: 'Multiple authentication events from different locations within short timeframe',
        confidence: 94,
      });
    }

    const privEvents = userEvents.filter(e => e.type === 'privilege_escalation');
    if (privEvents.length > 0) {
      patterns.push({
        type: 'privilege_escalation',
        severity: 'critical',
        description: 'User attempted or succeeded in escalating their privileges',
        confidence: 96,
      });
    }

    const dormantEvents = userEvents.filter(e => e.type === 'dormant_account');
    if (dormantEvents.length > 0) {
      patterns.push({
        type: 'dormant_account_activation',
        severity: 'high',
        description: 'Previously dormant account showing activity',
        confidence: 82,
      });
    }

    return { userId, patterns, detectedAt: new Date() };
  }

  async calculateRisk(tenantId: string, targetId: string, targetType: string) {
    this.logger.log(`Calculating risk for ${targetType}: ${targetId} tenant: ${tenantId}`);

    const events = await this.prisma.riskEvent.findMany({
      where: { tenantId, userId: targetId },
    });

    const weights = { critical: 40, high: 20, medium: 10, low: 5 };

    let totalScore = 0;
    let latestEventDate: Date | null = null;

    events.forEach(event => {
      const severity = (event.severity?.toLowerCase() || 'low') as keyof typeof weights;
      totalScore += weights[severity] || weights.low;
      if (!latestEventDate || event.timestamp > latestEventDate) {
        latestEventDate = event.timestamp;
      }
    });

    if (latestEventDate) {
      const now = new Date();
      const diffDays = Math.ceil(Math.abs(now.getTime() - (latestEventDate as Date).getTime()) / (1000 * 60 * 60 * 24));
      totalScore = Math.max(0, totalScore - (diffDays * 2));
    }

    const finalScore = Math.min(100, totalScore);

    return this.prisma.riskProfile.upsert({
      where: { tenantId_targetId: { tenantId, targetId } },
      update: { currentScore: finalScore, lastUpdated: new Date() },
      create: { tenantId, targetId, targetType, baseScore: 50, currentScore: finalScore },
    });
  }

  private getMITRETactic(eventType: string): string {
    const tacticMap: Record<string, string> = {
      privilege_escalation: 'T1068 — Privilege Escalation',
      abnormal_behavior: 'T1078 — Valid Accounts',
      dormant_account: 'T1098 — Account Manipulation',
      excessive_privilege: 'T1134 — Access Token Manipulation',
    };
    return tacticMap[eventType] || 'T1000 — Unknown';
  }

  private calculateConfidence(severity: string): number {
    const map: Record<string, number> = { critical: 95, high: 82, medium: 68, low: 55 };
    return map[severity] || 60;
  }

  private getPlaybook(eventType: string): string {
    const playbookMap: Record<string, string> = {
      privilege_escalation: 'PRIV-003',
      abnormal_behavior: 'ATO-001',
      dormant_account: 'DORM-001',
      excessive_privilege: 'PRIV-001',
    };
    return playbookMap[eventType] || 'GEN-001';
  }
}

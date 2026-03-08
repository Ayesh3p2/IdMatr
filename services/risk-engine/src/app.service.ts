import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRiskScores() {
    return this.prisma.riskProfile.findMany();
  }

  async getRiskEvents() {
    return this.prisma.riskEvent.findMany({
      orderBy: { timestamp: 'desc' },
    });
  }

  async calculateRisk(targetId: string, targetType: string) {
    this.logger.log(`Calculating risk for ${targetType}: ${targetId}`);
    
    // Fetch user's risk events from DB
    const events = await this.prisma.riskEvent.findMany({
      where: { targetId },
    });

    // Severity weights
    const weights = {
      critical: 40,
      high: 20,
      medium: 10,
      low: 5,
    };

    let totalScore = 0;
    let latestEventDate: Date | null = null;

    events.forEach(event => {
      const severity = (event.severity?.toLowerCase() || 'low') as keyof typeof weights;
      totalScore += weights[severity] || weights.low;
      
      if (!latestEventDate || event.timestamp > latestEventDate) {
        latestEventDate = event.timestamp;
      }
    });

    // Time decay: 2 points per day since last event
    if (latestEventDate) {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - latestEventDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      totalScore = Math.max(0, totalScore - (diffDays * 2));
    }

    // Cap at 100
    const finalScore = Math.min(100, totalScore);
    
    return this.prisma.riskProfile.upsert({
      where: { targetId },
      update: {
        currentScore: finalScore,
        lastUpdated: new Date(),
      },
      create: {
        targetId,
        targetType,
        baseScore: 50,
        currentScore: finalScore,
      },
    });
  }
}

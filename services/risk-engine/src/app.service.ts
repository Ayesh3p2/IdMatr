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
    
    // In a real system, this would analyze many factors
    // For now, let's simulate a calculation
    const score = Math.floor(Math.random() * 100);
    
    return this.prisma.riskProfile.upsert({
      where: { targetId },
      update: {
        currentScore: score,
        lastUpdated: new Date(),
      },
      create: {
        targetId,
        targetType,
        baseScore: 50,
        currentScore: score,
      },
    });
  }
}

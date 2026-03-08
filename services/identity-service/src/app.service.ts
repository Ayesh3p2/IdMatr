import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllIdentities(): Promise<User[]> {
    return this.prisma.user.findMany({
      include: {
        accessGrants: true,
      },
    });
  }

  async getIdentity(id: string): Promise<User | null> {
    this.logger.log(`Getting identity: ${id}`);
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        accessGrants: {
          include: {
            application: true,
            role: true,
          },
        },
      },
    });
  }

  async createUser(data: any): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        status: data.status || 'active',
        riskScore: data.riskScore || 0,
        metadata: data.metadata || {},
      },
    });
  }

  async updateUserRisk(id: string, score: number): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { riskScore: score },
    });
  }
}

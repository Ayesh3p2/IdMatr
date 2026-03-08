import { Injectable, Logger } from '@nestjs/common';
import { GoogleConnector } from './connectors/google.connector';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly googleConnector: GoogleConnector,
    private readonly prisma: PrismaService
  ) {}

  async getAllApps() {
    return this.prisma.discoveredApp.findMany({
      include: {
        users: true,
      },
    });
  }

  async triggerScan(data: any) {
    this.logger.log(`Triggering discovery scan for: ${data.source || 'all'}`);
    
    let results: any[] = [];
    if (!data.source || data.source === 'google') {
      results = await this.googleConnector.scan();
    }

    // Save results to database
    for (const item of results) {
      await this.prisma.discoveredApp.upsert({
        where: { name: item.app }, 
        update: {
          lastDetected: new Date(),
          status: 'identified',
        },
        create: {
          name: item.app,
          source: 'google',
          status: 'identified',
          firstDetected: new Date(),
        },
      });

      // Also create/update discovered users...
    }

    return { status: 'scan_complete', detected_items: results.length };
  }
}

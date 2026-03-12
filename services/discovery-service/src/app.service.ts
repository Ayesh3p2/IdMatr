import { Injectable, Logger } from '@nestjs/common';
import { GoogleConnector } from './connectors/google.connector';
import { MicrosoftConnector } from './connectors/microsoft.connector';
import { SlackConnector } from './connectors/slack.connector';
import { GitHubConnector } from './connectors/github.connector';
import { LocalSoftwareConnector } from './connectors/local-software.connector';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly googleConnector: GoogleConnector,
    private readonly microsoftConnector: MicrosoftConnector,
    private readonly slackConnector: SlackConnector,
    private readonly githubConnector: GitHubConnector,
    private readonly localSoftwareConnector: LocalSoftwareConnector,
    private readonly prisma: PrismaService,
  ) {}

  async getAllApps() {
    return this.prisma.discoveredApp.findMany({
      include: {
        users: true,
      },
    });
  }

  async triggerScan(data: { source?: string }) {
    this.logger.log(`Triggering discovery scan for: ${data.source || 'all'}`);

    const source = data.source?.toLowerCase();
    const allResults: any[] = [];

    const scanConnector = async (name: string, connector: { scan: () => Promise<any[]> }) => {
      try {
        const results = await connector.scan();
        allResults.push(...results.map(r => ({ ...r, connectorSource: name })));
        this.logger.log(`${name} scan complete: ${results.length} items`);
      } catch (err) {
        this.logger.error(`${name} scan failed: ${err.message}`);
      }
    };

    if (!source || source === 'google') {
      await scanConnector('google', this.googleConnector);
    }
    if (!source || source === 'microsoft') {
      await scanConnector('microsoft', this.microsoftConnector);
    }
    if (!source || source === 'slack') {
      await scanConnector('slack', this.slackConnector);
    }
    if (!source || source === 'github') {
      await scanConnector('github', this.githubConnector);
    }
    if (!source || source === 'local') {
      await scanConnector('local-software', this.localSoftwareConnector);
    }

    // Persist discovered apps and users to the database
    for (const item of allResults) {
      const appRecord = await this.prisma.discoveredApp.upsert({
        where: { name: item.app },
        update: {
          lastDetected: new Date(),
          status: item.shadowIt ? 'shadow-it' : 'identified',
        },
        create: {
          name: item.app,
          source: item.connectorSource,
          status: item.shadowIt ? 'shadow-it' : 'identified',
          firstDetected: new Date(),
          rawTelemetry: item,
        },
      });

      if (item.email) {
        // Check if user record exists for this app to handle upsert
        const existingUser = await this.prisma.discoveredUser.findFirst({
          where: { email: item.email, appId: appRecord.id },
        });

        if (existingUser) {
          await this.prisma.discoveredUser.update({
            where: { id: existingUser.id },
            data: {
              permissions: item.permissions || [],
              isAdmin: item.isAdmin || false,
              lastActivity: item.lastActivity || new Date(),
              status: 'active',
            },
          });
        } else {
          await this.prisma.discoveredUser.create({
            data: {
              email: item.email,
              appId: appRecord.id,
              permissions: item.permissions || [],
              isAdmin: item.isAdmin || false,
              lastActivity: item.lastActivity || new Date(),
              status: 'active',
            },
          });
        }
      }
    }

    const shadowItCount = allResults.filter(r => r.shadowIt).length;
    const appNames = [...new Set(allResults.map(r => r.app))];

    return {
      status: 'scan_complete',
      detected_items: allResults.length,
      detected_apps: appNames.length,
      shadow_it_count: shadowItCount,
      applications: appNames,
    };
  }
}

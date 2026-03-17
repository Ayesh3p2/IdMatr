import { Injectable, Logger } from '@nestjs/common';
import { GoogleConnector } from './connectors/google.connector';
import { MicrosoftConnector } from './connectors/microsoft.connector';
import { SlackConnector } from './connectors/slack.connector';
import { GitHubConnector } from './connectors/github.connector';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly googleConnector: GoogleConnector,
    private readonly microsoftConnector: MicrosoftConnector,
    private readonly slackConnector: SlackConnector,
    private readonly githubConnector: GitHubConnector,
    private readonly prisma: PrismaService
  ) {}

  // ── Query ──────────────────────────────────────────────────────────────────

  async getAllApps(tenantId: string) {
    return this.prisma.discoveredApp.findMany({
      where: { tenantId },
      include: { users: true },
      orderBy: { lastDetected: 'desc' },
    });
  }

  async getAppIntelligence(tenantId: string) {
    const apps = await this.prisma.discoveredApp.findMany({
      where: { tenantId },
      include: { users: true },
      orderBy: { lastDetected: 'desc' },
    });

    const total = apps.length;
    const managed = apps.filter((a) => a.status === 'identified').length;
    const shadowIT = apps.filter((a) => a.status === 'shadow-it').length;
    const unknown = apps.filter((a) => a.status === 'unknown').length;
    const critical = shadowIT;

    const connectors = await this.prisma.discoveryConnector.findMany({ where: { tenantId } });
    const activeConnectors = connectors.filter((c) => c.status === 'active');

    return {
      total,
      managed,
      shadowIT,
      unknown,
      critical,
      apps,
      activeConnectors: activeConnectors.length,
      lastScan:
        connectors.reduce(
          (latest: Date | null, c) =>
            c.lastScan && (!latest || c.lastScan > latest) ? c.lastScan : latest,
          null
        ) || null,
    };
  }

  // ── Scan ───────────────────────────────────────────────────────────────────

  async triggerScan(data: { tenantId: string; source?: string }) {
    const tenantId = data.tenantId;
    const source = data.source?.toLowerCase() || 'all';
    this.logger.log(`Triggering discovery scan: tenant=${tenantId} source=${source}`);

    const results: { source: string; identities: number; apps: string[]; errors: string[] }[] = [];

    if (source === 'all' || source === 'google') results.push(await this.scanGoogle(tenantId));
    if (source === 'all' || source === 'microsoft' || source === 'ms365') results.push(await this.scanMicrosoft(tenantId));
    if (source === 'all' || source === 'slack') results.push(await this.scanSlack(tenantId));
    if (source === 'all' || source === 'github') results.push(await this.scanGitHub(tenantId));

    const totalIdentities = results.reduce((s, r) => s + r.identities, 0);
    const totalApps = new Set(results.flatMap((r) => r.apps)).size;
    const allErrors = results.flatMap((r) => r.errors);

    return {
      status: allErrors.length === 0 ? 'scan_complete' : 'scan_partial',
      sources_scanned: results.map((r) => r.source),
      detected_identities: totalIdentities,
      detected_apps: totalApps,
      errors: allErrors.length ? allErrors : undefined,
      completed_at: new Date().toISOString(),
    };
  }

  // ── Private scan helpers ───────────────────────────────────────────────────

  private async scanGoogle(tenantId: string) {
    const result = { source: 'google', identities: 0, apps: ['Google Workspace'], errors: [] as string[] };

    try {
      const identities = await this.googleConnector.scan();
      result.identities = identities.length;

      if (identities.length > 0) {
        const app = await this.prisma.discoveredApp.upsert({
          where: { tenantId_name: { tenantId, name: 'Google Workspace' } },
          update: { lastDetected: new Date(), status: 'identified' },
          create: { tenantId, name: 'Google Workspace', source: 'google', status: 'identified', firstDetected: new Date(), metadata: { vendor: 'Google', type: 'cloud-productivity' } },
        });

        for (const identity of identities) {
          await this.upsertDiscoveredUser(tenantId, app.id, identity);
        }

        try {
          const oauthApps = await this.googleConnector.discoverOAuthApps();
          for (const appName of oauthApps) {
            await this.prisma.discoveredApp.upsert({
              where: { tenantId_name: { tenantId, name: appName } },
              update: { lastDetected: new Date() },
              create: { tenantId, name: appName, source: 'google-oauth', status: 'shadow-it', firstDetected: new Date(), metadata: { discoveredVia: 'Google OAuth audit logs' } },
            });
            result.apps.push(appName);
          }
        } catch { /* Reports API optional */ }

        await this.upsertConnector(tenantId, 'google', 'active');
      }
    } catch (err) {
      const msg = `Google scan error: ${(err as Error).message}`;
      this.logger.error(msg);
      result.errors.push(msg);
      await this.upsertConnector(tenantId, 'google', 'error');
    }

    return result;
  }

  private async scanMicrosoft(tenantId: string) {
    const result = { source: 'microsoft', identities: 0, apps: ['Microsoft 365'], errors: [] as string[] };

    try {
      const identities = await this.microsoftConnector.scan();
      result.identities = identities.length;

      if (identities.length > 0) {
        const app = await this.prisma.discoveredApp.upsert({
          where: { tenantId_name: { tenantId, name: 'Microsoft 365' } },
          update: { lastDetected: new Date(), status: 'identified' },
          create: { tenantId, name: 'Microsoft 365', source: 'microsoft', status: 'identified', firstDetected: new Date(), metadata: { vendor: 'Microsoft', type: 'cloud-productivity' } },
        });

        for (const identity of identities) {
          await this.upsertDiscoveredUser(tenantId, app.id, identity);
        }

        await this.upsertConnector(tenantId, 'microsoft', 'active');
      }
    } catch (err) {
      const msg = `Microsoft scan error: ${(err as Error).message}`;
      this.logger.error(msg);
      result.errors.push(msg);
      await this.upsertConnector(tenantId, 'microsoft', 'error');
    }

    return result;
  }

  private async scanSlack(tenantId: string) {
    const result = { source: 'slack', identities: 0, apps: ['Slack'], errors: [] as string[] };

    try {
      const identities = await this.slackConnector.scan();
      result.identities = identities.length;

      if (identities.length > 0) {
        const app = await this.prisma.discoveredApp.upsert({
          where: { tenantId_name: { tenantId, name: 'Slack' } },
          update: { lastDetected: new Date(), status: 'identified' },
          create: { tenantId, name: 'Slack', source: 'slack', status: 'identified', firstDetected: new Date(), metadata: { vendor: 'Slack Technologies', type: 'messaging' } },
        });

        for (const identity of identities) {
          if (!identity.email) continue;
          await this.upsertDiscoveredUser(tenantId, app.id, identity);
        }

        await this.upsertConnector(tenantId, 'slack', 'active');
      }
    } catch (err) {
      const msg = `Slack scan error: ${(err as Error).message}`;
      this.logger.error(msg);
      result.errors.push(msg);
      await this.upsertConnector(tenantId, 'slack', 'error');
    }

    return result;
  }

  private async scanGitHub(tenantId: string) {
    const result = { source: 'github', identities: 0, apps: ['GitHub'], errors: [] as string[] };

    try {
      const identities = await this.githubConnector.scan();
      result.identities = identities.length;

      if (identities.length > 0) {
        const app = await this.prisma.discoveredApp.upsert({
          where: { tenantId_name: { tenantId, name: 'GitHub' } },
          update: { lastDetected: new Date(), status: 'identified' },
          create: { tenantId, name: 'GitHub', source: 'github', status: 'identified', firstDetected: new Date(), metadata: { vendor: 'GitHub', type: 'developer-tools' } },
        });

        for (const identity of identities) {
          await this.upsertDiscoveredUser(tenantId, app.id, identity);
        }

        await this.upsertConnector(tenantId, 'github', 'active');
      }
    } catch (err) {
      const msg = `GitHub scan error: ${(err as Error).message}`;
      this.logger.error(msg);
      result.errors.push(msg);
      await this.upsertConnector(tenantId, 'github', 'error');
    }

    return result;
  }

  private async upsertDiscoveredUser(tenantId: string, appId: string, identity: any) {
    const existing = await this.prisma.discoveredUser.findFirst({
      where: { tenantId, email: identity.email, appId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.discoveredUser.update({
        where: { id: existing.id },
        data: {
          permissions: identity.permissions,
          isAdmin: identity.isAdmin,
          lastActivity: identity.lastActivity ?? undefined,
          status: identity.status,
        },
      });
    } else {
      await this.prisma.discoveredUser.create({
        data: {
          tenantId,
          email: identity.email,
          externalId: identity.externalId,
          appId,
          permissions: identity.permissions,
          isAdmin: identity.isAdmin,
          lastActivity: identity.lastActivity ?? undefined,
          status: identity.status,
        },
      });
    }
  }

  private async upsertConnector(tenantId: string, type: string, status: string) {
    const existing = await this.prisma.discoveryConnector.findFirst({ where: { tenantId, type } });

    if (existing) {
      await this.prisma.discoveryConnector.update({
        where: { id: existing.id },
        data: { status, lastScan: new Date() },
      });
    } else {
      await this.prisma.discoveryConnector.create({
        data: { tenantId, type, status, lastScan: new Date() },
      });
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationProvider, IntegrationStatus, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/request-user.interface';
import { IntegrationsService } from './integrations.service';

@Injectable()
export class IntegrationsScheduler {
  private readonly logger = new Logger(IntegrationsScheduler.name);
  private googleIntegrationDisabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncGoogleConnections() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_ADMIN_EMAIL || !process.env.GOOGLE_DOMAIN) {
      if (!this.googleIntegrationDisabled) {
        this.googleIntegrationDisabled = true;
        this.logger.warn('Google integration disabled: missing GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_ADMIN_EMAIL, or GOOGLE_DOMAIN');
      }
      return;
    }

    const integrations = await this.prisma.integration.findMany({
      where: {
        provider: IntegrationProvider.GOOGLE,
        status: {
          in: [IntegrationStatus.CONNECTED, IntegrationStatus.ERROR],
        },
      },
      select: {
        id: true,
        tenantId: true,
      },
    });

    for (const integration of integrations) {
      try {
        const systemUser: RequestUser = {
          tenantId: integration.tenantId,
          userId: 'system',
          email: 'system@idmatr.local',
          name: 'System',
          role: Role.PLATFORM_ADMIN,
          status: UserStatus.ACTIVE,
          mfaEnabled: true,
        };

        await this.integrationsService.syncGoogleUsers(
          systemUser,
          { integrationId: integration.id },
        );
        await this.integrationsService.syncGoogleGroups(
          systemUser,
          { integrationId: integration.id },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync failure';
        this.logger.error(
          `Scheduled Google sync failed for tenant ${integration.tenantId}: ${message}`,
        );
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            status: IntegrationStatus.ERROR,
            lastSyncError: message,
          },
        });
      }
    }
  }
}

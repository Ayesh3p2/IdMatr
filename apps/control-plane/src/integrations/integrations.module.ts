import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsCryptoService } from './integrations.crypto';
import { IntegrationsScheduler } from './integrations.scheduler';
import { IntegrationsService } from './integrations.service';
import { GithubIntegrationService } from './github/github.integration';
import { GoogleIntegrationService } from './google/google.integration';
import { MicrosoftIntegrationService } from './microsoft/microsoft.integration';
import { SlackIntegrationService } from './slack/slack.integration';

@Module({
  controllers: [IntegrationsController],
  providers: [
    IntegrationsCryptoService,
    IntegrationsService,
    IntegrationsScheduler,
    GoogleIntegrationService,
    MicrosoftIntegrationService,
    SlackIntegrationService,
    GithubIntegrationService,
  ],
  exports: [IntegrationsService, IntegrationsCryptoService],
})
export class IntegrationsModule {}

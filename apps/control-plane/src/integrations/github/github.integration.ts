import { Injectable, NotImplementedException } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';
import { IntegrationProviderService } from '../integration-provider.interface';

@Injectable()
export class GithubIntegrationService
  implements IntegrationProviderService<never, never, never, never>
{
  readonly provider = IntegrationProvider.GITHUB;

  connect(): Promise<never> {
    throw new NotImplementedException('GitHub integration is not implemented yet');
  }

  healthCheck(): Promise<never> {
    throw new NotImplementedException('GitHub integration is not implemented yet');
  }

  syncUsers(): Promise<never> {
    throw new NotImplementedException('GitHub integration is not implemented yet');
  }

  syncPermissions(): Promise<never> {
    throw new NotImplementedException('GitHub integration is not implemented yet');
  }
}

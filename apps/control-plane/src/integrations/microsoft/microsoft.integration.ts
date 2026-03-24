import { Injectable, NotImplementedException } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';
import { IntegrationProviderService } from '../integration-provider.interface';

@Injectable()
export class MicrosoftIntegrationService
  implements IntegrationProviderService<never, never, never, never>
{
  readonly provider = IntegrationProvider.MICROSOFT;

  connect(): Promise<never> {
    throw new NotImplementedException('Microsoft integration is not implemented yet');
  }

  healthCheck(): Promise<never> {
    throw new NotImplementedException('Microsoft integration is not implemented yet');
  }

  syncUsers(): Promise<never> {
    throw new NotImplementedException('Microsoft integration is not implemented yet');
  }

  syncPermissions(): Promise<never> {
    throw new NotImplementedException('Microsoft integration is not implemented yet');
  }
}

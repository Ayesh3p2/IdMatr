import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [MfaController],
  providers: [MfaService],
})
export class MfaModule {}

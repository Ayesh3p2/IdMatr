import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { IgaController } from './iga.controller';
import { IgaService } from './iga.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [IgaController],
  providers: [IgaService],
})
export class IgaModule {}

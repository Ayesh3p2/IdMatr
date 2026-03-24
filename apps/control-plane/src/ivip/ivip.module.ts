import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { IvipController } from './ivip.controller';
import { IvipService } from './ivip.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [IvipController],
  providers: [IvipService],
})
export class IvipModule {}

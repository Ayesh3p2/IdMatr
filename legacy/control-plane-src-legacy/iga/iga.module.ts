import { Module } from '@nestjs/common';
import { IgaController } from './iga.controller';
import { IgaService } from './iga.service';

@Module({
  controllers: [IgaController],
  providers: [IgaService],
  exports: [IgaService],
})
export class IgaModule {}

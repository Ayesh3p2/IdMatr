import { Module } from '@nestjs/common';
import { ItdrController } from './itdr.controller';
import { ItdrService } from './itdr.service';

@Module({
  controllers: [ItdrController],
  providers: [ItdrService],
  exports: [ItdrService],
})
export class ItdrModule {}

import { Module } from '@nestjs/common';
import { IvipController } from './ivip.controller';
import { IvipService } from './ivip.service';

@Module({
  controllers: [IvipController],
  providers: [IvipService],
  exports: [IvipService],
})
export class IvipModule {}

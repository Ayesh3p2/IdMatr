import { Module } from '@nestjs/common';
import { IspmController } from './ispm.controller';
import { IspmService } from './ispm.service';

@Module({
  controllers: [IspmController],
  providers: [IspmService],
})
export class IspmModule {}

import { Module } from '@nestjs/common';
import { CommonModule as Common } from './common.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
  ],
  exports: [
    PrismaModule,
  ],
})
export class CommonModule {}

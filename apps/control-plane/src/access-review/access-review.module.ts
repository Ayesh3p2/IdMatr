import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessReviewController } from './access-review.controller.js';
import { AccessReviewService } from './access-review.service.js';
import { SecurityModule } from '../security/security.module.js';

@Module({
  imports: [
    SecurityModule,
    JwtModule.registerAsync({
      useFactory: () => {
        if (!process.env.CONTROL_PLANE_JWT_SECRET) {
          throw new Error('CONTROL_PLANE_JWT_SECRET env var is required');
        }
        return {
          secret: process.env.CONTROL_PLANE_JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        };
      },
    }),
  ],
  controllers: [AccessReviewController],
  providers: [AccessReviewService],
})
export class AccessReviewModule {}

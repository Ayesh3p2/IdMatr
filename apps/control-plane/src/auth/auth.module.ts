import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { InternalAuthController } from './internal-auth.controller.js';
import { SecurityModule } from '../security/security.module.js';

@Module({
  imports: [
    SecurityModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        if (!process.env.CONTROL_PLANE_JWT_SECRET) {
          throw new Error('CONTROL_PLANE_JWT_SECRET env var is required');
        }
        return {
          secret: process.env.CONTROL_PLANE_JWT_SECRET,
          signOptions: { expiresIn: '12h' },
        };
      },
    }),
  ],
  controllers: [AuthController, InternalAuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

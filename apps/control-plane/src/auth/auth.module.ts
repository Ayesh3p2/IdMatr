import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AuthenticatedUserService } from './authenticated-user.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RequestSecurityGuard } from './request-security.guard';
import { MfaSetupGuard } from './mfa-setup.guard';

@Module({
  imports: [
    IntegrationsModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthenticatedUserService,
    JwtStrategy,
    MfaSetupGuard,
    {
      provide: APP_GUARD,
      useClass: RequestSecurityGuard,
    },
  ],
  exports: [AuthService, JwtModule, AuthenticatedUserService],
})
export class AuthModule {}

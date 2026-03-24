import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { IamModule } from './iam/iam.module';
import { IgaModule } from './iga/iga.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { InvitesModule } from './invites/invites.module';
import { IspmModule } from './ispm/ispm.module';
import { ItdrModule } from './itdr/itdr.module';
import { IvipModule } from './ivip/ivip.module';
import { MfaModule } from './mfa/mfa.module';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    RbacModule,
    AuthModule,
    HealthModule,
    IntegrationsModule,
    TenantsModule,
    UsersModule,
    InvitesModule,
    MfaModule,
    IamModule,
    IgaModule,
    IvipModule,
    IspmModule,
    ItdrModule,
  ],
})
export class AppModule {}

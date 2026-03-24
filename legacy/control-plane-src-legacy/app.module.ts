import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { InvitesModule } from './invites/invites.module';
import { MfaModule } from './mfa/mfa.module';
import { RbacModule } from './rbac/rbac.module';
import { IgaModule } from './iga/iga.module';
import { IvipModule } from './ivip/ivip.module';
import { IspnModule } from './ispn/ispn.module';
import { ItdrModule } from './itdr/itdr.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Core modules
    PrismaModule,
    CommonModule,

    // Business modules
    AuthModule,
    UsersModule,
    TenantsModule,
    InvitesModule,
    MfaModule,
    RbacModule,
    IgaModule,
    IvipModule,
    IspnModule,
    ItdrModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { AuditModule } from './audit/audit.module.js';
import { HealthModule } from './health/health.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { EmailModule } from './email/email.module.js';
import { SecurityModule } from './security/security.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { AccessReviewModule } from './access-review/access-review.module.js';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    EmailModule,       // global — available in all modules
    AuthModule,
    TenantsModule,
    AuditModule,
    HealthModule,
    SettingsModule,
    PrivacyModule,
    AccessReviewModule,
  ],
})
export class AppModule {}

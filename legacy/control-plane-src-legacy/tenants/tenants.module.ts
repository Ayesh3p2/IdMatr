import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';
import { EmailModule } from '../email/email.module.js';
import { SecurityModule } from '../security/security.module.js';

@Module({
  imports: [EmailModule, SecurityModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}

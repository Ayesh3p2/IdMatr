import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service.js';
import { EnvelopeEncryptionService } from './envelope-encryption.service.js';
import { ControlPlaneRolesGuard } from './roles.guard.js';

@Module({
  providers: [AuditLogService, EnvelopeEncryptionService, ControlPlaneRolesGuard],
  exports: [AuditLogService, EnvelopeEncryptionService, ControlPlaneRolesGuard],
})
export class SecurityModule {}

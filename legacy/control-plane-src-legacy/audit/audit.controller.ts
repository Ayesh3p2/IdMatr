import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service.js';
import { Roles } from '../security/roles.decorator.js';
import { ControlPlaneRolesGuard } from '../security/roles.guard.js';
import { PLATFORM_OPERATOR_ROLE } from '../security/roles.js';

@Controller('control/audit')
@UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
@Roles(PLATFORM_OPERATOR_ROLE)
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  getLogs(
    @Query('tenantId') tenantId?: string,
    @Query('operatorId') operatorId?: string,
    @Query('category') category?: string,
    @Query('action') action?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.getLogs({
      tenantId, operatorId, category, action, severity,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get('verify')
  verifyIntegrity(@Query('tenantId') tenantId?: string) {
    return this.audit.verifyIntegrity(tenantId);
  }
}

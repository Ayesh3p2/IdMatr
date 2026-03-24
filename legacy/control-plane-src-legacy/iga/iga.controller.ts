import { 
  Controller, 
  Get, 
  Post, 
  Query, 
  Param, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Req
} from '@nestjs/common';
import { IgaService } from './iga.service.js';
import { Roles } from '../common/rbac/roles.decorator.js';
import { RolesGuard } from '../common/rbac/roles.guard.js';

@Controller('iga')
@UseGuards(RolesGuard)
export class IgaController {
  constructor(private readonly igaService: IgaService) {}

  @Get('identities')
  @Roles('tenant_admin', 'platform_admin')
  async listIdentities(
    @Query() query: any,
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      role: req.userRole
    };
    return this.igaService.listIdentities(req.tenantId, query, user);
  }

  @Get('identities/:id')
  @Roles('tenant_admin', 'platform_admin')
  async getIdentity(
    @Param('id') id: string,
    @Req() req: any
  ) {
    return this.igaService.getIdentity(req.tenantId, id);
  }

  @Get('access-review')
  @Roles('tenant_admin', 'platform_admin')
  async getAccessReview(
    @Query('period') period: string = '30',
    @Req() req: any
  ) {
    return this.igaService.getAccessReview(req.tenantId, parseInt(period));
  }

  @Post('access-review/:userId/revoke')
  @Roles('tenant_admin', 'platform_admin')
  @HttpCode(HttpStatus.OK)
  async revokeAccess(
    @Param('userId') userId: string,
    @Req() req: any
  ) {
    const reviewer = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.igaService.revokeAccess(req.tenantId, userId, reviewer);
  }

  @Get('entitlements')
  @Roles('tenant_admin', 'platform_admin')
  async getEntitlementsSummary(
    @Req() req: any
  ) {
    return this.igaService.getEntitlementsSummary(req.tenantId);
  }

  @Get('reports/orphaned-accounts')
  @Roles('tenant_admin', 'platform_admin')
  async getOrphanedAccounts(
    @Req() req: any
  ) {
    return this.igaService.getOrphanedAccounts(req.tenantId);
  }

  @Get('reports/inactive-users')
  @Roles('tenant_admin', 'platform_admin')
  async getInactiveUsers(
    @Query('days') days: string = '90',
    @Req() req: any
  ) {
    return this.igaService.getInactiveUsers(req.tenantId, parseInt(days));
  }
}

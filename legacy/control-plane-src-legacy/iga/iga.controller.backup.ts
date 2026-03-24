import { 
  Controller, 
  Get, 
  Post, 
  Query, 
  Param, 
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { IgaService } from './iga.service.js';
import { Roles } from '../common/rbac/roles.decorator.js';
import { RolesGuard } from '../common/rbac/roles.guard.js';

interface TenantRequest {
  tenantId?: string;
  userId?: string;
  userRole?: string;
}

function CurrentUser() {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // Simple decorator to get current user from request
  };
}

function TenantId() {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // Simple decorator to get tenant ID from request
  };
}

@ApiTags('Identity Governance & Administration')
@Controller('iga')
@UseGuards(RolesGuard)
export class IgaController {
  constructor(private readonly igaService: IgaService) {}

  @Get('identities')
  @Roles(Role.TENANT_ADMIN, Role.ANALYST, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'List all identities in tenant' })
  @ApiResponse({ status: 200, description: 'Identities retrieved successfully' })
  async listIdentities(
    @Query() query: TenantUserQueryDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string }
  ) {
    return this.igaService.listIdentities(tenantId, query, user);
  }

  @Get('identities/:id')
  @Roles(Role.TENANT_ADMIN, Role.ANALYST, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'Get identity details' })
  @ApiResponse({ status: 200, description: 'Identity details retrieved' })
  async getIdentity(
    @Param('id') id: string,
    @TenantId() tenantId: string
  ) {
    return this.igaService.getIdentity(tenantId, id);
  }

  @Get('access-review')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Get access review data' })
  @ApiResponse({ status: 200, description: 'Access review data retrieved' })
  async getAccessReview(
    @Query('period') period: '30' | '60' | '90' = '30',
    @TenantId() tenantId: string
  ) {
    return this.igaService.getAccessReview(tenantId, parseInt(period));
  }

  @Post('access-review/:userId/revoke')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke user access' })
  @ApiResponse({ status: 200, description: 'Access revoked successfully' })
  async revokeAccess(
    @Param('userId') userId: string,
    @TenantId() tenantId: string,
    @CurrentUser() reviewer: { id: string; email: string }
  ) {
    return this.igaService.revokeAccess(tenantId, userId, reviewer);
  }

  @Get('entitlements')
  @Roles(Role.TENANT_ADMIN, Role.ANALYST, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'Get user entitlements summary' })
  @ApiResponse({ status: 200, description: 'Entitlements summary retrieved' })
  async getEntitlementsSummary(
    @TenantId() tenantId: string
  ) {
    return this.igaService.getEntitlementsSummary(tenantId);
  }

  @Get('reports/orphaned-accounts')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Get orphaned accounts report' })
  @ApiResponse({ status: 200, description: 'Orphaned accounts report generated' })
  async getOrphanedAccounts(
    @TenantId() tenantId: string
  ) {
    return this.igaService.getOrphanedAccounts(tenantId);
  }

  @Get('reports/inactive-users')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Get inactive users report' })
  @ApiResponse({ status: 200, description: 'Inactive users report generated' })
  async getInactiveUsers(
    @Query('days') days: number = 90,
    @TenantId() tenantId: string
  ) {
    return this.igaService.getInactiveUsers(tenantId, days);
  }
}

import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Query, 
  Param, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IvipService } from './ivip.service';
import { Roles, Role } from '../common/rbac/roles.decorator';
import { RequirePermissions } from '../common/rbac/permissions.decorator';
import { CurrentUser, TenantId } from '../common/tenant/tenant.decorator';

@ApiTags('Identity Verification & Provisioning')
@Controller('ivip')
@UseGuards(RolesGuard)
export class IvipController {
  constructor(private readonly ivipService: IvipService) {}

  @Get('requests')
  @Roles(Role.USER, Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('profile:read')
  @ApiOperation({ summary: 'List identity requests' })
  @ApiResponse({ status: 200, description: 'Requests retrieved successfully' })
  async listRequests(
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED',
    @Query('type') type?: 'ACCESS_REQUEST' | 'ROLE_CHANGE' | 'MFA_SETUP' | 'ACCOUNT_RECOVERY',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string }
  ) {
    return this.ivipService.listRequests(tenantId, user, { status, type, page, limit });
  }

  @Get('requests/:id')
  @Roles(Role.USER, Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('profile:read')
  @ApiOperation({ summary: 'Get request details' })
  @ApiResponse({ status: 200, description: 'Request details retrieved' })
  async getRequest(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string }
  ) {
    return this.ivipService.getRequest(tenantId, id, user);
  }

  @Post('requests')
  @Roles(Role.USER, Role.ANALYST)
  @RequirePermissions('profile:update')
  @ApiOperation({ summary: 'Create identity request' })
  @ApiResponse({ status: 201, description: 'Request created successfully' })
  async createRequest(
    @Body() createRequestDto: any,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.ivipService.createRequest(tenantId, user, createRequestDto);
  }

  @Put('requests/:id/approve')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve identity request' })
  @ApiResponse({ status: 200, description: 'Request approved successfully' })
  async approveRequest(
    @Param('id') id: string,
    @Body() body: { comments?: string },
    @TenantId() tenantId: string,
    @CurrentUser() approver: { id: string; email: string }
  ) {
    return this.ivipService.approveRequest(tenantId, id, approver, body.comments);
  }

  @Put('requests/:id/reject')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject identity request' })
  @ApiResponse({ status: 200, description: 'Request rejected successfully' })
  async rejectRequest(
    @Param('id') id: string,
    @Body() body: { reason: string; comments?: string },
    @TenantId() tenantId: string,
    @CurrentUser() rejector: { id: string; email: string }
  ) {
    return this.ivipService.rejectRequest(tenantId, id, rejector, body.reason, body.comments);
  }

  @Get('templates')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Get request templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getTemplates(@TenantId() tenantId: string) {
    return this.ivipService.getTemplates(tenantId);
  }

  @Get('workflows')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Get approval workflows' })
  @ApiResponse({ status: 200, description: 'Workflows retrieved successfully' })
  async getWorkflows(@TenantId() tenantId: string) {
    return this.ivipService.getWorkflows(tenantId);
  }

  @Get('analytics')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Get IVIP analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics(
    @Query('period') period: '7' | '30' | '90' = '30',
    @TenantId() tenantId: string
  ) {
    return this.ivipService.getAnalytics(tenantId, parseInt(period));
  }

  @Post('requests/:id/escalate')
  @Roles(Role.USER, Role.ANALYST)
  @RequirePermissions('profile:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate request' })
  @ApiResponse({ status: 200, description: 'Request escalated successfully' })
  async escalateRequest(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.ivipService.escalateRequest(tenantId, id, user, body.reason);
  }
}

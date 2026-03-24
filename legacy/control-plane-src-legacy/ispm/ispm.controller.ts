import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete,
  Query, 
  Param, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IspmService } from './ispm.service';
import { Roles, Role } from '../common/rbac/roles.decorator';
import { RequirePermissions } from '../common/rbac/permissions.decorator';
import { CurrentUser, TenantId } from '../common/tenant/tenant.decorator';

@ApiTags('Identity Security & Policy Management')
@Controller('ispm')
@UseGuards(RolesGuard)
export class IspmController {
  constructor(private readonly ispmService: IspmService) {}

  @Get('applications')
  @Roles(Role.USER, Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('profile:read')
  @ApiOperation({ summary: 'List applications in inventory' })
  @ApiResponse({ status: 200, description: 'Applications retrieved successfully' })
  async listApplications(
    @Query('status') status?: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED',
    @Query('category') category?: string,
    @Query('risk') risk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string }
  ) {
    return this.ispmService.listApplications(tenantId, user, { status, category, risk, page, limit });
  }

  @Get('applications/:id')
  @Roles(Role.USER, Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('profile:read')
  @ApiOperation({ summary: 'Get application details' })
  @ApiResponse({ status: 200, description: 'Application details retrieved' })
  async getApplication(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; role: string }
  ) {
    return this.ispmService.getApplication(tenantId, id, user);
  }

  @Post('applications')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Add application to inventory' })
  @ApiResponse({ status: 201, description: 'Application added successfully' })
  async createApplication(
    @Body() createAppDto: any,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.ispmService.createApplication(tenantId, user, createAppDto);
  }

  @Put('applications/:id')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Update application details' })
  @ApiResponse({ status: 200, description: 'Application updated successfully' })
  async updateApplication(
    @Param('id') id: string,
    @Body() updateAppDto: any,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.ispmService.updateApplication(tenantId, id, user, updateAppDto);
  }

  @Delete('applications/:id')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove application from inventory' })
  @ApiResponse({ status: 200, description: 'Application removed successfully' })
  async deleteApplication(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.ispmService.deleteApplication(tenantId, id, user);
  }

  @Get('policies')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'List security policies' })
  @ApiResponse({ status: 200, description: 'Policies retrieved successfully' })
  async listPolicies(
    @Query('type') type?: 'ACCESS' | 'PASSWORD' | 'MFA' | 'SESSION',
    @Query('status') status?: 'ACTIVE' | 'DRAFT' | 'DISABLED',
    @TenantId() tenantId: string
  ) {
    return this.ispmService.listPolicies(tenantId, { type, status });
  }

  @Post('policies')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Create security policy' })
  @ApiResponse({ status: 201, description: 'Policy created successfully' })
  async createPolicy(
    @Body() createPolicyDto: any,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.ispmService.createPolicy(tenantId, user, createPolicyDto);
  }

  @Put('policies/:id')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Update security policy' })
  @ApiResponse({ status: 200, description: 'Policy updated successfully' })
  async updatePolicy(
    @Param('id') id: string,
    @Body() updatePolicyDto: any,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.ispmService.updatePolicy(tenantId, id, user, updatePolicyDto);
  }

  @Get('risk-assessment')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Get risk assessment data' })
  @ApiResponse({ status: 200, description: 'Risk assessment data retrieved' })
  async getRiskAssessment(
    @TenantId() tenantId: string
  ) {
    return this.ispmService.getRiskAssessment(tenantId);
  }

  @Get('compliance-report')
  @Roles(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiResponse({ status: 200, description: 'Compliance report generated' })
  async getComplianceReport(
    @Query('standard') standard: 'SOC2' | 'ISO27001' | 'GDPR' | 'HIPAA',
    @TenantId() tenantId: string
  ) {
    return this.ispmService.getComplianceReport(tenantId, standard);
  }

  @Get('analytics')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('user:manage')
  @ApiOperation({ summary: 'Get ISPM analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics(
    @Query('period') period: '7' | '30' | '90' = '30',
    @TenantId() tenantId: string
  ) {
    return this.ispmService.getAnalytics(tenantId, parseInt(period));
  }
}

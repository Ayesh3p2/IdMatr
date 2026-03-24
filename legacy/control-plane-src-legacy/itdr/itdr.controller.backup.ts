import { 
  Controller, 
  Get, 
  Post, 
  Query, 
  Param, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ItdrService } from './itdr.service';
import { Roles, Role } from '../common/rbac/roles.decorator';
import { RequirePermissions } from '../common/rbac/permissions.decorator';
import { CurrentUser, TenantId } from '../common/tenant/tenant.decorator';

@ApiTags('Identity Threat Detection & Response')
@Controller('itdr')
@UseGuards(RolesGuard)
export class ItdrController {
  constructor(private readonly itdrService: ItdrService) {}

  @Get('events')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'List security events' })
  @ApiResponse({ status: 200, description: 'Security events retrieved successfully' })
  async listEvents(
    @Query('severity') severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    @Query('type') type?: string,
    @Query('status') status?: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @TenantId() tenantId: string
  ) {
    return this.itdrService.listEvents(tenantId, { 
      severity, type, status, startDate, endDate, page, limit 
    });
  }

  @Get('events/:id')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Get event details' })
  @ApiResponse({ status: 200, description: 'Event details retrieved' })
  async getEvent(
    @Param('id') id: string,
    @TenantId() tenantId: string
  ) {
    return this.itdrService.getEvent(tenantId, id);
  }

  @Get('alerts')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'List active alerts' })
  @ApiResponse({ status: 200, description: 'Alerts retrieved successfully' })
  async getAlerts(
    @Query('priority') priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    @Query('status') status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @TenantId() tenantId: string
  ) {
    return this.itdrService.getAlerts(tenantId, { priority, status, page, limit });
  }

  @Post('alerts/:id/acknowledge')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged successfully' })
  async acknowledgeAlert(
    @Param('id') id: string,
    @Body() body: { comments?: string },
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.itdrService.acknowledgeAlert(tenantId, id, user, body.comments);
  }

  @Post('alerts/:id/resolve')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve alert' })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully' })
  async resolveAlert(
    @Param('id') id: string,
    @Body() body: { resolution: string; comments?: string },
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.itdrService.resolveAlert(tenantId, id, user, body.resolution, body.comments);
  }

  @Get('dashboard')
  @Roles(Role.USER, Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('profile:read')
  @ApiOperation({ summary: 'Get ITDR dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(
    @Query('period') period: '24h' | '7d' | '30d' = '24h',
    @TenantId() tenantId: string
  ) {
    return this.itdrService.getDashboard(tenantId, period);
  }

  @Get('threat-intelligence')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Get threat intelligence data' })
  @ApiResponse({ status: 200, description: 'Threat intelligence retrieved successfully' })
  async getThreatIntelligence(
    @Query('type') type?: 'INDICATORS' | 'CAMPAIGNS' | 'VULNERABILITIES',
    @TenantId() tenantId: string
  ) {
    return this.itdrService.getThreatIntelligence(tenantId, type);
  }

  @Get('incidents')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'List security incidents' })
  @ApiResponse({ status: 200, description: 'Incidents retrieved successfully' })
  async getIncidents(
    @Query('status') status?: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED',
    @Query('severity') severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @TenantId() tenantId: string
  ) {
    return this.itdrService.getIncidents(tenantId, { status, severity, page, limit });
  }

  @Post('incidents')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Create security incident' })
  @ApiResponse({ status: 201, description: 'Incident created successfully' })
  async createIncident(
    @Body() createIncidentDto: any,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.itdrService.createIncident(tenantId, user, createIncidentDto);
  }

  @Get('analytics')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Get ITDR analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics(
    @Query('period') period: '7' | '30' | '90' = '30',
    @TenantId() tenantId: string
  ) {
    return this.itdrService.getAnalytics(tenantId, parseInt(period));
  }

  @Get('playbooks')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Get response playbooks' })
  @ApiResponse({ status: 200, description: 'Playbooks retrieved successfully' })
  async getPlaybooks(
    @Query('category') category?: string,
    @TenantId() tenantId: string
  ) {
    return this.itdrService.getPlaybooks(tenantId, category);
  }

  @Post('events/:id/investigate')
  @Roles(Role.ANALYST, Role.TENANT_ADMIN, Role.PLATFORM_ADMIN)
  @RequirePermissions('audit:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start event investigation' })
  @ApiResponse({ status: 200, description: 'Investigation started successfully' })
  async investigateEvent(
    @Param('id') id: string,
    @Body() body: { assignedTo?: string; priority?: string; notes?: string },
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string; email: string }
  ) {
    return this.itdrService.investigateEvent(tenantId, id, user, body);
  }
}

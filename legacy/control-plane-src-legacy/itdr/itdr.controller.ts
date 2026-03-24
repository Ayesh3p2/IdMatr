import { 
  Controller, 
  Get, 
  Post, 
  Query, 
  Param, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
  Req
} from '@nestjs/common';
import { ItdrService } from './itdr.service.js';
import { Roles } from '../common/rbac/roles.decorator.js';
import { RolesGuard } from '../common/rbac/roles.guard.js';

@Controller('itdr')
@UseGuards(RolesGuard)
export class ItdrController {
  constructor(private readonly itdrService: ItdrService) {}

  @Get('events')
  @Roles('tenant_admin', 'platform_admin')
  async listEvents(
    @Query('severity') severity?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Req() req: any
  ) {
    return this.itdrService.listEvents(req.tenantId, { 
      severity, type, status, startDate, endDate, page, limit 
    });
  }

  @Get('events/:id')
  @Roles('tenant_admin', 'platform_admin')
  async getEvent(
    @Param('id') id: string,
    @Req() req: any
  ) {
    return this.itdrService.getEvent(req.tenantId, id);
  }

  @Get('alerts')
  @Roles('tenant_admin', 'platform_admin')
  async getAlerts(
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Req() req: any
  ) {
    return this.itdrService.getAlerts(req.tenantId, { priority, status, page, limit });
  }

  @Post('alerts/:id/acknowledge')
  @Roles('tenant_admin', 'platform_admin')
  @HttpCode(HttpStatus.OK)
  async acknowledgeAlert(
    @Param('id') id: string,
    @Body() body: { comments?: string },
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.itdrService.acknowledgeAlert(req.tenantId, id, user, body.comments);
  }

  @Post('alerts/:id/resolve')
  @Roles('tenant_admin', 'platform_admin')
  @HttpCode(HttpStatus.OK)
  async resolveAlert(
    @Param('id') id: string,
    @Body() body: { resolution: string; comments?: string },
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.itdrService.resolveAlert(req.tenantId, id, user, body.resolution, body.comments);
  }

  @Get('dashboard')
  @Roles('user', 'tenant_admin', 'platform_admin')
  async getDashboard(
    @Query('period') period: string = '24h',
    @Req() req: any
  ) {
    return this.itdrService.getDashboard(req.tenantId, period);
  }

  @Get('threat-intelligence')
  @Roles('tenant_admin', 'platform_admin')
  async getThreatIntelligence(
    @Query('type') type?: string,
    @Req() req: any
  ) {
    return this.itdrService.getThreatIntelligence(req.tenantId, type);
  }

  @Get('incidents')
  @Roles('tenant_admin', 'platform_admin')
  async getIncidents(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Req() req: any
  ) {
    return this.itdrService.getIncidents(req.tenantId, { status, severity, page, limit });
  }

  @Post('incidents')
  @Roles('tenant_admin', 'platform_admin')
  async createIncident(
    @Body() createIncidentDto: any,
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.itdrService.createIncident(req.tenantId, user, createIncidentDto);
  }

  @Get('analytics')
  @Roles('tenant_admin', 'platform_admin')
  async getAnalytics(
    @Query('period') period: string = '30',
    @Req() req: any
  ) {
    return this.itdrService.getAnalytics(req.tenantId, parseInt(period));
  }

  @Get('playbooks')
  @Roles('tenant_admin', 'platform_admin')
  async getPlaybooks(
    @Query('category') category?: string,
    @Req() req: any
  ) {
    return this.itdrService.getPlaybooks(req.tenantId, category);
  }

  @Post('events/:id/investigate')
  @Roles('tenant_admin', 'platform_admin')
  @HttpCode(HttpStatus.OK)
  async investigateEvent(
    @Param('id') id: string,
    @Body() body: { assignedTo?: string; priority?: string; notes?: string },
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.itdrService.investigateEvent(req.tenantId, id, user, body);
  }
}

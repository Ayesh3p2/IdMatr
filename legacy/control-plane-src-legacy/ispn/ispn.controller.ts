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
  Body,
  Req
} from '@nestjs/common';
import { IspnService } from './ispn.service.js';
import { Roles } from '../common/rbac/roles.decorator.js';
import { RolesGuard } from '../common/rbac/roles.guard.js';

@Controller('ispn')
@UseGuards(RolesGuard)
export class IspnController {
  constructor(private readonly ispnService: IspnService) {}

  @Get('applications')
  @Roles('tenant_admin', 'platform_admin')
  async listApplications(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      role: req.userRole
    };
    return this.ispnService.listApplications(req.tenantId, user, { search, status, page, limit });
  }

  @Get('applications/:id')
  @Roles('tenant_admin', 'platform_admin')
  async getApplication(
    @Param('id') id: string,
    @Req() req: any
  ) {
    return this.ispnService.getApplication(req.tenantId, id);
  }

  @Post('applications')
  @Roles('tenant_admin', 'platform_admin')
  async createApplication(
    @Body() createAppDto: any,
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.ispnService.createApplication(req.tenantId, user, createAppDto);
  }

  @Put('applications/:id')
  @Roles('tenant_admin', 'platform_admin')
  async updateApplication(
    @Param('id') id: string,
    @Body() updateAppDto: any,
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.ispnService.updateApplication(req.tenantId, id, updateAppDto, user);
  }

  @Post('applications/:id/delete')
  @Roles('tenant_admin', 'platform_admin')
  @HttpCode(HttpStatus.OK)
  async deleteApplication(
    @Param('id') id: string,
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.ispnService.deleteApplication(req.tenantId, id, user);
  }

  @Get('risk-assessment')
  @Roles('tenant_admin', 'platform_admin')
  async getRiskAssessment(
    @Query('period') period: string = '30',
    @Req() req: any
  ) {
    return this.ispnService.getRiskAssessment(req.tenantId, parseInt(period));
  }

  @Get('compliance')
  @Roles('tenant_admin', 'platform_admin')
  async getComplianceStatus(@Req() req: any) {
    return this.ispnService.getComplianceStatus(req.tenantId);
  }

  @Post('scan')
  @Roles('tenant_admin', 'platform_admin')
  async scanApplications(@Req() req: any) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.ispnService.scanApplications(req.tenantId, user);
  }

  @Get('vulnerabilities')
  @Roles('tenant_admin', 'platform_admin')
  async getVulnerabilities(
    @Query('severity') severity?: string,
    @Req() req: any
  ) {
    return this.ispnService.getVulnerabilities(req.tenantId, severity);
  }

  @Get('integrations')
  @Roles('tenant_admin', 'platform_admin')
  async getIntegrations(@Req() req: any) {
    return this.ispnService.getIntegrations(req.tenantId);
  }
}

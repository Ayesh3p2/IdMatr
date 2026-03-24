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
import { IvipService } from './ivip.service.js';
import { Roles } from '../common/rbac/roles.decorator.js';
import { RolesGuard } from '../common/rbac/roles.guard.js';

@Controller('ivip')
@UseGuards(RolesGuard)
export class IvipController {
  constructor(private readonly ivipService: IvipService) {}

  @Get('requests')
  @Roles('user', 'tenant_admin', 'platform_admin')
  async listRequests(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      role: req.userRole
    };
    return this.ivipService.listRequests(req.tenantId, user, { status, type, page, limit });
  }

  @Get('requests/:id')
  @Roles('user', 'tenant_admin', 'platform_admin')
  async getRequest(
    @Param('id') id: string,
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      role: req.userRole
    };
    return this.ivipService.getRequest(req.tenantId, id, user);
  }

  @Post('requests')
  @Roles('user', 'tenant_admin')
  async createRequest(
    @Body() createRequestDto: any,
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'user@system'
    };
    return this.ivipService.createRequest(req.tenantId, user, createRequestDto);
  }

  @Put('requests/:id/approve')
  @Roles('tenant_admin', 'platform_admin')
  @HttpCode(HttpStatus.OK)
  async approveRequest(
    @Param('id') id: string,
    @Body() body: { comments?: string },
    @Req() req: any
  ) {
    const approver = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.ivipService.approveRequest(req.tenantId, id, approver, body.comments);
  }

  @Put('requests/:id/reject')
  @Roles('tenant_admin', 'platform_admin')
  @HttpCode(HttpStatus.OK)
  async rejectRequest(
    @Param('id') id: string,
    @Body() body: { reason: string; comments?: string },
    @Req() req: any
  ) {
    const rejector = {
      id: req.userId,
      email: req.user?.email || 'admin@system'
    };
    return this.ivipService.rejectRequest(req.tenantId, id, rejector, body.reason, body.comments);
  }

  @Get('templates')
  @Roles('tenant_admin', 'platform_admin')
  async getTemplates(@Req() req: any) {
    return this.ivipService.getTemplates(req.tenantId);
  }

  @Get('workflows')
  @Roles('tenant_admin', 'platform_admin')
  async getWorkflows(@Req() req: any) {
    return this.ivipService.getWorkflows(req.tenantId);
  }

  @Get('analytics')
  @Roles('tenant_admin', 'platform_admin')
  async getAnalytics(
    @Query('period') period: string = '30',
    @Req() req: any
  ) {
    return this.ivipService.getAnalytics(req.tenantId, parseInt(period));
  }

  @Post('requests/:id/escalate')
  @Roles('user', 'tenant_admin')
  @HttpCode(HttpStatus.OK)
  async escalateRequest(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any
  ) {
    const user = {
      id: req.userId,
      email: req.user?.email || 'user@system'
    };
    return this.ivipService.escalateRequest(req.tenantId, id, user, body.reason);
  }
}

import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { GoogleConnectDto } from './dto/google-connect.dto';
import { GoogleSyncDto } from './dto/google-sync.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.TENANT_ADMIN)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.integrationsService.listIntegrations(user);
  }

  @Post('google/connect')
  connectGoogle(@CurrentUser() user: RequestUser, @Body() dto: GoogleConnectDto) {
    return this.integrationsService.connectGoogle(user, dto);
  }

  @Post('google/health')
  healthCheckGoogle(@CurrentUser() user: RequestUser, @Body() dto: GoogleSyncDto) {
    return this.integrationsService.healthCheckGoogle(user, dto);
  }

  @Post('google/sync-users')
  syncGoogleUsers(@CurrentUser() user: RequestUser, @Body() dto: GoogleSyncDto) {
    return this.integrationsService.syncGoogleUsers(user, dto);
  }

  @Post('google/sync-groups')
  syncGoogleGroups(@CurrentUser() user: RequestUser, @Body() dto: GoogleSyncDto) {
    return this.integrationsService.syncGoogleGroups(user, dto);
  }

  @Post('google/sync-roles')
  syncGoogleRoles(@CurrentUser() user: RequestUser, @Body() dto: GoogleSyncDto) {
    return this.integrationsService.syncGoogleRoles(user, dto);
  }

  @Get('google/users')
  listGoogleUsers(@CurrentUser() user: RequestUser) {
    return this.integrationsService.listGoogleUsers(user);
  }

  @Get('google/groups')
  listGoogleGroups(@CurrentUser() user: RequestUser) {
    return this.integrationsService.listGoogleGroups(user);
  }

  @Get('google/onboarding')
  async googleOnboarding(@CurrentUser() user: RequestUser, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(await this.integrationsService.renderGoogleOnboardingPage(user));
  }

  @Get(':integrationId/identities')
  listIdentities(@CurrentUser() user: RequestUser, @Param('integrationId') integrationId: string) {
    return this.integrationsService.listIdentities(user, integrationId);
  }
}

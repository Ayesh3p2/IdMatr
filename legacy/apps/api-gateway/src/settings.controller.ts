import {
  Controller, Get, Patch, Post, Delete,
  Param, Body, UseGuards, Req, HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import {
  UpdateGeneralSettingsDto,
  UpdateSecuritySettingsDto,
  UpdateRiskSettingsDto,
  UpdateNotificationSettingsDto,
  UpdateDiscoverySettingsDto,
  UpdateIntegrationDto,
} from './dto/settings.dto';

/**
 * SettingsController — exposes tenant-scoped settings APIs.
 * All routes require JWT + admin role. Tenant isolation enforced via req.user.
 */
@Controller('api/settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Full settings bundle ───────────────────────────────────────────────────

  /** GET /api/settings — all settings categories */
  @Get()
  getAllSettings(@Req() req: any) {
    return this.settingsService.getAllSettings(req.user);
  }

  // ── Per-category getters ───────────────────────────────────────────────────

  /** GET /api/settings/general */
  @Get('general')
  getGeneral(@Req() req: any) {
    return this.settingsService.getCategorySettings(req.user, 'general');
  }

  /** GET /api/settings/security */
  @Get('security')
  getSecurity(@Req() req: any) {
    return this.settingsService.getCategorySettings(req.user, 'security');
  }

  /** GET /api/settings/risk */
  @Get('risk')
  getRisk(@Req() req: any) {
    return this.settingsService.getCategorySettings(req.user, 'risk');
  }

  /** GET /api/settings/notifications */
  @Get('notifications')
  getNotifications(@Req() req: any) {
    return this.settingsService.getCategorySettings(req.user, 'notifications');
  }

  /** GET /api/settings/discovery */
  @Get('discovery')
  getDiscovery(@Req() req: any) {
    return this.settingsService.getCategorySettings(req.user, 'discovery');
  }

  // ── Per-category updaters ──────────────────────────────────────────────────

  /** PATCH /api/settings/general */
  @Patch('general')
  @HttpCode(200)
  updateGeneral(@Req() req: any, @Body() dto: UpdateGeneralSettingsDto) {
    return this.settingsService.updateCategorySettings(req.user, 'general', dto.settings || {}, req.ip);
  }

  /** PATCH /api/settings/security */
  @Patch('security')
  @HttpCode(200)
  updateSecurity(@Req() req: any, @Body() dto: UpdateSecuritySettingsDto) {
    return this.settingsService.updateCategorySettings(req.user, 'security', dto.settings || {}, req.ip);
  }

  /** PATCH /api/settings/risk */
  @Patch('risk')
  @HttpCode(200)
  updateRisk(@Req() req: any, @Body() dto: UpdateRiskSettingsDto) {
    return this.settingsService.updateCategorySettings(req.user, 'risk', dto.settings || {}, req.ip);
  }

  /** PATCH /api/settings/notifications */
  @Patch('notifications')
  @HttpCode(200)
  updateNotifications(@Req() req: any, @Body() dto: UpdateNotificationSettingsDto) {
    return this.settingsService.updateCategorySettings(req.user, 'notifications', dto.settings || {}, req.ip);
  }

  /** PATCH /api/settings/discovery */
  @Patch('discovery')
  @HttpCode(200)
  updateDiscovery(@Req() req: any, @Body() dto: UpdateDiscoverySettingsDto) {
    return this.settingsService.updateCategorySettings(req.user, 'discovery', dto.settings || {}, req.ip);
  }

  // ── API Keys ────────────────────────────────────────────────────────────────

  /** GET /api/settings/api-keys */
  @Get('api-keys')
  getApiKeys(@Req() req: any) {
    return this.settingsService.getApiKeys(req.user);
  }

  /** POST /api/settings/api-keys */
  @Post('api-keys')
  @HttpCode(201)
  createApiKey(
    @Req() req: any,
    @Body('name') name: string,
    @Body('scopes') scopes: string[],
    @Body('expiresAt') expiresAt?: string,
  ) {
    return this.settingsService.createApiKey(req.user, name, scopes || [], expiresAt);
  }

  /** DELETE /api/settings/api-keys/:id */
  @Delete('api-keys/:id')
  @HttpCode(200)
  revokeApiKey(@Req() req: any, @Param('id') keyId: string) {
    return this.settingsService.revokeApiKey(req.user, keyId);
  }

  /** POST /api/settings/api-keys/:id/rotate */
  @Post('api-keys/:id/rotate')
  @HttpCode(200)
  rotateApiKey(@Req() req: any, @Param('id') keyId: string) {
    return this.settingsService.rotateApiKey(req.user, keyId);
  }

  // ── Integrations ────────────────────────────────────────────────────────────

  /** GET /api/settings/integrations */
  @Get('integrations')
  getIntegrations(@Req() req: any) {
    return this.settingsService.getIntegrations(req.user);
  }

  /** PATCH /api/settings/integrations/:provider */
  @Patch('integrations/:provider')
  @HttpCode(200)
  updateIntegration(
    @Req() req: any,
    @Param('provider') provider: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.settingsService.updateIntegration(req.user, provider, dto);
  }

  // ── Audit log ───────────────────────────────────────────────────────────────

  /** GET /api/settings/audit */
  @Get('audit')
  getSettingsAuditLog(@Req() req: any) {
    return this.settingsService.getSettingsAuditLog(req.user);
  }
}

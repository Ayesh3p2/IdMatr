import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantsService } from './tenants.service.js';
import {
  CreateTenantDto, UpdateTenantDto, UpdateTenantSettingsDto,
  UpsertIntegrationDto, CreateApiKeyDto,
} from './dto/create-tenant.dto.js';
import { Roles } from '../security/roles.decorator.js';
import { ControlPlaneRolesGuard } from '../security/roles.guard.js';
import { PLATFORM_OPERATOR_ROLE } from '../security/roles.js';

@Controller('control/tenants')
@UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
@Roles(PLATFORM_OPERATOR_ROLE)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  // ─── Tenant CRUD ─────────────────────────────────────────────────────────────

  /** POST /control/tenants — create tenant (adminEmail + frameworks required) */
  @Post()
  create(@Body() dto: CreateTenantDto, @Req() req: any) {
    return this.tenants.create(dto, req.user.sub);
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('search') search?: string,
  ) {
    return this.tenants.findAll({ status, plan, search });
  }

  @Get('stats')
  getPlatformStats() {
    return this.tenants.getPlatformStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenants.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto, @Req() req: any) {
    return this.tenants.update(id, dto, req.user.sub);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  @Post(':id/suspend')
  @HttpCode(200)
  suspend(@Param('id') id: string, @Body('reason') reason: string, @Req() req: any) {
    return this.tenants.suspend(id, reason || 'Operator-initiated suspension', req.user.sub);
  }

  @Post(':id/activate')
  @HttpCode(200)
  activate(@Param('id') id: string, @Req() req: any) {
    return this.tenants.activate(id, req.user.sub);
  }

  @Post(':id/offboard')
  @HttpCode(200)
  offboard(@Param('id') id: string, @Req() req: any) {
    return this.tenants.offboard(id, req.user.sub);
  }

  /**
   * DELETE /control/tenants/:id?confirm=permanently-delete
   * Part 8: Hard delete — permanently destroys tenant and all data.
   * Requires ?confirm=permanently-delete query param to prevent accidental deletion.
   */
  @Delete(':id')
  @HttpCode(200)
  hardDelete(
    @Param('id') id: string,
    @Query('confirm') confirm: string,
    @Req() req: any,
  ) {
    return this.tenants.hardDelete(id, confirm, req.user.sub);
  }

  /**
   * POST /control/tenants/:id/regenerate-onboarding
   * Part 9: Reset temp password, re-arm forcePasswordChange, resend welcome email.
   */
  @Post(':id/regenerate-onboarding')
  @HttpCode(200)
  regenerateOnboarding(@Param('id') id: string, @Req() req: any) {
    return this.tenants.regenerateOnboarding(id, req.user.sub);
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  @Get(':id/settings')
  getSettings(@Param('id') id: string) {
    return this.tenants.getSettings(id);
  }

  @Patch(':id/settings')
  updateSettings(@Param('id') id: string, @Body() dto: UpdateTenantSettingsDto, @Req() req: any) {
    return this.tenants.updateSettings(id, dto, req.user.sub);
  }

  // ─── Integrations ─────────────────────────────────────────────────────────────

  @Get(':id/integrations')
  getIntegrations(@Param('id') id: string) {
    return this.tenants.getIntegrations(id);
  }

  @Patch(':id/integrations/:provider')
  upsertIntegration(
    @Param('id') id: string,
    @Param('provider') provider: string,
    @Body() dto: Omit<UpsertIntegrationDto, 'provider'>,
    @Req() req: any,
  ) {
    return this.tenants.upsertIntegration(id, { ...dto, provider }, req.user.sub);
  }

  @Post(':id/integrations/:provider/sync')
  @HttpCode(200)
  syncIntegration(@Param('id') id: string, @Param('provider') provider: string, @Req() req: any) {
    return this.tenants.triggerIntegrationSync(id, provider, req.user.sub);
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────────

  @Post(':id/api-keys')
  createApiKey(@Param('id') id: string, @Body() dto: CreateApiKeyDto, @Req() req: any) {
    return this.tenants.createApiKey(id, dto, req.user.sub);
  }

  @Delete(':id/api-keys/:keyId')
  revokeApiKey(@Param('id') id: string, @Param('keyId') keyId: string, @Req() req: any) {
    return this.tenants.revokeApiKey(id, keyId, req.user.sub);
  }

  // ─── Health ──────────────────────────────────────────────────────────────────

  @Get(':id/health')
  getHealth(@Param('id') id: string) {
    return this.tenants.getHealth(id);
  }

  @Get(':id/export')
  exportTenantData(@Param('id') id: string) {
    return this.tenants.exportTenantData(id);
  }
}

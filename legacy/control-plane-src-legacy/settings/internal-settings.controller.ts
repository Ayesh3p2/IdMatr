import {
  Controller, Get, Patch, Post, Delete,
  Param, Body, Headers, UnauthorizedException, HttpCode,
  Req,
} from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { SettingsCategory } from './settings.defaults.js';

/**
 * InternalSettingsController — inter-service only endpoint.
 * Protected by INTERNAL_API_SECRET header.
 *
 * Context: 'SYSTEM' for system admin, or tenant UUID for tenant users.
 */
@Controller('internal/settings')
export class InternalSettingsController {
  private readonly internalSecret: string;

  constructor(private readonly settings: SettingsService) {
    if (!process.env.INTERNAL_API_SECRET) {
      throw new Error('INTERNAL_API_SECRET env var is required');
    }
    this.internalSecret = process.env.INTERNAL_API_SECRET;
  }

  private guard(secret: string | undefined): void {
    if (!secret || secret !== this.internalSecret) {
      throw new UnauthorizedException('Invalid internal secret');
    }
  }

  // ── Full settings bundle ───────────────────────────────────────────────────

  /** GET /internal/settings/:context — all categories merged */
  @Get(':context')
  @HttpCode(200)
  async getAllSettings(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
  ) {
    this.guard(secret);
    return this.settings.getAllSettings(context);
  }

  // ── API Keys (specific routes BEFORE :category wildcard) ─────────────────

  /** GET /internal/settings/:context/api-keys */
  @Get(':context/api-keys')
  @HttpCode(200)
  async getApiKeys(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
  ) {
    this.guard(secret);
    return this.settings.getApiKeys(context);
  }

  /** POST /internal/settings/:context/api-keys */
  @Post(':context/api-keys')
  @HttpCode(201)
  async createApiKey(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
    @Body() body: { name: string; scopes?: string[]; expiresAt?: string },
  ) {
    this.guard(secret);
    return this.settings.createApiKey(context, body.name, body.scopes || [], body.expiresAt);
  }

  /** DELETE /internal/settings/:context/api-keys/:id */
  @Delete(':context/api-keys/:id')
  @HttpCode(200)
  async revokeApiKey(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
    @Param('id') keyId: string,
  ) {
    this.guard(secret);
    return this.settings.revokeApiKey(context, keyId);
  }

  /** POST /internal/settings/:context/api-keys/:id/rotate */
  @Post(':context/api-keys/:id/rotate')
  @HttpCode(200)
  async rotateApiKey(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
    @Param('id') keyId: string,
  ) {
    this.guard(secret);
    return this.settings.rotateApiKey(context, keyId);
  }

  // ── Integrations (specific routes BEFORE :category wildcard) ──────────────

  /** GET /internal/settings/:context/integrations */
  @Get(':context/integrations')
  @HttpCode(200)
  async getIntegrations(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
  ) {
    this.guard(secret);
    return this.settings.getIntegrations(context);
  }

  /** PATCH /internal/settings/:context/integrations/:provider */
  @Patch(':context/integrations/:provider')
  @HttpCode(200)
  async updateIntegration(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
    @Param('provider') provider: string,
    @Body() body: Record<string, any>,
  ) {
    this.guard(secret);
    return this.settings.updateIntegration(context, provider.toUpperCase(), body);
  }

  // ── Audit log (specific route BEFORE :category wildcard) ──────────────────

  /** GET /internal/settings/:context/audit */
  @Get(':context/audit')
  @HttpCode(200)
  async getAuditLog(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
  ) {
    this.guard(secret);
    return this.settings.getAuditLog(context);
  }

  // ── Per-category (wildcard routes LAST) ───────────────────────────────────

  /** GET /internal/settings/:context/:category */
  @Get(':context/:category')
  @HttpCode(200)
  async getCategorySettings(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
    @Param('category') category: string,
  ) {
    this.guard(secret);
    return this.settings.getCategorySettings(context, category as SettingsCategory);
  }

  /** PATCH /internal/settings/:context/:category */
  @Patch(':context/:category')
  @HttpCode(200)
  async updateCategorySettings(
    @Headers('x-internal-secret') secret: string,
    @Param('context') context: string,
    @Param('category') category: string,
    @Body() body: { data: Record<string, any>; updatedBy?: string; ipAddress?: string },
    @Req() req: any,
  ) {
    this.guard(secret);
    const ipAddress = body.ipAddress || req.ip;
    return this.settings.updateCategorySettings(
      context,
      category as SettingsCategory,
      body.data,
      body.updatedBy,
      ipAddress,
    );
  }
}

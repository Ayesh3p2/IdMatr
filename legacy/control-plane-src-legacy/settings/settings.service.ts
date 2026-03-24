import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as crypto from 'crypto';
import { CATEGORY_DEFAULTS, SettingsCategory } from './settings.defaults.js';
import { EnvelopeEncryptionService } from '../security/envelope-encryption.service.js';
import { AuditLogService } from '../security/audit-log.service.js';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EnvelopeEncryptionService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ── Settings CRUD ────────────────────────────────────────────────────────────

  /** Get all settings for a context (merged with defaults for missing categories). */
  async getAllSettings(context: string): Promise<Record<SettingsCategory, any>> {
    const rows = await this.prisma.$queryRaw<Array<{ category: string; settings: any }>>`
      SELECT category, settings
      FROM control_plane.app_settings
      WHERE tenant_context = ${context}
    `;

    const stored: Record<string, any> = {};
    for (const row of rows) {
      // Prisma returns JSONB as a parsed object
      stored[row.category] = row.settings;
    }

    const categories: SettingsCategory[] = ['general', 'security', 'risk', 'notifications', 'discovery', 'integrations'];
    const result = {} as Record<SettingsCategory, any>;
    for (const cat of categories) {
      result[cat] = { ...CATEGORY_DEFAULTS[cat], ...(stored[cat] || {}) };
    }

    // Never return SMTP password in plaintext
    if (result.notifications) {
      result.notifications.smtpPassword = undefined;
      result.notifications.smtpPasswordSet = !!(stored['notifications']?.smtpPassword);
    }

    return result;
  }

  /** Get a single settings category. */
  async getCategorySettings(context: string, category: SettingsCategory): Promise<any> {
    const rows = await this.prisma.$queryRaw<Array<{ settings: any }>>`
      SELECT settings
      FROM control_plane.app_settings
      WHERE tenant_context = ${context} AND category = ${category}
    `;
    const stored = rows[0]?.settings || {};
    const merged = { ...CATEGORY_DEFAULTS[category], ...stored };

    // Strip password from notifications
    if (category === 'notifications') {
      merged.smtpPassword = undefined;
      merged.smtpPasswordSet = !!stored.smtpPassword;
    }
    return merged;
  }

  /** Update a single settings category. Returns the saved settings. */
  async updateCategorySettings(
    context: string,
    category: SettingsCategory,
    data: Record<string, any>,
    updatedBy?: string,
    ipAddress?: string,
  ): Promise<any> {
    // Fetch current value for audit log
    const current = await this.prisma.$queryRaw<Array<{ settings: any }>>`
      SELECT settings FROM control_plane.app_settings
      WHERE tenant_context = ${context} AND category = ${category}
    `;
    const oldValue = current[0]?.settings || null;

    // Merge with existing settings so partial updates don't lose other fields
    const existing = oldValue || {};

    // For notifications: preserve existing smtpPassword if new one not provided
    let newSettings = { ...existing, ...data };
    if (category === 'notifications') {
      if (!data.smtpPassword && existing.smtpPassword) {
        newSettings.smtpPassword = existing.smtpPassword; // preserve
      } else if (!data.smtpPassword) {
        delete newSettings.smtpPassword; // clear if explicitly empty
      } else {
        newSettings.smtpPassword = this.encryption.encryptString(String(data.smtpPassword));
      }
    }

    if (category === 'integrations') {
      newSettings = this.encryptSensitiveValues(newSettings);
    }

    const settingsJson = JSON.stringify(newSettings);

    await this.prisma.$executeRaw`
      INSERT INTO control_plane.app_settings (tenant_context, category, settings, updated_at, updated_by)
      VALUES (${context}, ${category}, ${settingsJson}::jsonb, NOW(), ${updatedBy || null})
      ON CONFLICT (tenant_context, category)
      DO UPDATE SET
        settings = ${settingsJson}::jsonb,
        updated_at = NOW(),
        updated_by = ${updatedBy || null}
    `;

    // Write audit log
    const oldJson = oldValue ? JSON.stringify(oldValue) : null;
    await this.prisma.$executeRaw`
      INSERT INTO control_plane.settings_audit_log
        (tenant_context, category, changed_by, old_value, new_value, ip_address)
      VALUES (
        ${context}, ${category}, ${updatedBy || null},
        ${oldJson ? oldJson + '::jsonb' : null}::jsonb,
        ${settingsJson}::jsonb,
        ${ipAddress || null}
      )
    `.catch(err => this.logger.warn(`Settings audit log write failed: ${err.message}`));

    await this.auditLog.write({
      tenantId: context === 'SYSTEM' ? null : context,
      action: 'settings.updated',
      category: 'configuration',
      severity: 'info',
      description: `Settings category ${category} updated for ${context}`,
      metadata: { category, updatedBy: updatedBy || null },
      ipAddress: ipAddress || null,
    });

    this.logger.log(`Settings[${category}] updated for context: ${context}`);

    // Return merged result (without password)
    const saved = await this.getCategorySettings(context, category);
    return saved;
  }

  // ── API Keys ─────────────────────────────────────────────────────────────────

  async getApiKeys(context: string): Promise<any[]> {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string; name: string; key_prefix: string; scopes: string[];
      is_active: boolean; expires_at: Date | null; last_used_at: Date | null; created_at: Date;
    }>>`
      SELECT id, name, key_prefix, scopes, is_active, expires_at, last_used_at, created_at
      FROM control_plane.context_api_keys
      WHERE context = ${context}
      ORDER BY created_at DESC
    `;
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      keyPrefix: r.key_prefix,
      keyDisplay: `${r.key_prefix}••••••••••••`,
      scopes: r.scopes,
      isActive: r.is_active,
      expiresAt: r.expires_at?.toISOString() || null,
      lastUsedAt: r.last_used_at?.toISOString() || null,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async createApiKey(
    context: string,
    name: string,
    scopes: string[],
    expiresAt?: string,
  ): Promise<{ key: string; keyPrefix: string; id: string }> {
    const rawKey = `idm_${crypto.randomBytes(20).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const scopesArray = scopes && scopes.length ? scopes : ['read:identities'];
    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
    const scopesSql = `{${scopesArray.map(s => `"${s}"`).join(',')}}`;

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO control_plane.context_api_keys
        (context, name, key_prefix, key_hash, scopes, expires_at)
      VALUES (
        ${context}, ${name}, ${keyPrefix}, ${keyHash},
        ${scopesSql}::text[],
        ${expiresAtDate}
      )
      RETURNING id
    `;

    this.logger.log(`API key created for context: ${context} (${name})`);

    return { key: rawKey, keyPrefix, id: rows[0].id };
  }

  async revokeApiKey(context: string, keyId: string): Promise<{ success: boolean }> {
    await this.prisma.$executeRaw`
      UPDATE control_plane.context_api_keys
      SET is_active = FALSE
      WHERE id = ${keyId} AND context = ${context}
    `;
    this.logger.log(`API key ${keyId} revoked for context: ${context}`);
    return { success: true };
  }

  /** Rotate an API key: revoke old one, create new with same name+scopes */
  async rotateApiKey(context: string, keyId: string): Promise<{ key: string; keyPrefix: string; id: string }> {
    // Get the existing key details
    const rows = await this.prisma.$queryRaw<Array<{ name: string; scopes: string[] }>>`
      SELECT name, scopes FROM control_plane.context_api_keys
      WHERE id = ${keyId} AND context = ${context}
    `;
    if (!rows.length) throw new Error('API key not found');
    const { name, scopes } = rows[0];

    // Revoke old
    await this.revokeApiKey(context, keyId);
    // Create new
    return this.createApiKey(context, name, scopes);
  }

  // ── Integrations (for tenant users) ─────────────────────────────────────────

  /** For tenant users: return tenant_integrations; for SYSTEM: use app_settings */
  async getIntegrations(context: string): Promise<any[]> {
    if (context === 'SYSTEM') {
      const settings = await this.getCategorySettings(context, 'integrations');
      return Object.entries(settings).map(([provider, cfg]: [string, any]) => ({
        provider,
        enabled: cfg.enabled || false,
        configured: cfg.configured || false,
        status: cfg.enabled ? (cfg.configured ? 'ACTIVE' : 'PENDING') : 'DISABLED',
        lastSyncAt: null,
      }));
    }

    // For tenant context: use tenant_integrations table
    try {
      const rows = await this.prisma.$queryRaw<Array<{
        provider: string; enabled: boolean; status: string; last_sync_at: Date | null;
        config_json: string | null; error_count: number; sync_count: number;
      }>>`
        SELECT provider, enabled, status, last_sync_at, config_json, error_count, sync_count
        FROM control_plane.tenant_integrations
        WHERE "tenantId" = ${context}
        ORDER BY provider
      `;
      return rows.map(r => ({
        provider: r.provider,
        enabled: r.enabled,
        configured: !!r.config_json,
        status: r.status,
        lastSyncAt: r.last_sync_at?.toISOString() || null,
        errorCount: r.error_count,
        syncCount: r.sync_count,
      }));
    } catch {
      return [];
    }
  }

  async updateIntegration(context: string, provider: string, data: Record<string, any>): Promise<any> {
    if (context === 'SYSTEM') {
      const settings = await this.getCategorySettings(context, 'integrations');
      settings[provider] = { ...settings[provider], ...data };
      await this.updateCategorySettings(context, 'integrations', settings);
      return settings[provider];
    }

    // For tenant context: use tenant_integrations table
    const configJson = data.configJson
      ? this.encryption.encryptString(typeof data.configJson === 'string'
        ? data.configJson
        : JSON.stringify(data.configJson))
      : null;
    await this.prisma.$executeRaw`
      UPDATE control_plane.tenant_integrations
      SET enabled = ${data.enabled ?? false},
          status = ${data.enabled ? 'ACTIVE' : 'DISABLED'},
          config_json = COALESCE(${configJson}, config_json),
          "updatedAt" = NOW()
      WHERE "tenantId" = ${context} AND provider = ${provider}::text
    `;
    return { provider, enabled: data.enabled };
  }

  // ── Settings Audit History ────────────────────────────────────────────────────

  async getAuditLog(context: string, limit = 50): Promise<any[]> {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string; category: string; changed_by: string | null;
      old_value: any; new_value: any; ip_address: string | null; created_at: Date;
    }>>`
      SELECT id, category, changed_by, old_value, new_value, ip_address, created_at
      FROM control_plane.settings_audit_log
      WHERE tenant_context = ${context}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(r => ({
      id: r.id,
      category: r.category,
      changedBy: r.changed_by,
      ipAddress: r.ip_address,
      createdAt: r.created_at.toISOString(),
    }));
  }

  private encryptSensitiveValues(value: Record<string, any>) {
    return Object.fromEntries(Object.entries(value).map(([key, innerValue]) => {
      if (
        innerValue &&
        typeof innerValue === 'object' &&
        !Array.isArray(innerValue)
      ) {
        return [key, this.encryptSensitiveValues(innerValue as Record<string, any>)];
      }

      if (
        typeof innerValue === 'string' &&
        /(token|secret|password|clientSecret|apiKey)/i.test(key)
      ) {
        return [key, this.encryption.encryptString(innerValue)];
      }

      return [key, innerValue];
    }));
  }
}

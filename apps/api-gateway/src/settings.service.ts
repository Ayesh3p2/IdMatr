import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

/**
 * SettingsService — proxies all settings operations to the control-plane
 * internal API. Uses the context-aware tenant isolation model:
 *   - tenantId === null  → context = 'SYSTEM' (system admin)
 *   - tenantId === <uuid> → context = <uuid>   (tenant user)
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cpUrl = process.env.CONTROL_PLANE_INTERNAL_URL || 'http://control-plane:3010';
  private readonly secret = process.env.INTERNAL_API_SECRET;

  private headers() {
    return {
      'Content-Type': 'application/json',
      'X-Internal-Secret': this.secret,
    };
  }

  private contextFor(user: { tenantId?: string | null }): string {
    return user.tenantId || 'SYSTEM';
  }

  private async cpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.cpUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { ...this.headers(), ...(init.headers as Record<string, string> || {}) },
        signal: AbortSignal.timeout(8000),
      });
    } catch (err: any) {
      this.logger.error(`Control-plane unreachable: ${url} — ${err.message}`);
      throw new Error('Settings service unavailable');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Control-plane ${path} returned ${res.status}: ${text}`);
      if (res.status === 401) throw new UnauthorizedException('Settings access denied');
      throw new Error(`Settings API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  // ── All settings ────────────────────────────────────────────────────────────

  async getAllSettings(user: { tenantId?: string | null }) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}`);
  }

  async getCategorySettings(user: { tenantId?: string | null }, category: string) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}/${category}`);
  }

  async updateCategorySettings(
    user: { tenantId?: string | null; userId?: string; email?: string },
    category: string,
    data: Record<string, any>,
    ipAddress?: string,
  ) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}/${category}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data,
        updatedBy: user.email || user.userId || 'unknown',
        ipAddress,
      }),
    });
  }

  // ── API Keys ────────────────────────────────────────────────────────────────

  async getApiKeys(user: { tenantId?: string | null }) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}/api-keys`);
  }

  async createApiKey(
    user: { tenantId?: string | null },
    name: string,
    scopes: string[],
    expiresAt?: string,
  ) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}/api-keys`, {
      method: 'POST',
      body: JSON.stringify({ name, scopes, expiresAt }),
    });
  }

  async revokeApiKey(user: { tenantId?: string | null }, keyId: string) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  async rotateApiKey(user: { tenantId?: string | null }, keyId: string) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}/api-keys/${keyId}/rotate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // ── Integrations ────────────────────────────────────────────────────────────

  async getIntegrations(user: { tenantId?: string | null }) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}/integrations`);
  }

  async updateIntegration(
    user: { tenantId?: string | null },
    provider: string,
    data: Record<string, any>,
  ) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}/integrations/${provider}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ── Audit log ────────────────────────────────────────────────────────────────

  async getSettingsAuditLog(user: { tenantId?: string | null }) {
    const ctx = this.contextFor(user);
    return this.cpFetch(`/internal/settings/${ctx}/audit`);
  }
}

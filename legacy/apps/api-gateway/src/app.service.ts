import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  TENANT_ADMIN_ROLE,
  normalizeTenantRole,
} from './security';

type TenantUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  forcePasswordChange: boolean;
  mfaEnabled?: boolean;
};

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly jwtService: JwtService) {}

  async login(email: string, password: string, options?: { tenantSlug?: string; tenantId?: string; totpCode?: string; ipAddress?: string; userAgent?: string }) {
    const cpUrl = process.env.CONTROL_PLANE_INTERNAL_URL;
    if (!cpUrl || !process.env.INTERNAL_API_SECRET) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let tenantUser: TenantUser;
    try {
      const res = await fetch(`${cpUrl}/internal/auth/validate-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': process.env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify({
          email,
          password,
          tenantSlug: options?.tenantSlug,
          tenantId: options?.tenantId,
          totpCode: options?.totpCode,
          ipAddress: options?.ipAddress,
          userAgent: options?.userAgent,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.status === 401) {
        throw new UnauthorizedException('Invalid credentials');
      }
      if (!res.ok) {
        this.logger.warn(`Control plane validate-user returned ${res.status}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      tenantUser = await res.json() as TenantUser;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Tenant login failed: ${error.message}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const normalizedRole = normalizeTenantRole(tenantUser.role);
    const payload = {
      sub: tenantUser.id,
      email: tenantUser.email,
      name: tenantUser.name,
      roles: [normalizedRole],
      tenantId: tenantUser.tenantId,
      forcePasswordChange: tenantUser.forcePasswordChange,
      userType: 'tenant_user',
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: tenantUser.id,
        email: tenantUser.email,
        name: tenantUser.name,
        roles: [normalizedRole],
        tenantId: tenantUser.tenantId,
        forcePasswordChange: tenantUser.forcePasswordChange,
        userType: 'tenant_user',
      },
    };
  }

  async completeOnboarding(token: string, newPassword: string, ipAddress?: string, userAgent?: string) {
    const cpUrl = process.env.CONTROL_PLANE_INTERNAL_URL;
    if (!cpUrl || !process.env.INTERNAL_API_SECRET) {
      throw new UnauthorizedException('Onboarding is unavailable');
    }

    const res = await fetch(`${cpUrl}/internal/auth/complete-onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET,
      },
      body: JSON.stringify({ token, newPassword, ipAddress, userAgent }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Onboarding failed');
      throw new UnauthorizedException(text || 'Onboarding failed');
    }

    const tenantUser = await res.json() as TenantUser;
    const normalizedRole = normalizeTenantRole(tenantUser.role);
    const payload = {
      sub: tenantUser.id,
      email: tenantUser.email,
      name: tenantUser.name,
      roles: [normalizedRole],
      tenantId: tenantUser.tenantId,
      forcePasswordChange: false,
      userType: 'tenant_user',
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: tenantUser.id,
        email: tenantUser.email,
        name: tenantUser.name,
        roles: [normalizedRole],
        tenantId: tenantUser.tenantId,
        forcePasswordChange: false,
        userType: 'tenant_user',
      },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, ipAddress?: string, userAgent?: string) {
    const cpUrl = process.env.CONTROL_PLANE_INTERNAL_URL;
    if (!cpUrl || !process.env.INTERNAL_API_SECRET) {
      throw new UnauthorizedException('Password change not available');
    }

    const res = await fetch(`${cpUrl}/internal/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET,
      },
      body: JSON.stringify({ userId, currentPassword, newPassword, ipAddress, userAgent }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await res.json() as { success: boolean; message: string };
    if (!res.ok || !data.success) {
      throw new UnauthorizedException(data.message || 'Password change failed');
    }
    return data;
  }

  async logout() {
    return { success: true };
  }

  async setupTenantMfa(userId: string) {
    return this.postTenantMfa('/internal/auth/tenant-mfa/setup', { userId });
  }

  async enableTenantMfa(userId: string, code: string) {
    return this.postTenantMfa('/internal/auth/tenant-mfa/enable', { userId, code });
  }

  async disableTenantMfa(userId: string, code: string) {
    return this.postTenantMfa('/internal/auth/tenant-mfa/disable', { userId, code });
  }

  async getTenantMfaStatus(userId: string) {
    return this.postTenantMfa('/internal/auth/tenant-mfa/status', { userId });
  }

  async getPrivacyNotice(tenantId?: string) {
    return this.postInternal('/internal/privacy/notice/active', { tenantId: tenantId || null });
  }

  async acceptPrivacyNotice(tenantId: string, tenantUserId: string, privacyNoticeId: string, ipAddress?: string, userAgent?: string) {
    return this.postInternal('/internal/privacy/notice/accept', {
      tenantId,
      tenantUserId,
      privacyNoticeId,
      ipAddress,
      userAgent,
    });
  }

  async listPrivacyConsents(tenantId: string, tenantUserId: string) {
    return this.postInternal('/internal/privacy/consents', { tenantId, tenantUserId });
  }

  async recordPrivacyConsent(
    tenantId: string,
    tenantUserId: string,
    consent: { purpose: string; lawfulBasis: string; status?: string },
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.postInternal('/internal/privacy/consent', {
      tenantId,
      tenantUserId,
      ...consent,
      ipAddress,
      userAgent,
    });
  }

  async exportMyData(tenantId: string, tenantUserId: string) {
    return this.postInternal('/internal/privacy/subject/export', { tenantId, tenantUserId });
  }

  async rectifyMyData(
    tenantId: string,
    tenantUserId: string,
    data: { name?: string; email?: string; legalBasis?: string; dataCategories?: string[] },
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.postInternal('/internal/privacy/subject/rectify', {
      tenantId,
      tenantUserId,
      ...data,
      ipAddress,
      userAgent,
    });
  }

  async deleteMyData(tenantId: string, tenantUserId: string, reason: string, ipAddress?: string, userAgent?: string) {
    return this.postInternal('/internal/privacy/subject/delete', {
      tenantId,
      tenantUserId,
      reason,
      ipAddress,
      userAgent,
    });
  }

  getCurrentUser(user: { userId: string; email: string; roles: string[]; name?: string; tenantId?: string }) {
    return {
      id: user.userId,
      email: user.email,
      roles: user.roles,
      name: user.name || 'Administrator',
      tenantId: user.tenantId || null,
    };
  }

  private async postTenantMfa(path: string, body: Record<string, any>) {
    return this.postInternal(path, body);
  }

  private async postInternal(path: string, body: Record<string, any>) {
    const cpUrl = process.env.CONTROL_PLANE_INTERNAL_URL;
    if (!cpUrl || !process.env.INTERNAL_API_SECRET) {
      throw new UnauthorizedException('Internal service unavailable');
    }

    const res = await fetch(`${cpUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Internal request failed');
      throw new UnauthorizedException(text || 'Internal request failed');
    }

    return res.json();
  }
}

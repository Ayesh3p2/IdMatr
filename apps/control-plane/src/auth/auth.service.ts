import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { EnvelopeEncryptionService } from '../security/envelope-encryption.service.js';
import {
  PLATFORM_OPERATOR_ROLE,
  TENANT_ADMIN_ROLE,
  isPrivilegedOperatorRole,
  isPrivilegedTenantRole,
  normalizeOperatorRole,
  normalizeTenantRole,
} from '../security/roles.js';
import {
  buildTotpOtpAuthUrl,
  generateTotpSecret,
  verifyTotpCode,
} from '../security/totp.js';

type TenantUserResult = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  forcePasswordChange: boolean;
  mfaEnabled: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxAttempts = 5;
  private readonly lockoutMs = 15 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditLog: AuditLogService,
    private readonly encryption: EnvelopeEncryptionService,
  ) {}

  async login(email: string, password: string, totpCode?: string, ipAddress?: string, userAgent?: string) {
    const operator = await this.prisma.operator.findUnique({ where: { email } });
    if (!operator || !operator.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.ensureNotLocked(
      operator.lockedUntil,
      'Account locked due to repeated failed login attempts',
    );

    const valid = await bcrypt.compare(password, operator.passwordHash);
    if (!valid) {
      await this.recordOperatorFailure(operator.id, operator.failedLoginAttempts || 0, ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    const normalizedRole = normalizeOperatorRole(operator.role);
    if (isPrivilegedOperatorRole(normalizedRole) && operator.mfaEnabled) {
      await this.assertValidTotp(operator.mfaSecret, totpCode);
    }

    await this.prisma.operator.update({
      where: { id: operator.id },
      data: {
        role: normalizedRole,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
        lastLogin: new Date(),
      },
    });

    await this.auditLog.write({
      operatorId: operator.id,
      action: 'auth.operator.login',
      category: 'auth',
      severity: 'info',
      description: `Operator ${operator.email} logged in`,
      ipAddress,
      userAgent,
    });

    const payload = {
      sub: operator.id,
      email: operator.email,
      role: normalizedRole,
      type: 'platform_operator',
    };

    return {
      access_token: this.jwt.sign(payload),
      operator: {
        id: operator.id,
        email: operator.email,
        name: operator.name,
        role: normalizedRole,
        mfaEnabled: operator.mfaEnabled,
      },
    };
  }

  async logout(operatorId: string, ipAddress?: string, userAgent?: string) {
    await this.auditLog.write({
      operatorId,
      action: 'auth.operator.logout',
      category: 'auth',
      severity: 'info',
      description: 'Operator session ended',
      ipAddress,
      userAgent,
    });

    return { success: true };
  }

  async getMe(operatorId: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    if (!operator) throw new UnauthorizedException();
    return { ...operator, role: normalizeOperatorRole(operator.role) };
  }

  async seedSuperAdmin() {
    const email = process.env.OPERATOR_EMAIL;
    const password = process.env.OPERATOR_PASSWORD;

    if (!email || !password) {
      this.logger.error('OPERATOR_EMAIL and OPERATOR_PASSWORD must be configured');
      return;
    }

    const existing = await this.prisma.operator.findUnique({ where: { email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 12);
      await this.prisma.operator.create({
        data: {
          email,
          name: 'Platform Administrator',
          passwordHash,
          role: PLATFORM_OPERATOR_ROLE,
          isActive: true,
        },
      });
      this.logger.log(`Platform operator seeded: ${email}`);
    }
  }

  async validateTenantUser(input: {
    email: string;
    password: string;
    tenantId?: string;
    tenantSlug?: string;
    totpCode?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<TenantUserResult | null> {
    const tenant = input.tenantId
      ? await this.prisma.tenant.findUnique({ where: { id: input.tenantId } })
      : input.tenantSlug
        ? await this.prisma.tenant.findUnique({ where: { slug: input.tenantSlug } })
        : null;

    const matches = await this.prisma.tenantUser.findMany({
      where: {
        email: input.email,
        isActive: true,
        ...(tenant ? { tenantId: tenant.id } : {}),
      },
      include: { tenant: { select: { id: true, slug: true, status: true } } },
      take: tenant ? 1 : 3,
    });

    if (!matches.length) return null;
    if (!tenant && matches.length > 1) {
      this.logger.warn(`Ambiguous tenant login for ${input.email}`);
      return null;
    }

    const user = matches[0];
    await this.ensureNotLocked(
      user.lockedUntil,
      'Account locked due to repeated failed login attempts',
    );

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      await this.recordTenantFailure(user.id, user.failedLoginAttempts || 0, input.ipAddress, input.userAgent);
      return null;
    }

    const normalizedRole = normalizeTenantRole(user.role);
    if (isPrivilegedTenantRole(normalizedRole) && user.mfaEnabled) {
      await this.assertValidTotp(user.mfaSecret, input.totpCode);
    }

    await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: {
        role: normalizedRole,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
        lastLogin: new Date(),
      },
    }).catch(() => undefined);

    await this.auditLog.write({
      tenantId: user.tenantId,
      action: 'auth.tenant.login',
      category: 'auth',
      severity: 'info',
      description: `Tenant user ${user.email} logged in`,
      metadata: { role: normalizedRole, tenantSlug: user.tenant.slug },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: normalizedRole,
      forcePasswordChange: user.forcePasswordChange,
      mfaEnabled: user.mfaEnabled,
    };
  }

  async changeTenantUserPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.tenantUser.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return { success: false, message: 'User not found or inactive' };
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return { success: false, message: 'Current password is incorrect' };
    }

    this.assertStrongPassword(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const wasForced = user.forcePasswordChange;

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        passwordHash,
        forcePasswordChange: false,
        updatedAt: new Date(),
      },
    });

    if (wasForced && normalizeTenantRole(user.role) === TENANT_ADMIN_ROLE) {
      await this.prisma.tenant.update({
        where: { id: user.tenantId },
        data: {
          status: 'ACTIVE',
          onboardingCompletedAt: new Date(),
        },
      }).catch(() => undefined);
    }

    await this.auditLog.write({
      tenantId: user.tenantId,
      action: 'auth.tenant.password_changed',
      category: 'auth',
      severity: 'info',
      description: `Tenant user ${user.email} changed password`,
      ipAddress,
      userAgent,
    });

    return { success: true, message: 'Password changed successfully' };
  }

  async completeOnboarding(
    token: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.assertStrongPassword(newPassword);
    const tokenHash = this.hashToken(token);
    const onboarding = await this.prisma.onboardingToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        tenant: true,
        tenantUser: true,
      },
    });

    if (!onboarding) {
      throw new UnauthorizedException('Onboarding link is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.tenantUser.update({
        where: { id: onboarding.tenantUserId },
        data: {
          passwordHash,
          forcePasswordChange: false,
          isActive: true,
          updatedAt: new Date(),
        },
      }),
      this.prisma.tenant.update({
        where: { id: onboarding.tenantId },
        data: {
          status: 'ACTIVE',
          onboardingCompletedAt: new Date(),
        },
      }),
      this.prisma.onboardingToken.update({
        where: { id: onboarding.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.auditLog.write({
      tenantId: onboarding.tenantId,
      action: 'auth.tenant.onboarding_completed',
      category: 'auth',
      severity: 'info',
      description: `Tenant onboarding completed for ${onboarding.tenantUser.email}`,
      metadata: { tenantSlug: onboarding.tenant.slug },
      ipAddress,
      userAgent,
    });

    return {
      id: onboarding.tenantUser.id,
      tenantId: onboarding.tenantUser.tenantId,
      email: onboarding.tenantUser.email,
      name: onboarding.tenantUser.name,
      role: normalizeTenantRole(onboarding.tenantUser.role),
      forcePasswordChange: false,
    };
  }

  async createOperatorMfaSetup(operatorId: string) {
    const operator = await this.prisma.operator.findUnique({ where: { id: operatorId } });
    if (!operator) throw new UnauthorizedException();

    const secret = generateTotpSecret();
    await this.prisma.operator.update({
      where: { id: operatorId },
      data: { mfaSecret: this.encryption.encryptString(secret) },
    });

    return {
      secret,
      otpAuthUrl: buildTotpOtpAuthUrl(operator.email, secret, 'IDMatr Control Plane'),
      mfaEnabled: false,
    };
  }

  async enableOperatorMfa(operatorId: string, code: string) {
    const operator = await this.prisma.operator.findUnique({ where: { id: operatorId } });
    if (!operator?.mfaSecret) throw new UnauthorizedException('MFA setup has not been started');

    await this.assertValidTotp(operator.mfaSecret, code);
    await this.prisma.operator.update({
      where: { id: operatorId },
      data: { mfaEnabled: true },
    });

    await this.auditLog.write({
      operatorId,
      action: 'auth.operator.mfa_enabled',
      category: 'auth',
      severity: 'info',
      description: `MFA enabled for ${operator.email}`,
    });

    return { success: true, mfaEnabled: true };
  }

  async disableOperatorMfa(operatorId: string, code: string) {
    const operator = await this.prisma.operator.findUnique({ where: { id: operatorId } });
    if (!operator?.mfaSecret) throw new UnauthorizedException('MFA is not enabled');

    await this.assertValidTotp(operator.mfaSecret, code);
    await this.prisma.operator.update({
      where: { id: operatorId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    await this.auditLog.write({
      operatorId,
      action: 'auth.operator.mfa_disabled',
      category: 'auth',
      severity: 'warning',
      description: `MFA disabled for ${operator.email}`,
    });

    return { success: true, mfaEnabled: false };
  }

  async getOperatorMfaStatus(operatorId: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      select: { mfaEnabled: true },
    });
    if (!operator) throw new UnauthorizedException();
    return operator;
  }

  async createTenantMfaSetup(userId: string) {
    const user = await this.prisma.tenantUser.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!isPrivilegedTenantRole(user.role)) {
      throw new UnauthorizedException('MFA setup is restricted to tenant admins');
    }

    const secret = generateTotpSecret();
    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: { mfaSecret: this.encryption.encryptString(secret) },
    });

    return {
      secret,
      otpAuthUrl: buildTotpOtpAuthUrl(user.email, secret, 'IDMatr Tenant Portal'),
      mfaEnabled: false,
    };
  }

  async enableTenantMfa(userId: string, code: string) {
    const user = await this.prisma.tenantUser.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new UnauthorizedException('MFA setup has not been started');
    if (!isPrivilegedTenantRole(user.role)) {
      throw new UnauthorizedException('MFA is restricted to tenant admins');
    }

    await this.assertValidTotp(user.mfaSecret, code);
    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    await this.auditLog.write({
      tenantId: user.tenantId,
      action: 'auth.tenant.mfa_enabled',
      category: 'auth',
      severity: 'info',
      description: `MFA enabled for ${user.email}`,
      metadata: { userId },
    });

    return { success: true, mfaEnabled: true };
  }

  async disableTenantMfa(userId: string, code: string) {
    const user = await this.prisma.tenantUser.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new UnauthorizedException('MFA is not enabled');
    if (!isPrivilegedTenantRole(user.role)) {
      throw new UnauthorizedException('MFA is restricted to tenant admins');
    }

    await this.assertValidTotp(user.mfaSecret, code);
    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    await this.auditLog.write({
      tenantId: user.tenantId,
      action: 'auth.tenant.mfa_disabled',
      category: 'auth',
      severity: 'warning',
      description: `MFA disabled for ${user.email}`,
      metadata: { userId },
    });

    return { success: true, mfaEnabled: false };
  }

  async getTenantMfaStatus(userId: string) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private assertStrongPassword(password: string) {
    if (
      password.length < 12 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      throw new UnauthorizedException(
        'Password must be at least 12 characters and include upper, lower, number, and symbol',
      );
    }
  }

  private async assertValidTotp(encryptedSecret: string | null | undefined, code?: string) {
    if (!encryptedSecret) {
      throw new UnauthorizedException('MFA is not configured');
    }
    if (!code) {
      throw new UnauthorizedException('MFA code is required');
    }

    const secret = this.encryption.decryptString(encryptedSecret);
    if (!verifyTotpCode(secret, code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
  }

  private async ensureNotLocked(lockedUntil: Date | null, message: string) {
    if (lockedUntil && lockedUntil > new Date()) {
      throw new UnauthorizedException(message);
    }
  }

  private async recordOperatorFailure(
    operatorId: string,
    failedAttempts: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const isLocked = failedAttempts + 1 >= this.maxAttempts;
    await this.prisma.operator.update({
      where: { id: operatorId },
      data: {
        failedLoginAttempts: failedAttempts + 1,
        lastFailedLoginAt: new Date(),
        lockedUntil: isLocked ? new Date(Date.now() + this.lockoutMs) : null,
      },
    });

    await this.auditLog.write({
      operatorId,
      action: 'auth.operator.login_failed',
      category: 'auth',
      severity: isLocked ? 'warning' : 'info',
      description: isLocked ? 'Operator account locked after failed logins' : 'Operator login failed',
      ipAddress,
      userAgent,
    });
  }

  private async recordTenantFailure(
    tenantUserId: string,
    failedAttempts: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.tenantUser.update({
      where: { id: tenantUserId },
      data: {
        failedLoginAttempts: failedAttempts + 1,
        lastFailedLoginAt: new Date(),
        lockedUntil: failedAttempts + 1 >= this.maxAttempts
          ? new Date(Date.now() + this.lockoutMs)
          : null,
      },
    });

    await this.auditLog.write({
      tenantId: user.tenantId,
      action: 'auth.tenant.login_failed',
      category: 'auth',
      severity: failedAttempts + 1 >= this.maxAttempts ? 'warning' : 'info',
      description: failedAttempts + 1 >= this.maxAttempts
        ? `Tenant user ${user.email} locked after failed logins`
        : `Tenant login failed for ${user.email}`,
      ipAddress,
      userAgent,
    });
  }
}

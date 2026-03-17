import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService, TenantUser, Operator } from '@app/prisma';
import * as bcrypt from 'bcryptjs';

/**
 * Login Security Service - implements brute-force protection
 * Tracks failed login attempts and locks accounts after threshold
 */
@Injectable()
export class LoginSecurityService {
  private readonly logger = new Logger('LoginSecurity');

  // Configuration
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  constructor(private prisma: PrismaService) {}

  /**
   * Verify operator login with brute-force protection
   */
  async verifyOperatorLogin(email: string, password: string): Promise<Operator> {
    const operator = await this.prisma.operator.findUnique({ where: { email } });

    if (!operator) {
      // Log failed attempt (prevent email enumeration)
      this.logger.warn(`Login attempt for non-existent operator: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (operator.lockedUntil && operator.lockedUntil > new Date()) {
      const timeRemaining = Math.ceil(
        (operator.lockedUntil.getTime() - Date.now()) / 1000
      );
      this.logger.warn(
        `Login attempt on locked account: ${email} ` +
        `(locked for ${timeRemaining}s)`
      );
      throw new UnauthorizedException(
        `Account locked due to too many failed attempts. ` +
        `Try again in ${timeRemaining} seconds.`
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, operator.passwordHash);

    if (!passwordValid) {
      // Increment failed attempts
      const newFailedCount = (operator.failedLoginAttempts || 0) + 1;
      const isLocked = newFailedCount >= this.MAX_ATTEMPTS;
      const lockedUntil = isLocked ? new Date(Date.now() + this.LOCKOUT_DURATION_MS) : null;

      await this.prisma.operator.update({
        where: { id: operator.id },
        data: {
          failedLoginAttempts: newFailedCount,
          lockedUntil,
          lastFailedLoginAt: new Date(),
        },
      });

      this.logger.warn(
        `Failed login attempt for ${email} ` +
        `(${newFailedCount}/${this.MAX_ATTEMPTS})` +
        `${isLocked ? ' — ACCOUNT LOCKED' : ''}`
      );

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.prisma.operator.update({
      where: { id: operator.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    });

    this.logger.log(`Successful login: ${email}`);
    return operator;
  }

  /**
   * Verify tenant user login with brute-force protection
   */
  async verifyTenantUserLogin(email: string, password: string, tenantId: string): Promise<TenantUser> {
    const user = await this.prisma.tenantUser.findFirst({
      where: { email, tenantId, isActive: true },
    });

    if (!user) {
      this.logger.warn(`Login attempt for non-existent tenant user: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const timeRemaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 1000
      );
      this.logger.warn(
        `Login attempt on locked tenant user account: ${email} ` +
        `(locked for ${timeRemaining}s)`
      );
      throw new UnauthorizedException(
        `Account locked. Try again in ${timeRemaining} seconds.`
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      const newFailedCount = (user.failedLoginAttempts || 0) + 1;
      const isLocked = newFailedCount >= this.MAX_ATTEMPTS;
      const lockedUntil = isLocked ? new Date(Date.now() + this.LOCKOUT_DURATION_MS) : null;

      await this.prisma.tenantUser.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedCount,
          lockedUntil,
          lastFailedLoginAt: new Date(),
        },
      });

      this.logger.warn(
        `Failed login attempt for tenant user ${email} in ${tenantId} ` +
        `(${newFailedCount}/${this.MAX_ATTEMPTS})` +
        `${isLocked ? ' — ACCOUNT LOCKED' : ''}`
      );

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    });

    this.logger.log(`Successful login: tenant user ${email} in tenant ${tenantId}`);
    return user;
  }

  /**
   * Manually unlock an account (admin operation)
   */
  async unlockOperator(operatorId: string): Promise<void> {
    await this.prisma.operator.update({
      where: { id: operatorId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    this.logger.log(`Unlocked operator: ${operatorId}`);
  }

  /**
   * Manually unlock a tenant user account (admin operation)
   */
  async unlockTenantUser(userId: string): Promise<void> {
    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    this.logger.log(`Unlocked tenant user: ${userId}`);
  }

  /**
   * Get login security status
   */
  async getSecurityStatus(): Promise<{
    lockedAccounts: number;
    recentFailedAttempts: number;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - this.ATTEMPT_WINDOW_MS);

    const [lockedOperators, lockedUsers, recentFailedOperators, recentFailedUsers] =
      await Promise.all([
        this.prisma.operator.count({
          where: { lockedUntil: { gt: now } },
        }),
        this.prisma.tenantUser.count({
          where: { lockedUntil: { gt: now } },
        }),
        this.prisma.operator.count({
          where: {
            lastFailedLoginAt: { gte: oneHourAgo },
          },
        }),
        this.prisma.tenantUser.count({
          where: {
            lastFailedLoginAt: { gte: oneHourAgo },
          },
        }),
      ]);

    return {
      lockedAccounts: lockedOperators + lockedUsers,
      recentFailedAttempts: recentFailedOperators + recentFailedUsers,
    };
  }
}

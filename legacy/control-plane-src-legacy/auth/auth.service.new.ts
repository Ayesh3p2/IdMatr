import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as crypto from 'crypto';

interface LoginInput {
  email: string;
  password: string;
  tenantId: string;
  totpCode?: string;
}

interface AuthResult {
  access_token: string;
  refresh_token: string;
  user: any;
  routing: {
    requiresMfaSetup: boolean;
    redirectTo: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginInput): Promise<AuthResult> {
    const { email, password, tenantId, totpCode } = input;

    // Validate input
    if (!email || !password || !tenantId) {
      throw new BadRequestException('Email, password, and tenant ID are required');
    }

    // Find user in tenant
    const user = await this.prisma.tenantUser.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId,
      },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Increment failed attempts
      await this.handleFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Check MFA requirements
    const isPrivileged = user.role === 'PLATFORM_ADMIN' || user.role === 'TENANT_ADMIN';
    const requiresMfaSetup = isPrivileged && !user.mfaEnabled;
    const requiresMfaVerification = user.mfaEnabled && !totpCode;

    if (requiresMfaSetup) {
      return {
        access_token: '',
        refresh_token: '',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
        routing: {
          requiresMfaSetup: true,
          redirectTo: '/mfa/setup',
        },
      };
    }

    if (requiresMfaVerification) {
      if (!totpCode) {
        throw new BadRequestException('MFA code is required');
      }

      const isMfaValid = this.verifyTotp(totpCode, user.mfaSecret!);
      if (!isMfaValid) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Generate JWT tokens
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const access_token = await this.jwt.signAsync(payload);
    const refresh_token = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      routing: {
        requiresMfaSetup: false,
        redirectTo: null,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.tenantUser.findFirst({
        where: {
          id: payload.sub,
          tenantId: payload.tenantId,
          status: 'ACTIVE',
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      };

      const access_token = await this.jwt.signAsync(newPayload);
      const refresh_token = await this.jwt.signAsync(newPayload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      });

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
        routing: {
          requiresMfaSetup: false,
          redirectTo: null,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(email: string, password: string, tenantId: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId,
        status: 'ACTIVE',
      },
    });

    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  private async handleFailedLogin(userId: string) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const failedAttempts = user.failedAttempts + 1;
    const maxAttempts = 5;
    const lockDuration = 15 * 60 * 1000; // 15 minutes

    const updateData: any = {
      failedAttempts,
    };

    if (failedAttempts >= maxAttempts) {
      updateData.lockedUntil = new Date(Date.now() + lockDuration);
    }

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: updateData,
    });
  }

  private verifyTotp(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: parseInt(process.env.MFA_WINDOW || '1'),
    });
  }

  // MFA Setup
  async generateMfaSecret(userId: string) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `IDMatr (${user.email})`,
      issuer: process.env.MFA_ISSUER || 'IDMatr',
      length: 32,
    });

    // Store encrypted secret
    const encryptedSecret = this.encrypt(secret.base32);
    
    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
      },
    });

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url,
      backupCodes: this.generateBackupCodes(),
    };
  }

  async enableMfa(userId: string, token: string) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated');
    }

    const decryptedSecret = this.decrypt(user.mfaSecret);
    const isValid = this.verifyTotp(token, decryptedSecret);

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
      },
    });

    return { message: 'MFA enabled successfully' };
  }

  private encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encrypted = textParts.join(':');
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex'));
    }
    return codes;
  }
}

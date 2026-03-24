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

    // 🔒 FIXED: MFA verification logic - always require MFA if enabled
    const isPrivileged = user.role === 'PLATFORM_ADMIN' || user.role === 'TENANT_ADMIN';
    const requiresMfaSetup = isPrivileged && !user.mfaEnabled;
    
    // If MFA is enabled, ALWAYS require verification
    if (user.mfaEnabled && !totpCode) {
      throw new BadRequestException('MFA code is required');
    }

    // If MFA is enabled, verify the code
    if (user.mfaEnabled && totpCode) {
      const isMfaValid = this.verifyTotp(totpCode, user.mfaSecret!);
      if (!isMfaValid) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // If MFA setup is required for privileged users
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

  async validateUser(email: string, password: string, tenantId: string): Promise<any> {
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

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.tenantUser.findUnique({
        where: { id: payload.sub },
        include: { tenant: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      };

      const access_token = await this.jwt.signAsync(newPayload);
      const new_refresh_token = await this.jwt.signAsync(newPayload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      });

      return {
        access_token,
        refresh_token: new_refresh_token,
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

  private async handleFailedLogin(userId: string) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const failedAttempts = user.failedAttempts + 1;
    const lockThreshold = 5;
    
    let lockedUntil = null;
    if (failedAttempts >= lockThreshold) {
      lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        failedAttempts,
        lockedUntil,
      },
    });
  }

  private verifyTotp(token: string, encryptedSecret: string): boolean {
    try {
      const decryptedSecret = this.decrypt(encryptedSecret);
      return speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token,
        window: parseInt(process.env.MFA_WINDOW || '1'),
      });
    } catch (error) {
      return false;
    }
  }

  // MFA Setup
  async generateMfaSecret(userId: string) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
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

  async disableMfa(userId: string, password: string) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    return { message: 'MFA disabled successfully' };
  }

  // 🔒 FIXED: Proper encryption implementation
  private encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv); // FIXED: createCipheriv
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  // 🔒 FIXED: Proper decryption implementation
  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encrypted = textParts.join(':');
    const decipher = crypto.createDecipheriv(algorithm, key, iv); // FIXED: createDecipheriv
    
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

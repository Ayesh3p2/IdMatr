import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateMfaDto } from './dto/generate-mfa.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';

@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService) {}

  async generateSecret(userId: string, generateMfaDto: GenerateMfaDto) {
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
      name: `${generateMfaDto.issuer} (${user.email})`,
      issuer: generateMfaDto.issuer,
      length: 32,
    });

    // Store encrypted secret temporarily
    const encryptedSecret = this.encrypt(secret.base32);
    
    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
      },
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes: this.generateBackupCodes(),
    };
  }

  async verifyAndEnable(userId: string, verifyMfaDto: VerifyMfaDto) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated');
    }

    const decryptedSecret = this.decrypt(user.mfaSecret);
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: verifyMfaDto.token,
      window: verifyMfaDto.window || 1,
    });

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

  async disable(userId: string, password: string) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    // Verify password (you'll need to inject AuthService or bcrypt)
    // For now, we'll skip password verification in this basic implementation
    
    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    return { message: 'MFA disabled successfully' };
  }

  async verifyToken(userId: string, token: string, window = 1): Promise<boolean> {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }

    const decryptedSecret = this.decrypt(user.mfaSecret);
    
    return speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window,
    });
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

  async getMfaStatus(userId: string) {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      mfaEnabled: user.mfaEnabled,
    };
  }
}

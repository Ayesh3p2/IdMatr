import { BadRequestException, Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as speakeasy from 'speakeasy';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/request-user.interface';
import { IntegrationsCryptoService } from '../integrations/integrations.crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cryptoService: IntegrationsCryptoService,
  ) {}

  async status(user: RequestUser) {
    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { id: user.userId },
      select: {
        mfaEnabled: true,
        email: true,
      },
    });

    return tenantUser;
  }

  async setup(user: RequestUser) {
    const secret = speakeasy.generateSecret({
      length: 20,
      issuer: 'IDMatr',
      name: `${user.email} (${user.tenantId})`,
    });

    await this.prisma.tenantUser.update({
      where: { id: user.userId },
      data: {
        mfaSecret: this.cryptoService.encrypt(secret.base32),
        mfaEnabled: false,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      action: 'mfa.setup.started',
      resource: 'tenant_user',
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl: secret.otpauth_url ? await QRCode.toDataURL(secret.otpauth_url) : null,
    };
  }

  async verify(user: RequestUser, code: string) {
    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { id: user.userId },
    });

    if (!tenantUser?.mfaSecret) {
      throw new BadRequestException('Run MFA setup before verification');
    }

    const valid = speakeasy.totp.verify({
      secret: this.cryptoService.decrypt(tenantUser.mfaSecret),
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.prisma.tenantUser.update({
      where: { id: user.userId },
      data: { mfaEnabled: true },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      action: 'mfa.enabled',
      resource: 'tenant_user',
    });

    return { success: true, mfaEnabled: true };
  }

  async disable(user: RequestUser, code: string) {
    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { id: user.userId },
    });

    if (!tenantUser?.mfaSecret) {
      throw new BadRequestException('MFA is not configured');
    }

    const valid = speakeasy.totp.verify({
      secret: this.cryptoService.decrypt(tenantUser.mfaSecret),
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.prisma.tenantUser.update({
      where: { id: user.userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      action: 'mfa.disabled',
      resource: 'tenant_user',
    });

    return { success: true, mfaEnabled: false };
  }
}

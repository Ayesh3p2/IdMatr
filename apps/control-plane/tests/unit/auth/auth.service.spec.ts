import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../../src/audit/audit.service';
import { AuthService } from '../../../src/auth/auth.service';
import { IntegrationsCryptoService } from '../../../src/integrations/integrations.crypto';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let prisma: {
    tenant: { findFirst: jest.Mock };
    tenantUser: { findFirst: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(async () => {
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };
    prisma = {
      tenant: { findFirst: jest.fn() },
      tenantUser: { findFirst: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        IntegrationsCryptoService,
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('requires a valid TOTP code after MFA is enabled', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 12);
    const cryptoService = new IntegrationsCryptoService();

    prisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-1',
      slug: 'tenant-1',
      status: 'ACTIVE',
    });
    prisma.tenantUser.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
      mfaEnabled: true,
      mfaSecret: cryptoService.encrypt('JBSWY3DPEHPK3PXP'),
    });

    await expect(
      service.login({
        tenantSlug: 'tenant-1',
        email: 'admin@example.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow(new UnauthorizedException('TOTP code required'));
  });

  it('returns MFA_SETUP_REQUIRED and setupToken when admin without MFA logs in', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 12);

    prisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-1',
      slug: 'tenant-1',
      status: 'ACTIVE',
    });
    prisma.tenantUser.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
      mfaEnabled: false,
      authVersion: 1,
    });
    jwtService.signAsync.mockResolvedValue('fake-setup-token');

    const result = await service.login({
      tenantSlug: 'tenant-1',
      email: 'admin@example.com',
      password: 'Password123!',
    });

    expect(result).toEqual({
      status: 'MFA_SETUP_REQUIRED',
      message: 'MFA setup is required for admin login',
      setupToken: 'fake-setup-token',
    });
  });

  it('rotates refresh tokens after a successful refresh', async () => {
    const createdAt = new Date('2026-03-24T00:00:00.000Z');
    const refreshTokenHash = await bcrypt.hash('refresh-old-token', 12);

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.TENANT_ADMIN,
      tenantId: 'tenant-1',
      ver: 2,
    });
    jwtService.signAsync.mockResolvedValueOnce('access-new-token').mockResolvedValueOnce('refresh-new-token');
    prisma.tenantUser.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      mfaEnabled: true,
      lastLoginAt: null,
      createdAt,
      authVersion: 2,
      refreshTokenHash,
    });
    prisma.tenantUser.update.mockResolvedValue({
      id: 'user-1',
    });

    const result = await service.refresh('refresh-old-token');

    expect(result.tokens).toEqual({
      accessToken: 'access-new-token',
      refreshToken: 'refresh-new-token',
    });
    expect(prisma.tenantUser.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        refreshTokenHash: expect.any(String),
      },
    });
  });

  it('rejects refresh tokens when the auth version has changed', async () => {
    const refreshTokenHash = await bcrypt.hash('refresh-old-token', 12);

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.TENANT_ADMIN,
      tenantId: 'tenant-1',
      ver: 1,
    });
    prisma.tenantUser.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      mfaEnabled: true,
      lastLoginAt: null,
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      authVersion: 2,
      refreshTokenHash,
    });

    await expect(service.refresh('refresh-old-token')).rejects.toThrow(
      new UnauthorizedException('Invalid refresh token'),
    );
  });
});

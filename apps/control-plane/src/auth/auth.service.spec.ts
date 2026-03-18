import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { AuditLogService } from '../security/audit-log.service';
import { EnvelopeEncryptionService } from '../security/envelope-encryption.service';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let auditLog: any;

  const mockOperator = {
    id: 'op-123',
    email: 'admin@idmatr.io',
    passwordHash: '',
    role: 'SUPER_ADMIN',
    isActive: true,
    mfaEnabled: false,
    mfaSecret: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastFailedLoginAt: null,
    lastLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      operator: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    };

    auditLog = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const encryption = {
      encrypt: jest.fn().mockResolvedValue('encrypted'),
      decrypt: jest.fn().mockResolvedValue('decrypted'),
    };

    service = new AuthService(
      prisma as any,
      jwtService as any,
      auditLog as any,
      encryption as any,
    );
  });

  describe('login', () => {
    it('should throw UnauthorizedException for non-existent operator', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nonexistent@test.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive operator', async () => {
      prisma.operator.findUnique.mockResolvedValue({
        ...mockOperator,
        isActive: false,
      });

      await expect(
        service.login(mockOperator.email, 'password'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.operator.findUnique.mockResolvedValue({
        ...mockOperator,
        passwordHash,
      });

      await expect(
        service.login(mockOperator.email, 'wrong-password'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for locked account', async () => {
      const lockedUntil = new Date(Date.now() + 60 * 60 * 1000);
      prisma.operator.findUnique.mockResolvedValue({
        ...mockOperator,
        lockedUntil,
      });

      await expect(
        service.login(mockOperator.email, 'password'),
      ).rejects.toThrow('Account locked due to repeated failed login attempts');
    });

    it('should successfully login with valid credentials', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.operator.findUnique.mockResolvedValue({
        ...mockOperator,
        passwordHash,
      });
      prisma.operator.update.mockResolvedValue({
        ...mockOperator,
        passwordHash,
      });

      const result = await service.login(mockOperator.email, 'correct-password');

      expect(result.access_token).toBe('mock-jwt-token');
      expect(prisma.operator.update).toHaveBeenCalled();
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.operator.login',
        }),
      );
    });

    it('should require MFA code for privileged role with MFA enabled', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.operator.findUnique.mockResolvedValue({
        ...mockOperator,
        passwordHash,
        role: 'SUPER_ADMIN',
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
      });

      await expect(
        service.login(mockOperator.email, 'correct-password'),
      ).rejects.toThrow('Invalid TOTP code');
    });
  });

  describe('validateOperator', () => {
    it('should return operator for valid JWT payload', async () => {
      const payload = { sub: mockOperator.id, email: mockOperator.email, role: 'SUPER_ADMIN' };
      prisma.operator.findUnique.mockResolvedValue(mockOperator);

      const result = await service.validateOperator(payload);

      expect(result).toEqual(expect.objectContaining({
        id: mockOperator.id,
        email: mockOperator.email,
      }));
    });

    it('should return null for non-existent operator', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);

      const result = await service.validateOperator({ sub: 'non-existent', email: 'test@test.com', role: 'ADMIN' });

      expect(result).toBeNull();
    });
  });

  describe('seedSuperAdmin', () => {
    it('should not create super admin if one exists', async () => {
      prisma.operator.findUnique.mockResolvedValue(mockOperator);

      await service.seedSuperAdmin();

      expect(prisma.operator.create).not.toHaveBeenCalled();
    });

    it('should create super admin if none exists', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);
      prisma.operator.create.mockResolvedValue(mockOperator);

      await service.seedSuperAdmin();

      expect(prisma.operator.create).toHaveBeenCalled();
    });
  });
});

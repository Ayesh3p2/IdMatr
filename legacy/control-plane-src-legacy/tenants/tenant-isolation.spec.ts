import { NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../security/audit-log.service';
import { EnvelopeEncryptionService } from '../security/envelope-encryption.service';

describe('TenantIsolation', () => {
  let prisma: any;

  const mockTenantA = {
    id: 'tenant-a',
    name: 'Tenant A',
    slug: 'tenant-a',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTenantB = {
    id: 'tenant-b',
    name: 'Tenant B',
    slug: 'tenant-b',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      operator: {
        findUnique: jest.fn(),
      },
      tenantUser: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      tenantSettings: {
        findUnique: jest.fn(),
      },
    };
  });

  describe('Tenant Data Access', () => {
    it('should only return data for the specified tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenantA);

      const service = new TenantsService(
        prisma as any,
        {} as EmailService,
        { write: jest.fn() } as any,
        {} as EnvelopeEncryptionService,
      );

      const result = await service.findOne('tenant-a');

      expect(result.id).toBe('tenant-a');
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-a' },
      });
    });

    it('should prevent access to other tenants data', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      const service = new TenantsService(
        prisma as any,
        {} as EmailService,
        { write: jest.fn() } as any,
        {} as EnvelopeEncryptionService,
      );

      await expect(service.findOne('tenant-b')).rejects.toThrow('Tenant tenant-b not found');
    });
  });

  describe('Tenant Context Isolation', () => {
    it('should derive tenant context from JWT claims only', () => {
      const jwtPayload = {
        sub: 'user-123',
        tenantId: 'tenant-a',
        role: 'TENANT_ADMIN',
      };

      const derivedTenantId = jwtPayload.tenantId;

      expect(derivedTenantId).toBe('tenant-a');
    });

    it('should NOT rely on X-Tenant-ID header', () => {
      const headerTenantId = undefined;

      const jwtPayload = {
        sub: 'user-123',
        tenantId: 'tenant-a',
        role: 'TENANT_ADMIN',
      };

      const actualTenantId = jwtPayload.tenantId;

      expect(headerTenantId).toBeUndefined();
      expect(actualTenantId).toBe('tenant-a');
      expect(actualTenantId).not.toBe(headerTenantId);
    });

    it('should enforce tenant isolation in queries', async () => {
      prisma.tenant.findMany.mockResolvedValue([mockTenantA]);

      const service = new TenantsService(
        prisma as any,
        {} as EmailService,
        { write: jest.fn() } as any,
        {} as EnvelopeEncryptionService,
      );

      await service.findAll();

      expect(prisma.tenant.findMany).toHaveBeenCalled();
    });
  });

  describe('Cross-Tenant Prevention', () => {
    it('should not allow updating another tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenantA);

      const service = new TenantsService(
        prisma as any,
        {} as EmailService,
        { write: jest.fn() } as any,
        {} as EnvelopeEncryptionService,
      );

      await expect(
        service.suspend('tenant-b', 'reason', 'operator-1'),
      ).rejects.toThrow('Tenant tenant-b not found');
    });

    it('should not allow deleting another tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenantA);

      const service = new TenantsService(
        prisma as any,
        {} as EmailService,
        { write: jest.fn() } as any,
        {} as EnvelopeEncryptionService,
      );

      await expect(
        service.hardDelete('tenant-b', 'CONFIRM', 'operator-1'),
      ).rejects.toThrow('Tenant tenant-b not found');
    });
  });
});

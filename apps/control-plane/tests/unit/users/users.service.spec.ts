import { ForbiddenException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { UsersService } from '../../../src/users/users.service';

describe('UsersService', () => {
  it('prevents tenant admins from assigning the platform_admin role', async () => {
    const service = new UsersService(
      {
        tenantUser: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        externalIdentity: {
          updateMany: jest.fn(),
        },
      } as never,
      { log: jest.fn() } as never,
    );

    await expect(
      service.create(
        {
          email: 'admin@example.com',
          name: 'Admin',
          password: 'Password123!',
          role: Role.PLATFORM_ADMIN,
        },
        {
          userId: 'tenant-admin-1',
          tenantId: 'tenant-1',
          email: 'owner@example.com',
          name: 'Owner',
          role: Role.TENANT_ADMIN,
          status: UserStatus.ACTIVE,
          mfaEnabled: true,
        },
      ),
    ).rejects.toThrow(new ForbiddenException('Only platform admins can assign the platform_admin role'));
  });
});

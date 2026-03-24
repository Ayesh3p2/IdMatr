import { ForbiddenException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { IvipService } from '../../../src/ivip/ivip.service';

describe('IvipService', () => {
  it('rejects requests for identities not mapped to the current user', async () => {
    const prisma = {
      externalIdentity: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'identity-2',
          tenantId: 'tenant-1',
          integrationId: 'integration-1',
          mappedTenantUserId: 'another-user',
          primaryEmail: 'target@example.com',
        }),
      },
      externalGroup: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'group-1',
          name: 'Admins',
          email: 'admins@example.com',
        }),
      },
      externalGroupMembership: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      identityRequest: {
        create: jest.fn(),
      },
    };

    const service = new IvipService(
      prisma as never,
      { log: jest.fn() } as never,
      {} as never,
    );

    await expect(
      service.create(
        {
          integrationId: 'integration-1',
          externalIdentityId: 'identity-2',
          externalGroupId: 'group-1',
        },
        {
          userId: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
          name: 'User',
          role: Role.USER,
          status: UserStatus.ACTIVE,
          mfaEnabled: false,
        },
      ),
    ).rejects.toThrow(
      new ForbiddenException('Users can only request access for their own mapped identity'),
    );
  });
});

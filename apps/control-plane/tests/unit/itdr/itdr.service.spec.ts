import { Role, UserStatus } from '@prisma/client';
import { ItdrService } from '../../../src/itdr/itdr.service';

describe('ItdrService', () => {
  it('updates identity risk scores from detected signals', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const log = jest.fn().mockResolvedValue(undefined);

    const service = new ItdrService(
      {
        integration: {
          findFirstOrThrow: jest.fn().mockResolvedValue({
            id: 'integration-1',
            tenantId: 'tenant-1',
          }),
        },
        externalIdentity: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'identity-1',
              tenantId: 'tenant-1',
              integrationId: 'integration-1',
              primaryEmail: 'admin@example.com',
              lastLoginAt: null,
              isAdmin: true,
              isDelegatedAdmin: false,
              roleNames: ['Super Admin'],
            },
            {
              id: 'identity-2',
              tenantId: 'tenant-1',
              integrationId: 'integration-1',
              primaryEmail: 'user@example.com',
              lastLoginAt: new Date(),
              isAdmin: false,
              isDelegatedAdmin: false,
              roleNames: [],
            },
          ]),
          update,
        },
        externalGroupMembership: {
          findMany: jest.fn().mockResolvedValue([
            {
              externalIdentityId: 'identity-1',
              role: 'OWNER',
            },
            {
              externalIdentityId: 'identity-1',
              role: 'MEMBER',
            },
            {
              externalIdentityId: 'identity-2',
              role: 'MEMBER',
            },
          ]),
        },
      } as never,
      { log } as never,
    );

    const result = await service.detectGoogleSignals({
      userId: 'admin-1',
      tenantId: 'tenant-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      mfaEnabled: true,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'identity-1' },
      data: { riskScore: 45 },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'identity-2' },
      data: { riskScore: 0 },
    });
    expect(result).toMatchObject({
      inactiveUsersDetected: 1,
      highPrivilegeUsersDetected: 1,
      multipleAccessUsersDetected: 1,
    });
    expect(log).toHaveBeenCalled();
  });
});

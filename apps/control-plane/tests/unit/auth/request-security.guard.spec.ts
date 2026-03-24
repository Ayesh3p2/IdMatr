import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@prisma/client';
import { AuthenticatedUserService } from '../../../src/auth/authenticated-user.service';
import { RequestSecurityGuard } from '../../../src/auth/request-security.guard';

describe('RequestSecurityGuard', () => {
  it('blocks admin access until MFA is enabled', async () => {
    const jwtService = { verifyAsync: jest.fn() };
    const authenticatedUserService = { validateAccessPayload: jest.fn() };
    const guard = new RequestSecurityGuard(
      jwtService as unknown as JwtService,
      new Reflector(),
      authenticatedUserService as unknown as AuthenticatedUserService,
    );

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'admin-1',
      tenantId: 'tenant-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.TENANT_ADMIN,
    });
    authenticatedUserService.validateAccessPayload.mockResolvedValue({
      userId: 'admin-1',
      tenantId: 'tenant-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
    });

    const request = {
      headers: { authorization: 'Bearer valid-token' },
      body: {},
      query: {},
      params: {},
    };

    const context = {
      getType: () => 'http',
      getHandler: () => (() => undefined) as unknown as object,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('MFA setup is required for admin access'),
    );
  });
});

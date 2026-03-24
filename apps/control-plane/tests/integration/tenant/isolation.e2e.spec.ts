import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@prisma/client';
import { AuthenticatedUserService } from '../../../src/auth/authenticated-user.service';
import { RequestSecurityGuard } from '../../../src/auth/request-security.guard';

describe('Tenant isolation guard', () => {
  let jwtService: { verifyAsync: jest.Mock };
  let authenticatedUserService: { validateAccessPayload: jest.Mock };
  let guard: RequestSecurityGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    authenticatedUserService = { validateAccessPayload: jest.fn() };
    guard = new RequestSecurityGuard(
      jwtService as unknown as JwtService,
      new Reflector(),
      authenticatedUserService as unknown as AuthenticatedUserService,
    );
  });

  it('rejects tenant overrides for non-platform users', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-a',
      email: 'user@example.com',
      name: 'User',
      role: Role.USER,
    });
    authenticatedUserService.validateAccessPayload.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-a',
      email: 'user@example.com',
      name: 'User',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
    });

    const request = {
      headers: { authorization: 'Bearer valid-token' },
      query: { tenantId: 'tenant-b' },
      body: {},
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
      new ForbiddenException('tenantId must match the authenticated tenant context'),
    );
  });
});

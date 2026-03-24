import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ControlPlaneRolesGuard } from './roles.guard';

describe('ControlPlaneRolesGuard', () => {
  let guard: ControlPlaneRolesGuard;
  let reflector: any;

  const createMockContext = (user: { role?: string } | undefined, requiredRoles?: string[]): ExecutionContext => {
    const mockRequest = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    guard = new ControlPlaneRolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ role: 'USER' });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when user has required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPER_ADMIN', 'ADMIN']);
    const context = createMockContext({ role: 'SUPER_ADMIN' });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPER_ADMIN']);
    const context = createMockContext({ role: 'VIEWER' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is undefined', () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPER_ADMIN']);
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should normalize roles before checking', () => {
    reflector.getAllAndOverride.mockReturnValue(['super_admin']);
    const context = createMockContext({ role: 'SUPER_ADMIN' });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access for ADMIN when READONLY_ADMIN is required (role normalization)', () => {
    reflector.getAllAndOverride.mockReturnValue(['READONLY_ADMIN']);
    const context = createMockContext({ role: 'ADMIN' });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});

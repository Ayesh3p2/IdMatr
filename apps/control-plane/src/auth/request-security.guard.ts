import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RequestUser } from '../common/request-user.interface';
import { ALLOW_WITHOUT_MFA_KEY } from './allow-without-mfa.decorator';
import { AuthenticatedUserService } from './authenticated-user.service';
import { extractAccessToken } from './auth-token.util';
import { JwtPayload } from './jwt-payload.interface';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class RequestSecurityGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly authenticatedUserService: AuthenticatedUserService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const allowWithoutMfa = this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allowWithoutMfa) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      params?: Record<string, unknown>;
      user?: RequestUser;
      tenantId?: string;
    }>();

    const token = extractAccessToken(request);
    if (!token) {
      return true;
    }

    this.assertTenantHeaderOverride(request.headers);
    const requestUser = request.user ?? (await this.resolveUserFromToken(token));
    request.user = requestUser;
    this.enforceTenantContext(request, requestUser);
    this.enforceAdminMfa(context, requestUser);

    return true;
  }

  private async resolveUserFromToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET ?? 'dev-secret',
      });

      return await this.authenticatedUserService.validateAccessPayload(payload);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid access token');
    }
  }

  private enforceTenantContext(
    request: {
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      params?: Record<string, unknown>;
      tenantId?: string;
    },
    user: RequestUser,
  ) {
    request.tenantId = user.tenantId;

    if (user.role === Role.PLATFORM_ADMIN) {
      return;
    }

    this.assertTenantOverride(request.body, user.tenantId);
    this.assertTenantOverride(request.query, user.tenantId);
    this.assertTenantOverride(request.params, user.tenantId);
  }

  private enforceAdminMfa(context: ExecutionContext, user: RequestUser) {
    const allowWithoutMfa = this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const isAdmin = user.role === Role.PLATFORM_ADMIN || user.role === Role.TENANT_ADMIN;
    if (allowWithoutMfa || !isAdmin || user.mfaEnabled) {
      return;
    }

    throw new ForbiddenException('MFA setup is required for admin access');
  }

  private assertTenantOverride(source: Record<string, unknown> | undefined, tenantId: string) {
    if (!source || typeof source.tenantId !== 'string') {
      return;
    }

    if (source.tenantId !== tenantId) {
      throw new ForbiddenException('tenantId must match the authenticated tenant context');
    }
  }

  private assertTenantHeaderOverride(headers: Record<string, string | string[] | undefined> | undefined) {
    if (!headers) {
      return;
    }

    if (headers['x-tenant-id'] || headers['tenant-id'] || headers['tenantid']) {
      throw new ForbiddenException('tenantId must not be supplied in request headers');
    }
  }
}

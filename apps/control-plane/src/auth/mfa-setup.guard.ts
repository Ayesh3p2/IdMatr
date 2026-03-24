import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RequestUser } from '../common/request-user.interface';
import { extractAccessToken } from './auth-token.util';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

interface MfaSetupTokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  type: 'mfa_setup';
}

@Injectable()
export class MfaSetupGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractAccessToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Try to decode as mfa_setup_token
      const payload = await this.jwtService.verifyAsync<MfaSetupTokenPayload>(token, {
        secret: process.env.JWT_SECRET ?? 'dev-secret',
      });

      if (payload.type === 'mfa_setup') {
        // Validate mfa_setup_token
        const user = await this.prisma.tenantUser.findUnique({
          where: { id: payload.sub },
        });

        if (!user || user.tenantId !== payload.tenantId || user.status === UserStatus.DISABLED) {
          throw new UnauthorizedException('Invalid mfa_setup_token');
        }

        // Create RequestUser from mfa_setup_token
        request.user = {
          userId: user.id,
          tenantId: user.tenantId,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          mfaEnabled: user.mfaEnabled,
        } as RequestUser;

        return true;
      }

      // If not mfa_setup_token, it's a regular JWT - validate as normal user
      const regularPayload = payload as any;
      const user = await this.prisma.tenantUser.findUnique({
        where: { id: regularPayload.sub },
      });

      if (!user || user.tenantId !== regularPayload.tenantId || user.status === UserStatus.DISABLED) {
        throw new UnauthorizedException('Invalid token');
      }

      if (user.authVersion !== regularPayload.ver) {
        throw new UnauthorizedException('Token version mismatch');
      }

      request.user = {
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        mfaEnabled: user.mfaEnabled,
      } as RequestUser;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}

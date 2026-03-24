import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { RequestUser } from '../common/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class AuthenticatedUserService {
  constructor(private readonly prisma: PrismaService) {}

  async validateAccessPayload(payload: JwtPayload): Promise<RequestUser> {
    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        status: true,
        mfaEnabled: true,
        authVersion: true,
      },
    });

    if (!tenantUser || tenantUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is inactive');
    }

    if (tenantUser.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Token tenant does not match user tenant');
    }

    if (tenantUser.authVersion !== payload.ver) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    return {
      userId: tenantUser.id,
      email: tenantUser.email,
      name: tenantUser.name,
      role: tenantUser.role,
      tenantId: tenantUser.tenantId,
      status: tenantUser.status,
      mfaEnabled: tenantUser.mfaEnabled,
    };
  }
}

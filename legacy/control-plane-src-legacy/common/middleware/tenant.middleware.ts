import { Injectable, NestMiddleware, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface TenantRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
  tenantId?: string;
  userId?: string;
  userRole?: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const payload = await this.jwt.verifyAsync(token);
      
      // 🔒 FIXED: Validate required JWT fields
      if (!payload.sub || !payload.tenantId || !payload.email || !payload.role) {
        throw new UnauthorizedException('Invalid token structure');
      }
      
      // 🔒 FIXED: Validate user exists and is active
      const user = await this.prisma.tenantUser.findFirst({
        where: {
          id: payload.sub,
          tenantId: payload.tenantId,
          status: 'ACTIVE',
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found or inactive');
      }

      if (!user.tenant || user.tenant.status !== 'ACTIVE') {
        throw new UnauthorizedException('Tenant is not active');
      }

      // 🔒 FIXED: Validate tenant context consistency
      const requestTenantId = req.params.tenantId || req.query.tenantId || req.body.tenantId;
      if (requestTenantId && requestTenantId !== user.tenantId) {
        throw new UnauthorizedException('Tenant context mismatch');
      }

      // 🔒 FIXED: Set user context with validation
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      };
      
      req.tenantId = user.tenantId;
      req.userId = user.id;
      req.userRole = user.role;

      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // If token is invalid, just continue without user context
      next();
    }
  }
}

import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface TenantRequest extends Request {
  tenantId?: string;
  userId?: string;
  userRole?: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      // Extract JWT from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      
      // Verify JWT and extract payload
      const payload = this.jwtService.verify(token);
      
      // Validate required fields
      if (!payload.tenantId || !payload.sub || !payload.role) {
        throw new UnauthorizedException('Invalid JWT payload structure');
      }

      // Verify tenant exists and is active
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: { id: true, status: true }
      });

      if (!tenant || tenant.status !== 'ACTIVE') {
        throw new UnauthorizedException('Tenant not found or inactive');
      }

      // Verify user belongs to tenant and is active
      const user = await this.prisma.tenantUser.findUnique({
        where: { 
          id: payload.sub,
          tenantId: payload.tenantId 
        },
        select: { id: true, isActive: true }
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Inject tenant context into request
      req.tenantId = payload.tenantId;
      req.userId = payload.sub;
      req.userRole = payload.role;

      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid authentication token');
    }
  }
}

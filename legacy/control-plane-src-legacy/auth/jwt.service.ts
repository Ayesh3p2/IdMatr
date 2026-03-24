import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtService {
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  constructor(
    private readonly jwtService: NestJwtService,
    private readonly prisma: PrismaService,
  ) {}

  async generateTokens(payload: {
    userId: string;
    tenantId: string;
    role: string;
    email: string;
  }) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'idmatr-control-plane',
      audience: 'idmatr-client',
    });

    const refreshToken = this.jwtService.sign(
      { userId: payload.userId, type: 'refresh' },
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'idmatr-control-plane',
        audience: 'idmatr-client',
      }
    );

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.userId,
        tenantId: payload.tenantId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken);
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists and is valid
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new Error('Invalid or expired refresh token');
      }

      // Get user details
      const user = await this.prisma.tenantUser.findUnique({
        where: { id: payload.userId },
        include: { tenant: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new Error('User not found or inactive');
      }

      // Revoke old refresh token
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });

      // Generate new tokens
      return this.generateTokens({
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
      });
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async revokeRefreshToken(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  verifyAccessToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  // Clean up expired tokens (should be run periodically)
  async cleanupExpiredTokens() {
    await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}

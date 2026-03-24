import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IgaService {
  private readonly logger = new Logger(IgaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listIdentities(
    tenantId: string,
    query: any,
    currentUser: { id: string; role: string }
  ) {
    const {
      search,
      role,
      department,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '20'
    } = query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (department) {
      where.department = { contains: department, mode: 'insensitive' };
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    const [identities, total] = await Promise.all([
      this.prisma.tenantUser.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          department: true,
          jobTitle: true,
          phone: true,
          status: true,
          mfaEnabled: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          failedLoginAttempts: true,
          lockedUntil: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take,
      }),
      this.prisma.tenantUser.count({ where })
    ]);

    return {
      identities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  async getIdentity(tenantId: string, id: string) {
    const identity = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        jobTitle: true,
        phone: true,
        status: true,
        mfaEnabled: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        forcePasswordChange: true,
        notes: true,
      }
    });

    if (!identity) {
      throw new NotFoundException('Identity not found');
    }

    return identity;
  }

  async getAccessReview(tenantId: string, periodDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const [totalUsers, activeUsers, mfaEnabledUsers, privilegedUsers] = await Promise.all([
      this.prisma.tenantUser.count({ where: { tenantId } }),
      this.prisma.tenantUser.count({ 
        where: { 
          tenantId,
          lastLogin: { gte: cutoffDate }
        } 
      }),
      this.prisma.tenantUser.count({ 
        where: { 
          tenantId,
          mfaEnabled: true 
        } 
      }),
      this.prisma.tenantUser.count({ 
        where: { 
          tenantId,
          role: { in: ['tenant_admin', 'analyst'] }
        } 
      })
    ]);

    const recentLogins = await this.prisma.tenantUser.findMany({
      where: {
        tenantId,
        lastLogin: { gte: cutoffDate }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLogin: true,
        failedLoginAttempts: true
      },
      orderBy: { lastLogin: 'desc' },
      take: 50
    });

    return {
      summary: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        mfaEnabledUsers,
        mfaDisabledUsers: totalUsers - mfaEnabledUsers,
        privilegedUsers,
        standardUsers: totalUsers - privilegedUsers,
        complianceRate: Math.round((mfaEnabledUsers / totalUsers) * 100)
      },
      recentActivity: recentLogins,
      period: `${periodDays} days`
    };
  }

  async revokeAccess(tenantId: string, userId: string, reviewer: { id: string; email: string }) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id: userId, tenantId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'tenant_admin') {
      throw new BadRequestException('Cannot revoke tenant admin access');
    }

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        status: 'INACTIVE',
        updatedAt: new Date(),
        notes: `Access revoked by ${reviewer.email} on ${new Date().toISOString()}`
      }
    });

    this.logger.log(`Access revoked for user ${userId} by reviewer ${reviewer.id}`);

    return { message: 'Access revoked successfully' };
  }

  async getEntitlementsSummary(tenantId: string) {
    const entitlements = await this.prisma.tenantUser.groupBy({
      by: ['role', 'department'],
      where: { tenantId, status: 'ACTIVE' },
      _count: true
    });

    return {
      totalActiveUsers: entitlements.reduce((sum, e) => sum + e._count, 0),
      byRole: entitlements.map(e => ({
        role: e.role,
        count: e._count,
        percentage: 0 // Will be calculated
      })),
      byDepartment: entitlements
        .filter(e => e.department)
        .map(e => ({
          department: e.department,
          count: e._count,
          percentage: 0 // Will be calculated
        }))
    };
  }

  async getOrphanedAccounts(tenantId: string) {
    // Find users who haven't logged in for 6+ months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const orphaned = await this.prisma.tenantUser.findMany({
      where: {
        tenantId,
        OR: [
          { lastLogin: null },
          { lastLogin: { lt: sixMonthsAgo } }
        ],
        status: 'ACTIVE'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        lastLogin: true,
        createdAt: true
      }
    });

    return {
      orphanedAccounts: orphaned,
      count: orphaned.length,
      reviewDate: new Date()
    };
  }

  async getInactiveUsers(tenantId: string, days: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const inactive = await this.prisma.tenantUser.findMany({
      where: {
        tenantId,
        lastLogin: { lt: cutoffDate },
        status: 'ACTIVE'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        lastLogin: true
      }
    });

    return {
      inactiveUsers: inactive,
      count: inactive.length,
      period: `${days} days`,
      generatedAt: new Date()
    };
  }
}

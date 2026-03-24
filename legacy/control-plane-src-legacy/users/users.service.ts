import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { email, name, password, role, tenantId } = createUserDto;

    // Check if tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check if user already exists in tenant
    const existingUser = await this.prisma.tenantUser.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId,
      },
    });
    if (existingUser) {
      throw new ConflictException('User already exists in this tenant');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.tenantUser.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        role,
        tenantId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return user;
  }

  async findAll(tenantId: string, page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.tenantUser.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          failedAttempts: true,
          lockedUntil: true,
          mfaEnabled: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.tenantUser.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        failedAttempts: true,
        lockedUntil: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, tenantId: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, ...otherData } = updateUserDto;

    const updateData: any = { ...otherData };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const updatedUser = await this.prisma.tenantUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        failedAttempts: true,
        lockedUntil: true,
        mfaEnabled: true,
      },
    });

    return updatedUser;
  }

  async remove(id: string, tenantId: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Don't allow deletion of the last admin
    if (user.role === 'TENANT_ADMIN') {
      const adminCount = await this.prisma.tenantUser.count({
        where: {
          tenantId,
          role: 'TENANT_ADMIN',
          status: 'ACTIVE',
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last tenant admin');
      }
    }

    await this.prisma.tenantUser.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async activate(id: string, tenantId: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.tenantUser.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    return { message: 'User activated successfully' };
  }

  async deactivate(id: string, tenantId: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Don't allow deactivation of the last admin
    if (user.role === 'TENANT_ADMIN') {
      const adminCount = await this.prisma.tenantUser.count({
        where: {
          tenantId,
          role: 'TENANT_ADMIN',
          status: 'ACTIVE',
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot deactivate the last tenant admin');
      }
    }

    await this.prisma.tenantUser.update({
      where: { id },
      data: {
        status: 'INACTIVE',
      },
    });

    return { message: 'User deactivated successfully' };
  }

  async resetPassword(id: string, tenantId: string, newPassword: string) {
    const user = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.tenantUser.update({
      where: { id },
      data: {
        passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async getUserStats(tenantId: string) {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      suspendedUsers,
      usersWithMfa,
      recentLogins,
    ] = await Promise.all([
      this.prisma.tenantUser.count({ where: { tenantId } }),
      this.prisma.tenantUser.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.tenantUser.count({ where: { tenantId, status: 'INACTIVE' } }),
      this.prisma.tenantUser.count({ where: { tenantId, status: 'SUSPENDED' } }),
      this.prisma.tenantUser.count({ where: { tenantId, mfaEnabled: true } }),
      this.prisma.tenantUser.count({
        where: {
          tenantId,
          lastLoginAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      suspended: suspendedUsers,
      withMfa: usersWithMfa,
      recentLogins,
    };
  }
}

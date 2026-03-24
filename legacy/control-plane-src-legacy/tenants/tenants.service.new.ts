import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    const { name, domain, settings } = createTenantDto;

    // Check if domain already exists
    if (domain) {
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { domain },
      });
      if (existingTenant) {
        throw new BadRequestException('Domain already exists');
      }
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name,
        domain,
        settings: settings || {},
      },
    });

    return tenant;
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            invites: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        invites: {
          where: { status: 'PENDING' },
          select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            users: true,
            invites: true,
            events: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    const { domain, ...otherData } = updateTenantDto;

    // Check if domain already exists (if updating domain)
    if (domain) {
      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          domain,
          id: { not: id },
        },
      });
      if (existingTenant) {
        throw new BadRequestException('Domain already exists');
      }
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...otherData,
        ...(domain && { domain }),
      },
    });

    return tenant;
  }

  async remove(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            invites: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant._count.users > 0 || tenant._count.invites > 0) {
      throw new BadRequestException(
        'Cannot delete tenant with existing users or invites',
      );
    }

    await this.prisma.tenant.delete({
      where: { id },
    });

    return { message: 'Tenant deleted successfully' };
  }

  async getTenantStats(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            invites: true,
            events: true,
            requests: true,
            integrations: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Get active users count
    const activeUsers = await this.prisma.tenantUser.count({
      where: {
        tenantId: id,
        status: 'ACTIVE',
      },
    });

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEvents = await this.prisma.auditEvent.count({
      where: {
        tenantId: id,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    return {
      totalUsers: tenant._count.users,
      activeUsers,
      pendingInvites: tenant._count.invites,
      totalEvents: tenant._count.events,
      recentEvents,
      requests: tenant._count.requests,
      integrations: tenant._count.integrations,
    };
  }
}

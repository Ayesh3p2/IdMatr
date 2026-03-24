import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Role, TenantStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedBootstrapTenant();
  }

  async bootstrap(dto: CreateTenantDto) {
    const userCount = await this.prisma.tenantUser.count();
    if (userCount > 0) {
      throw new ConflictException('Bootstrap is only available before the first user is created');
    }

    if (!dto.adminEmail || !dto.adminPassword || !dto.adminName) {
      throw new BadRequestException('Bootstrap requires adminName, adminEmail, and adminPassword');
    }

    return this.createTenant(dto, undefined, Role.PLATFORM_ADMIN);
  }

  async create(dto: CreateTenantDto, actor: RequestUser) {
    if (actor.role !== Role.PLATFORM_ADMIN) {
      throw new BadRequestException('Only platform admins can create tenants');
    }

    return this.createTenant(dto, actor.userId, Role.TENANT_ADMIN);
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            invites: true,
            requests: true,
            reviews: true,
          },
        },
      },
    });
  }

  async getCurrent(user: RequestUser) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            integrations: true,
            requests: true,
            reviews: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  private async createTenant(
    dto: CreateTenantDto,
    actorUserId?: string,
    initialAdminRole: Role = Role.TENANT_ADMIN,
  ) {
    const slug = (dto.slug ?? this.slugify(dto.name)).toLowerCase();

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant slug already exists');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        primaryDomain: dto.primaryDomain?.toLowerCase(),
        status: TenantStatus.ACTIVE,
      },
    });

    if (dto.adminEmail && dto.adminPassword && dto.adminName) {
      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

      await this.prisma.tenantUser.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail.toLowerCase(),
          name: dto.adminName,
          passwordHash,
          role: initialAdminRole,
        },
      });
    }

    await this.auditService.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'tenant.created',
      resource: 'tenant',
      metadata: {
        tenantId: tenant.id,
        slug: tenant.slug,
      },
    });

    return tenant;
  }

  private async seedBootstrapTenant() {
    try {
      const userCount = await this.prisma.tenantUser.count();
      if (userCount > 0) {
        return;
      }

      const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
      const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
      const adminName = process.env.BOOTSTRAP_ADMIN_NAME ?? 'Platform Admin';
      const tenantName = process.env.BOOTSTRAP_TENANT_NAME ?? 'IDMatr';
      const tenantSlug = process.env.BOOTSTRAP_TENANT_SLUG ?? 'idmatr';

      if (!adminEmail || !adminPassword) {
        return;
      }

      await this.createTenant(
        {
          name: tenantName,
          slug: tenantSlug,
          primaryDomain: process.env.BOOTSTRAP_TENANT_DOMAIN,
          adminEmail,
          adminPassword,
          adminName,
        },
        undefined,
        Role.PLATFORM_ADMIN,
      );
    } catch (error) {
      this.logger.warn('Bootstrap seed skipped because the database is not reachable yet.');
    }
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

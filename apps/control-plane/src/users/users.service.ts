import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, actor: RequestUser) {
    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    this.assertAdminActor(actor);
    this.assertAssignableRole(actor, dto.role ?? Role.USER);

    const existingUser = await this.prisma.tenantUser.findFirst({
      where: { tenantId, email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User already exists in this tenant');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.tenantUser.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        role: dto.role ?? Role.USER,
      },
    });

    await this.prisma.externalIdentity.updateMany({
      where: {
        tenantId,
        primaryEmail: user.email,
      },
      data: {
        mappedTenantUserId: user.id,
      },
    });

    await this.auditService.log({
      tenantId,
      actorUserId: actor.userId,
      action: 'user.created',
      resource: 'tenant_user',
      metadata: { userId: user.id, email: user.email, role: user.role },
    });

    return this.toPublicUser(user);
  }

  async findAll(actor: RequestUser, tenantId?: string) {
    this.assertAdminActor(actor);
    const scopedTenantId = this.resolveTenantId(actor, tenantId);

    const users = await this.prisma.tenantUser.findMany({
      where: { tenantId: scopedTenantId },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((user) => this.toPublicUser(user));
  }

  async findOne(id: string, actor: RequestUser, tenantId?: string) {
    this.assertAdminActor(actor);
    const scopedTenantId = this.resolveTenantId(actor, tenantId);
    const user = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId: scopedTenantId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toPublicUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: RequestUser, tenantId?: string) {
    this.assertAdminActor(actor);
    const scopedTenantId = this.resolveTenantId(actor, tenantId);
    const existingUser = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId: scopedTenantId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    this.assertManageableTarget(actor, existingUser.role);

    const nextRole = dto.role ?? existingUser.role;
    const nextStatus = dto.status ?? existingUser.status;
    this.assertAssignableRole(actor, nextRole);
    await this.assertAdminSafety(scopedTenantId, existingUser, nextRole, nextStatus);

    const updateData: Prisma.TenantUserUpdateInput = {};
    const metadata: Record<string, unknown> = { userId: id };
    let invalidateSessions = false;

    if (dto.email) {
      updateData.email = dto.email.toLowerCase();
      metadata.email = updateData.email;
    }

    if (dto.name) {
      updateData.name = dto.name;
      metadata.name = dto.name;
    }

    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
      invalidateSessions = true;
      metadata.passwordChanged = true;
    }

    if (dto.role) {
      updateData.role = dto.role;
      invalidateSessions = true;
      metadata.role = dto.role;
    }

    if (dto.status) {
      updateData.status = dto.status;
      invalidateSessions = true;
      metadata.status = dto.status;
    }

    if (invalidateSessions) {
      updateData.authVersion = { increment: 1 };
      updateData.refreshTokenHash = null;
    }

    const user = await this.prisma.tenantUser.update({
      where: { id },
      data: updateData,
    });

    await this.prisma.externalIdentity.updateMany({
      where: {
        tenantId: scopedTenantId,
        primaryEmail: user.email,
      },
      data: {
        mappedTenantUserId: user.id,
      },
    });

    await this.auditService.log({
      tenantId: scopedTenantId,
      actorUserId: actor.userId,
      action: 'user.updated',
      resource: 'tenant_user',
      metadata,
    });

    return this.toPublicUser(user);
  }

  async remove(id: string, actor: RequestUser, tenantId?: string) {
    this.assertAdminActor(actor);
    const scopedTenantId = this.resolveTenantId(actor, tenantId);
    const existingUser = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId: scopedTenantId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    this.assertManageableTarget(actor, existingUser.role);
    await this.assertAdminSafety(scopedTenantId, existingUser, Role.USER, UserStatus.DISABLED);

    await this.prisma.tenantUser.delete({ where: { id } });

    await this.prisma.externalIdentity.updateMany({
      where: {
        tenantId: scopedTenantId,
        mappedTenantUserId: id,
      },
      data: {
        mappedTenantUserId: null,
      },
    });

    await this.auditService.log({
      tenantId: scopedTenantId,
      actorUserId: actor.userId,
      action: 'user.deleted',
      resource: 'tenant_user',
      metadata: { userId: id, email: existingUser.email },
    });

    return { success: true };
  }

  private resolveTenantId(actor: RequestUser, requestedTenantId?: string) {
    if (actor.role === Role.PLATFORM_ADMIN && requestedTenantId) {
      return requestedTenantId;
    }

    return actor.tenantId;
  }

  private assertAdminActor(actor: RequestUser) {
    if (actor.role !== Role.PLATFORM_ADMIN && actor.role !== Role.TENANT_ADMIN) {
      throw new ForbiddenException('Admin role is required for this operation');
    }
  }

  private assertAssignableRole(actor: RequestUser, role: Role) {
    if (actor.role !== Role.PLATFORM_ADMIN && role === Role.PLATFORM_ADMIN) {
      throw new ForbiddenException('Only platform admins can assign the platform_admin role');
    }
  }

  private assertManageableTarget(actor: RequestUser, targetRole: Role) {
    if (actor.role !== Role.PLATFORM_ADMIN && targetRole === Role.PLATFORM_ADMIN) {
      throw new ForbiddenException('Only platform admins can manage platform admins');
    }
  }

  private async assertAdminSafety(
    tenantId: string,
    existingUser: { id: string; role: Role; status: UserStatus },
    nextRole: Role,
    nextStatus: UserStatus,
  ) {
    const currentlyPrivileged =
      existingUser.role === Role.PLATFORM_ADMIN || existingUser.role === Role.TENANT_ADMIN;
    const remainsPrivileged = nextRole === Role.PLATFORM_ADMIN || nextRole === Role.TENANT_ADMIN;
    const remainsActive = nextStatus === UserStatus.ACTIVE;

    if (!currentlyPrivileged || (remainsPrivileged && remainsActive)) {
      return;
    }

    const remainingAdminCount = await this.prisma.tenantUser.count({
      where: {
        tenantId,
        id: { not: existingUser.id },
        status: UserStatus.ACTIVE,
        role: { in: [Role.PLATFORM_ADMIN, Role.TENANT_ADMIN] },
      },
    });

    if (remainingAdminCount === 0) {
      throw new BadRequestException('Cannot remove or disable the last active admin in the tenant');
    }
  }

  private toPublicUser(user: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: Role;
    status: UserStatus;
    mfaEnabled: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

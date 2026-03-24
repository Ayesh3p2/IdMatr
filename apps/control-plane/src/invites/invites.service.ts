import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InviteStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateInviteDto, actor: RequestUser) {
    this.assertAdminActor(actor);
    this.assertAssignableRole(actor, dto.role ?? Role.USER);
    const tenantId = actor.role === Role.PLATFORM_ADMIN && dto.tenantId ? dto.tenantId : actor.tenantId;
    const token = randomBytes(24).toString('hex');

    const invite = await this.prisma.invite.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        role: dto.role ?? Role.USER,
        token,
        invitedBy: actor.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.auditService.log({
      tenantId,
      actorUserId: actor.userId,
      action: 'invite.created',
      resource: 'invite',
      metadata: {
        inviteId: invite.id,
        email: invite.email,
        role: invite.role,
      },
    });

    return {
      ...invite,
      acceptUrl: `${process.env.PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/auth/invites/${invite.token}`,
    };
  }

  async list(actor: RequestUser, tenantId?: string) {
    this.assertAdminActor(actor);
    const scopedTenantId = actor.role === Role.PLATFORM_ADMIN && tenantId ? tenantId : actor.tenantId;

    return this.prisma.invite.findMany({
      where: { tenantId: scopedTenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string, actor: RequestUser) {
    this.assertAdminActor(actor);
    const invite = await this.prisma.invite.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Only pending invites can be revoked');
    }

    const updatedInvite = await this.prisma.invite.update({
      where: { id },
      data: { status: InviteStatus.REVOKED },
    });

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'invite.revoked',
      resource: 'invite',
      metadata: { inviteId: id },
    });

    return updatedInvite;
  }

  private assertAdminActor(actor: RequestUser) {
    if (actor.role !== Role.PLATFORM_ADMIN && actor.role !== Role.TENANT_ADMIN) {
      throw new ForbiddenException('Admin role is required for this operation');
    }
  }

  private assertAssignableRole(actor: RequestUser, role: Role) {
    if (actor.role !== Role.PLATFORM_ADMIN && role === Role.PLATFORM_ADMIN) {
      throw new ForbiddenException('Only platform admins can invite platform admins');
    }
  }
}

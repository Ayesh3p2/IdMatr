import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createInviteDto: CreateInviteDto) {
    const { email, role, tenantId, expiresAt } = createInviteDto;

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
      throw new BadRequestException('User already exists in this tenant');
    }

    // Check if there's already a pending invite
    const existingInvite = await this.prisma.invite.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId,
        status: 'PENDING',
      },
    });
    if (existingInvite) {
      throw new BadRequestException('Pending invite already exists');
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString('hex');

    // Set default expiration (7 days from now)
    const defaultExpiresAt = new Date();
    defaultExpiresAt.setDate(defaultExpiresAt.getDate() + 7);

    const invite = await this.prisma.invite.create({
      data: {
        email: email.toLowerCase(),
        role,
        tenantId,
        token,
        expiresAt: expiresAt || defaultExpiresAt,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    });

    return invite;
  }

  async findAll(tenantId: string) {
    return this.prisma.invite.findMany({
      where: { tenantId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    return invite;
  }

  async findByToken(token: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite token');
    }

    if (invite.status !== 'PENDING') {
      throw new BadRequestException('Invite is no longer valid');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite has expired');
    }

    return invite;
  }

  async accept(token: string, acceptInviteDto: AcceptInviteDto) {
    const { name, password } = acceptInviteDto;

    const invite = await this.findByToken(token);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.tenantUser.create({
      data: {
        email: invite.email,
        name,
        passwordHash,
        role: invite.role,
        tenantId: invite.tenantId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    // Update invite status
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedBy: user.id,
        acceptedAt: new Date(),
      },
    });

    return {
      message: 'Invite accepted successfully',
      user,
    };
  }

  async revoke(id: string) {
    const invite = await this.findOne(id);

    if (invite.status !== 'PENDING') {
      throw new BadRequestException('Only pending invites can be revoked');
    }

    await this.prisma.invite.update({
      where: { id },
      data: {
        status: 'REVOKED',
      },
    });

    return { message: 'Invite revoked successfully' };
  }

  async remove(id: string) {
    const invite = await this.findOne(id);

    // Only allow deletion of expired or revoked invites
    if (invite.status === 'PENDING') {
      throw new BadRequestException('Cannot delete pending invite. Revoke it first.');
    }

    await this.prisma.invite.delete({
      where: { id },
    });

    return { message: 'Invite deleted successfully' };
  }

  async resend(id: string) {
    const invite = await this.findOne(id);

    if (invite.status !== 'PENDING') {
      throw new BadRequestException('Only pending invites can be resent');
    }

    // Generate new token and extend expiration
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.invite.update({
      where: { id },
      data: {
        token,
        expiresAt,
      },
    });

    return {
      message: 'Invite resent successfully',
      token,
    };
  }

  async cleanupExpired() {
    const result = await this.prisma.invite.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return {
      message: `Marked ${result.count} expired invites as expired`,
      count: result.count,
    };
  }
}

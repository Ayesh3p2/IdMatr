import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IntegrationProvider, InviteStatus, Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { google } from 'googleapis';
import * as speakeasy from 'speakeasy';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/request-user.interface';
import { IntegrationsCryptoService } from '../integrations/integrations.crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload.interface';

const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'] as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly cryptoService: IntegrationsCryptoService,
  ) {}

  async getGoogleAuthorizationUrl(tenantSlug: string) {
    if (!tenantSlug) {
      throw new BadRequestException('tenantSlug is required');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug: tenantSlug,
        status: 'ACTIVE',
      },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found or inactive');
    }

    const state = randomBytes(24).toString('hex');
    await this.prisma.oauthSession.create({
      data: {
        tenantId: tenant.id,
        provider: IntegrationProvider.GOOGLE,
        state,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const oauthClient = this.createGoogleOauthClient();
    const authorizationUrl = oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [...GOOGLE_OAUTH_SCOPES],
      prompt: 'consent',
      include_granted_scopes: true,
      state,
    });

    return { authorizationUrl };
  }

  async completeGoogleAuthorization(code: string, state: string) {
    if (!code || !state) {
      throw new BadRequestException('Google OAuth callback requires code and state');
    }

    const session = await this.prisma.oauthSession.findUnique({
      where: { state },
      include: { tenant: true },
    });

    if (!session || session.provider !== IntegrationProvider.GOOGLE) {
      throw new UnauthorizedException('OAuth session is invalid');
    }

    if (session.status !== 'PENDING' || session.expiresAt < new Date()) {
      throw new UnauthorizedException('OAuth session is expired');
    }

    const oauthClient = this.createGoogleOauthClient();
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);

    const profile = (
      await google.oauth2({
        version: 'v2',
        auth: oauthClient,
      }).userinfo.get()
    ).data;

    const email = profile.email?.toLowerCase();
    if (!email || !profile.verified_email) {
      throw new UnauthorizedException('Google account email must be verified');
    }

    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain) {
      throw new UnauthorizedException('Google account email is invalid');
    }

    const hostedDomain = profile.hd?.toLowerCase() ?? emailDomain;
    const trustedDomain = session.tenant.primaryDomain?.toLowerCase() ?? hostedDomain;
    const candidateDomains = new Set([emailDomain, hostedDomain]);

    if (session.tenant.primaryDomain && !candidateDomains.has(trustedDomain)) {
      throw new UnauthorizedException('Google account domain does not match this tenant');
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const existingUser = await this.prisma.tenantUser.findFirst({
      where: {
        tenantId: session.tenantId,
        email,
      },
    });

    if (existingUser?.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('This user account is disabled');
    }

    const user = existingUser
      ? await this.prisma.tenantUser.update({
          where: { id: existingUser.id },
          data: {
            name: profile.name ?? existingUser.name,
            role:
              existingUser.role === Role.PLATFORM_ADMIN
                ? Role.PLATFORM_ADMIN
                : Role.TENANT_ADMIN,
            status: UserStatus.ACTIVE,
            lastLoginAt: new Date(),
          },
        })
      : await this.prisma.tenantUser.create({
          data: {
            tenantId: session.tenantId,
            email,
            name: profile.name ?? email,
            passwordHash,
            role: Role.TENANT_ADMIN,
            status: UserStatus.ACTIVE,
            lastLoginAt: new Date(),
          },
        });

    await this.prisma.$transaction([
      this.prisma.oauthSession.update({
        where: { id: session.id },
        data: {
          status: 'VERIFIED',
          verifiedEmail: email,
          verifiedDomain: trustedDomain,
        },
      }),
      this.prisma.tenant.update({
        where: { id: session.tenantId },
        data: {
          primaryDomain: session.tenant.primaryDomain ?? trustedDomain,
        },
      }),
    ]);

    await this.auditService.log({
      tenantId: session.tenantId,
      actorUserId: user.id,
      action: 'auth.google.login',
      resource: 'tenant_user',
      metadata: {
        email,
        domain: trustedDomain,
      },
    });

    const publicAppUrl = (process.env.PUBLIC_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '');

    return {
      user: this.toPublicUser(user),
      tenant: {
        id: session.tenant.id,
        name: session.tenant.name,
        slug: session.tenant.slug,
        primaryDomain: trustedDomain,
      },
      tokens: await this.issueTokens(user),
      onboardingUrl: `${publicAppUrl}/api/integrations/google/onboarding`,
    };
  }

  async login(dto: LoginDto) {
    if (!dto.tenantId && !dto.tenantSlug) {
      throw new BadRequestException('tenantId or tenantSlug is required');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: dto.tenantId
        ? { id: dto.tenantId }
        : { slug: dto.tenantSlug, status: 'ACTIVE' },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    const user = await this.prisma.tenantUser.findFirst({
      where: {
        tenantId: tenant.id,
        email: dto.email.toLowerCase(),
      },
    });

    if (!user || user.status === UserStatus.DISABLED) {
      await this.auditFailedLogin(tenant.id, user?.id, dto.email, 'USER_DISABLED_OR_NOT_FOUND');
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.auditFailedLogin(tenant.id, user.id, dto.email, 'INVALID_PASSWORD');
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    const privilegedRoles: Role[] = [Role.PLATFORM_ADMIN, Role.TENANT_ADMIN];
    if (privilegedRoles.includes(user.role) && !user.mfaEnabled) {
      console.log('MFA_SETUP_REQUIRED: User needs MFA setup, creating token...');
      await this.auditFailedLogin(tenant.id, user.id, dto.email, 'MFA_SETUP_REQUIRED');
      const mfaSetupToken = await this.createMfaSetupToken(user);
      console.log('MFA_SETUP_REQUIRED: Token created, returning MFA setup response');
      return {
        status: 'MFA_SETUP_REQUIRED',
        message: 'MFA setup is required for admin login',
        setupToken: mfaSetupToken,
      };
    }

    if (user.mfaEnabled) {
      if (!dto.totpCode) {
        await this.auditFailedLogin(tenant.id, user.id, dto.email, 'MISSING_TOTP');
        throw new UnauthorizedException('TOTP code required');
      }

      const validTotp = speakeasy.totp.verify({
        secret: this.decryptMfaSecret(user.mfaSecret),
        encoding: 'base32',
        token: dto.totpCode,
        window: 1,
      });

      if (!validTotp) {
        await this.auditFailedLogin(tenant.id, user.id, dto.email, 'INVALID_TOTP');
        throw new UnauthorizedException('Invalid TOTP code');
      }
    }

    await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        status: user.status === UserStatus.INVITED ? UserStatus.ACTIVE : user.status,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.login',
      resource: 'tenant_user',
      metadata: { email: user.email },
    });

    return {
      user: this.toPublicUser(user),
      tokens: await this.issueTokens(user),
      security: {
        mfaEnabled: user.mfaEnabled,
        requiresMfaSetup: !user.mfaEnabled && privilegedRoles.includes(user.role),
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret',
      });

      const user = await this.prisma.tenantUser.findUnique({
        where: { id: payload.sub },
      });

      if (
        !user ||
        user.status === UserStatus.DISABLED ||
        user.tenantId !== payload.tenantId ||
        user.authVersion !== payload.ver ||
        !user.refreshTokenHash
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!refreshTokenMatches) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return {
        user: this.toPublicUser(user),
        tokens: await this.issueTokens(user),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(user: RequestUser) {
    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { id: user.userId },
      include: {
        tenant: true,
        mappedExternalIdentities: {
          select: {
            id: true,
            primaryEmail: true,
            fullName: true,
            integrationId: true,
          },
        },
      },
    });

    if (!tenantUser) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user: this.toPublicUser(tenantUser),
      tenant: {
        id: tenantUser.tenant.id,
        name: tenantUser.tenant.name,
        slug: tenantUser.tenant.slug,
        status: tenantUser.tenant.status,
        primaryDomain: tenantUser.tenant.primaryDomain,
      },
      identityMappings: tenantUser.mappedExternalIdentities,
    };
  }

  async acceptInvite(params: {
    token: string;
    name: string;
    password: string;
  }) {
    const invite = await this.prisma.invite.findUnique({
      where: { token: params.token },
      include: { tenant: true },
    });

    if (!invite || invite.status !== InviteStatus.PENDING || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite is invalid or expired');
    }

    const existingUser = await this.prisma.tenantUser.findFirst({
      where: {
        tenantId: invite.tenantId,
        email: invite.email.toLowerCase(),
      },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists for this invite');
    }

    const passwordHash = await bcrypt.hash(params.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.tenantUser.create({
        data: {
          tenantId: invite.tenantId,
          email: invite.email.toLowerCase(),
          name: params.name,
          passwordHash,
          role: invite.role,
          status: UserStatus.ACTIVE,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedBy: createdUser.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: invite.tenantId,
          actorUserId: createdUser.id,
          action: 'invite.accepted',
          resource: 'invite',
          metadata: {
            email: invite.email,
            invitedBy: invite.invitedBy,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.externalIdentity.updateMany({
        where: {
          tenantId: invite.tenantId,
          primaryEmail: invite.email.toLowerCase(),
        },
        data: {
          mappedTenantUserId: createdUser.id,
        },
      });

      return createdUser;
    });

    return {
      user: this.toPublicUser(user),
      tokens: await this.issueTokens(user),
      tenant: {
        id: invite.tenant.id,
        name: invite.tenant.name,
        slug: invite.tenant.slug,
      },
    };
  }

  async getInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: { tenant: true },
    });

    if (!invite || invite.status !== InviteStatus.PENDING || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite is invalid or expired');
    }

    return {
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      tenant: {
        id: invite.tenant.id,
        name: invite.tenant.name,
        slug: invite.tenant.slug,
      },
    };
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    tenantId: string;
    authVersion: number;
  }) {
    const tokens = await this.createTokens(user);

    await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12),
      },
    });

    return tokens;
  }

  private async createTokens(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    tenantId: string;
    authVersion: number;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      ver: user.authVersion,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    });

    return { accessToken, refreshToken };
  }

  private async createMfaSetupToken(user: {
    id: string;
    email: string;
    tenantId: string;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      type: 'mfa_setup',
    };

    return await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      expiresIn: '5m',
    });
  }

  private async auditFailedLogin(tenantId: string, actorUserId: string | undefined, email: string, reason: string) {
    await this.auditService.log({
      tenantId,
      actorUserId,
      action: 'auth.login.failed',
      resource: 'tenant_user',
      metadata: {
        email: email.toLowerCase(),
        reason,
      },
    });
  }

  private createGoogleOauthClient() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.',
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private decryptMfaSecret(secret: string | null) {
    if (!secret) {
      throw new UnauthorizedException('MFA is not configured correctly');
    }

    return this.cryptoService.decrypt(secret);
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
    };
  }
}

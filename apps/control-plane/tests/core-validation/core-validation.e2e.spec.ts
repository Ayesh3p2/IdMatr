import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventSeverity, IntegrationProvider, IntegrationStatus, Role, TenantStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import * as speakeasy from 'speakeasy';
import { IntegrationsCryptoService } from '../../src/integrations/integrations.crypto';
import { createCoreValidationApp } from './support/create-core-validation-app';
import {
  CoreValidationState,
  InMemoryPrismaService,
} from './support/in-memory-prisma';

const ADMIN_MFA_SECRET = 'JBSWY3DPEHPK3PXP';

describe('Core Validation Harness', () => {
  let app: INestApplication;
  let prisma: InMemoryPrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    prisma = new InMemoryPrismaService();
    const harness = await createCoreValidationApp(prisma);
    app = harness.app;
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    prisma.reset(await buildState());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication + MFA', () => {
    it('POST /api/auth/login blocks admin login until MFA is enabled', async () => {
      const response = await request(app.getHttpServer()).post('/api/auth/login').send({
        tenantSlug: 'tenant-a',
        email: 'admin.nomfa@tenant-a.test',
        password: 'Password123!',
      });

      expect(response.status).toBe(403);
    });

    it('POST /api/auth/login succeeds for MFA-enabled admin with a valid OTP', async () => {
      const response = await loginAs({
        tenantSlug: 'tenant-a',
        email: 'admin@tenant-a.test',
        password: 'Password123!',
        includeOtp: true,
      });

      expect(response.status).toBe(201);
      expect(response.body.tokens.accessToken).toEqual(expect.any(String));
    });

    it('POST /api/auth/login fails when an MFA-enabled admin skips OTP', async () => {
      const response = await loginAs({
        tenantSlug: 'tenant-a',
        email: 'admin@tenant-a.test',
        password: 'Password123!',
        includeOtp: false,
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('TOTP code required');
    });
  });

  describe('RBAC', () => {
    it('GET /api/iam/users rejects a basic user', async () => {
      const accessToken = await issueAccessTokenForUser('user-a');

      const response = await request(app.getHttpServer())
        .get('/api/iam/users')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it('GET /api/tenants rejects a tenant admin trying a platform admin endpoint', async () => {
      const accessToken = await issueAccessTokenForUser('admin-a');

      const response = await request(app.getHttpServer())
        .get('/api/tenants')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Tenant Isolation', () => {
    it('GET /api/iam/users/:id prevents tenant A from reading tenant B users', async () => {
      const accessToken = await issueAccessTokenForUser('admin-a');

      const response = await request(app.getHttpServer())
        .get('/api/iam/users/user-b')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });

    it('GET /api/iam/users rejects tenant query injection', async () => {
      const accessToken = await issueAccessTokenForUser('admin-a');

      const response = await request(app.getHttpServer())
        .get('/api/iam/users')
        .query({ tenantId: 'tenant-b' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('tenantId must match the authenticated tenant context');
    });

    it('GET /api/iam/users rejects tenant header injection', async () => {
      const accessToken = await issueAccessTokenForUser('admin-a');

      const response = await request(app.getHttpServer())
        .get('/api/iam/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', 'tenant-b');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('tenantId must not be supplied in request headers');
    });
  });

  describe('IVIP Security', () => {
    it('POST /api/ivip/requests rejects access requests for another identity', async () => {
      const accessToken = await issueAccessTokenForUser('user-a');

      const response = await request(app.getHttpServer())
        .post('/api/ivip/requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          integrationId: 'integration-google-a',
          externalIdentityId: 'identity-other-a',
          externalGroupId: 'group-admins-a',
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Users can only request access for their own mapped identity');
    });

    it('POST /api/ivip/requests allows a user to request access for their own identity', async () => {
      const accessToken = await issueAccessTokenForUser('user-a');

      const response = await request(app.getHttpServer())
        .post('/api/ivip/requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          integrationId: 'integration-google-a',
          externalIdentityId: 'identity-self-a',
          externalGroupId: 'group-admins-a',
        });

      expect(response.status).toBe(201);
      expect(response.body.requesterUserId).toBe('user-a');
      expect(response.body.externalIdentityId).toBe('identity-self-a');
    });
  });

  describe('JWT Security', () => {
    it('GET /api/auth/me rejects expired tokens', async () => {
      const expiredToken = await signAccessToken(
        {
          sub: 'admin-a',
          email: 'admin@tenant-a.test',
          name: 'Tenant Admin A',
          role: Role.TENANT_ADMIN,
          tenantId: 'tenant-a',
          ver: 0,
        },
        '-1s',
      );

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('GET /api/auth/me rejects tampered tokens', async () => {
      const token = await issueAccessTokenForUser('user-a');
      const tampered = tamperToken(token, { tenantId: 'tenant-b' });

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tampered}`);

      expect(response.status).toBe(401);
    });

    it('GET /api/auth/me rejects tokens for disabled users', async () => {
      const disabledToken = await signAccessToken({
        sub: 'disabled-admin-a',
        email: 'disabled@tenant-a.test',
        name: 'Disabled Admin',
        role: Role.TENANT_ADMIN,
        tenantId: 'tenant-a',
        ver: 0,
      });

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${disabledToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('ITDR', () => {
    it('POST /api/itdr/detect/google generates events and updates risk score', async () => {
      const accessToken = await issueAccessTokenForUser('admin-a');

      const detectResponse = await request(app.getHttpServer())
        .post('/api/itdr/detect/google')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ integrationId: 'integration-google-a' });

      expect(detectResponse.status).toBe(201);
      expect(detectResponse.body).toMatchObject({
        inactiveUsersDetected: 1,
        highPrivilegeUsersDetected: 1,
        multipleAccessUsersDetected: 1,
      });

      const adminEventsResponse = await request(app.getHttpServer())
        .get('/api/itdr/events')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(adminEventsResponse.status).toBe(200);
      expect(adminEventsResponse.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: 'itdr.inactive_user.detected' }),
          expect.objectContaining({ action: 'itdr.high_privilege_user.detected' }),
          expect.objectContaining({ action: 'itdr.multiple_access.detected' }),
        ]),
      );

      const snapshot = prisma.snapshot();
      const highRiskIdentity = snapshot.externalIdentities.find((identity) => identity.id === 'identity-risk-a');
      expect(highRiskIdentity?.riskScore).toBe(45);
    });

    it('GET /api/itdr/events rejects non-admin visibility', async () => {
      const accessToken = await issueAccessTokenForUser('user-a');

      const response = await request(app.getHttpServer())
        .get('/api/itdr/events')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  async function loginAs(params: {
    tenantSlug: string;
    email: string;
    password: string;
    includeOtp?: boolean;
  }) {
    const payload: Record<string, string> = {
      tenantSlug: params.tenantSlug,
      email: params.email,
      password: params.password,
    };

    if (params.includeOtp) {
      payload.totpCode = speakeasy.totp({
        secret: ADMIN_MFA_SECRET,
        encoding: 'base32',
      });
    }

    return request(app.getHttpServer()).post('/api/auth/login').send(payload);
  }

  function signAccessToken(payload: {
    sub: string;
    email: string;
    name: string;
    role: Role;
    tenantId: string;
    ver: number;
  }, expiresIn = '15m') {
    return jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      expiresIn,
    });
  }

  function tamperToken(token: string, nextPayload: Record<string, unknown>) {
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...decodedPayload,
        ...nextPayload,
      }),
      'utf8',
    ).toString('base64url');
    return `${header}.${tamperedPayload}.${signature}`;
  }

  async function issueAccessTokenForUser(userId: string) {
    const snapshot = prisma.snapshot();
    const user = snapshot.tenantUsers.find((tenantUser) => tenantUser.id === userId);
    expect(user).toBeDefined();

    return signAccessToken({
      sub: user!.id,
      email: user!.email,
      name: user!.name,
      role: user!.role,
      tenantId: user!.tenantId,
      ver: user!.authVersion,
    });
  }
});

async function buildState(): Promise<CoreValidationState> {
  const cryptoService = new IntegrationsCryptoService();
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const now = new Date('2026-03-24T00:00:00.000Z');

  return {
    tenants: [
      {
        id: 'tenant-a',
        name: 'Tenant A',
        slug: 'tenant-a',
        primaryDomain: 'tenant-a.test',
        status: TenantStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tenant-b',
        name: 'Tenant B',
        slug: 'tenant-b',
        primaryDomain: 'tenant-b.test',
        status: TenantStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      },
    ],
    tenantUsers: [
      {
        id: 'platform-admin-a',
        tenantId: 'tenant-a',
        email: 'platform@tenant-a.test',
        name: 'Platform Admin',
        passwordHash,
        refreshTokenHash: null,
        authVersion: 0,
        role: Role.PLATFORM_ADMIN,
        status: UserStatus.ACTIVE,
        mfaEnabled: true,
        mfaSecret: cryptoService.encrypt(ADMIN_MFA_SECRET),
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'admin-a',
        tenantId: 'tenant-a',
        email: 'admin@tenant-a.test',
        name: 'Tenant Admin A',
        passwordHash,
        refreshTokenHash: null,
        authVersion: 0,
        role: Role.TENANT_ADMIN,
        status: UserStatus.ACTIVE,
        mfaEnabled: true,
        mfaSecret: cryptoService.encrypt(ADMIN_MFA_SECRET),
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'admin-no-mfa-a',
        tenantId: 'tenant-a',
        email: 'admin.nomfa@tenant-a.test',
        name: 'Tenant Admin No MFA',
        passwordHash,
        refreshTokenHash: null,
        authVersion: 0,
        role: Role.TENANT_ADMIN,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        mfaSecret: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'disabled-admin-a',
        tenantId: 'tenant-a',
        email: 'disabled@tenant-a.test',
        name: 'Disabled Admin',
        passwordHash,
        refreshTokenHash: null,
        authVersion: 0,
        role: Role.TENANT_ADMIN,
        status: UserStatus.DISABLED,
        mfaEnabled: true,
        mfaSecret: cryptoService.encrypt(ADMIN_MFA_SECRET),
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-a',
        tenantId: 'tenant-a',
        email: 'user@tenant-a.test',
        name: 'Tenant A User',
        passwordHash,
        refreshTokenHash: null,
        authVersion: 0,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        mfaSecret: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-b',
        tenantId: 'tenant-b',
        email: 'user@tenant-b.test',
        name: 'Tenant B User',
        passwordHash,
        refreshTokenHash: null,
        authVersion: 0,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        mfaSecret: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    integrations: [
      {
        id: 'integration-google-a',
        tenantId: 'tenant-a',
        provider: IntegrationProvider.GOOGLE,
        name: 'Google Workspace',
        status: IntegrationStatus.CONNECTED,
        externalDomain: 'tenant-a.test',
        configEncrypted: 'encrypted-config',
        scopes: [],
        metadata: {},
        lastSyncAt: null,
        lastSyncStatus: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    externalIdentities: [
      {
        id: 'identity-self-a',
        tenantId: 'tenant-a',
        integrationId: 'integration-google-a',
        externalId: 'google-user-self-a',
        primaryEmail: 'user@tenant-a.test',
        fullName: 'Tenant A User',
        givenName: 'Tenant',
        familyName: 'User',
        orgUnitPath: '/',
        lastLoginAt: now,
        roleNames: [],
        suspended: false,
        archived: false,
        isAdmin: false,
        isDelegatedAdmin: false,
        riskScore: 0,
        sourceStatus: 'ACTIVE',
        rawProfile: {},
        mappedTenantUserId: 'user-a',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'identity-other-a',
        tenantId: 'tenant-a',
        integrationId: 'integration-google-a',
        externalId: 'google-user-other-a',
        primaryEmail: 'other@tenant-a.test',
        fullName: 'Other User',
        givenName: 'Other',
        familyName: 'User',
        orgUnitPath: '/',
        lastLoginAt: now,
        roleNames: [],
        suspended: false,
        archived: false,
        isAdmin: false,
        isDelegatedAdmin: false,
        riskScore: 0,
        sourceStatus: 'ACTIVE',
        rawProfile: {},
        mappedTenantUserId: 'admin-a',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'identity-risk-a',
        tenantId: 'tenant-a',
        integrationId: 'integration-google-a',
        externalId: 'google-user-risk-a',
        primaryEmail: 'risk@tenant-a.test',
        fullName: 'Risk Identity',
        givenName: 'Risk',
        familyName: 'Identity',
        orgUnitPath: '/',
        lastLoginAt: null,
        roleNames: ['Super Admin'],
        suspended: false,
        archived: false,
        isAdmin: true,
        isDelegatedAdmin: false,
        riskScore: 0,
        sourceStatus: 'ACTIVE',
        rawProfile: {},
        mappedTenantUserId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    externalGroups: [
      {
        id: 'group-admins-a',
        tenantId: 'tenant-a',
        integrationId: 'integration-google-a',
        externalId: 'google-group-admins-a',
        email: 'admins@tenant-a.test',
        name: 'Admins',
        description: 'Privileged group',
        directMembersCount: 0,
        rawProfile: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'group-ops-a',
        tenantId: 'tenant-a',
        integrationId: 'integration-google-a',
        externalId: 'google-group-ops-a',
        email: 'ops@tenant-a.test',
        name: 'Ops',
        description: 'Operations group',
        directMembersCount: 0,
        rawProfile: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    externalGroupMemberships: [
      {
        id: 'membership-risk-owner-a',
        tenantId: 'tenant-a',
        integrationId: 'integration-google-a',
        externalGroupId: 'group-admins-a',
        externalIdentityId: 'identity-risk-a',
        memberExternalId: 'google-user-risk-a',
        memberEmail: 'risk@tenant-a.test',
        memberType: 'USER',
        role: 'OWNER',
        rawProfile: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'membership-risk-member-a',
        tenantId: 'tenant-a',
        integrationId: 'integration-google-a',
        externalGroupId: 'group-ops-a',
        externalIdentityId: 'identity-risk-a',
        memberExternalId: 'google-user-risk-a',
        memberEmail: 'risk@tenant-a.test',
        memberType: 'USER',
        role: 'MEMBER',
        rawProfile: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    identityRequests: [],
    auditEvents: [],
  };
}

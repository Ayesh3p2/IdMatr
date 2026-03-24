import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IntegrationProvider, IntegrationStatus, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleConnectDto } from './dto/google-connect.dto';
import { GoogleSyncDto } from './dto/google-sync.dto';
import { MapIdentityDto } from './dto/map-identity.dto';
import { IntegrationsCryptoService } from './integrations.crypto';
import { GoogleIntegrationService } from './google/google.integration';
import { GoogleIntegrationConfig } from './google/google.types';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cryptoService: IntegrationsCryptoService,
    private readonly googleIntegration: GoogleIntegrationService,
  ) {}

  async connectGoogle(actor: RequestUser, dto: GoogleConnectDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: actor.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const config = this.resolveGoogleConfig(dto, {
      adminEmail: actor.email,
      domain: tenant.primaryDomain ?? undefined,
    });
    this.assertTrustedGoogleConnection(actor, tenant.primaryDomain, config);
    const health = await this.googleIntegration.connect(config);

    const integration = await this.prisma.integration.upsert({
      where: {
        tenantId_provider: {
          tenantId: actor.tenantId,
          provider: IntegrationProvider.GOOGLE,
        },
      },
      create: {
        tenantId: actor.tenantId,
        provider: IntegrationProvider.GOOGLE,
        name: dto.name ?? 'Google Workspace',
        status: IntegrationStatus.CONNECTED,
        externalDomain: config.domain,
        configEncrypted: this.cryptoService.encryptJson(config),
        scopes: this.googleIntegration.scopes,
        metadata: {
          serviceAccountEmail: config.serviceAccountKey.client_email,
          adminEmail: config.adminEmail,
        } as Prisma.InputJsonValue,
        lastHealthCheckAt: new Date(),
      },
      update: {
        name: dto.name ?? 'Google Workspace',
        status: IntegrationStatus.CONNECTED,
        externalDomain: config.domain,
        configEncrypted: this.cryptoService.encryptJson(config),
        scopes: this.googleIntegration.scopes,
        metadata: {
          serviceAccountEmail: config.serviceAccountKey.client_email,
          adminEmail: config.adminEmail,
        } as Prisma.InputJsonValue,
        lastHealthCheckAt: new Date(),
        lastSyncError: null,
      },
    });

    const userSync = await this.syncGoogleUsers(actor, { integrationId: integration.id });
    const groupSync = await this.syncGoogleGroups(actor, { integrationId: integration.id });
    const roleSync = await this.syncGoogleRoles(actor, { integrationId: integration.id });

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'integration.google.connected',
      resource: 'integration',
      metadata: {
        integrationId: integration.id,
        domain: integration.externalDomain,
        detail: health.detail,
      },
    });

    return {
      integration: this.toPublicIntegration(
        await this.prisma.integration.findUniqueOrThrow({ where: { id: integration.id } }),
      ),
      health,
      sync: {
        usersSynced: userSync.usersSynced,
        groupsSynced: groupSync.groupsSynced,
        membershipsSynced: groupSync.membershipsSynced,
        identitiesWithRolesRefreshed: roleSync.identitiesUpdated,
      },
    };
  }

  async healthCheckGoogle(actor: RequestUser, dto: GoogleSyncDto) {
    const integration = await this.findGoogleIntegration(actor.tenantId, dto.integrationId);
    const config = this.readGoogleConfig(integration.configEncrypted);
    const health = await this.googleIntegration.healthCheck(config);

    await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: health.reachable ? IntegrationStatus.CONNECTED : IntegrationStatus.ERROR,
        lastHealthCheckAt: new Date(),
        lastSyncError: health.reachable ? null : health.detail,
      },
    });

    return {
      integration: this.toPublicIntegration(integration),
      health,
    };
  }

  async syncGoogleUsers(actor: RequestUser, dto: GoogleSyncDto) {
    const integration = await this.findGoogleIntegration(actor.tenantId, dto.integrationId);
    const config = this.readGoogleConfig(integration.configEncrypted);
    const result = await this.googleIntegration.syncUsers(config);

    const localUsers = await this.prisma.tenantUser.findMany({
      where: { tenantId: actor.tenantId },
      select: { id: true, email: true },
    });

    const localUserIdsByEmail = new Map(
      localUsers.map((user) => [user.email.toLowerCase(), user.id]),
    );

    const syncedExternalIds = new Set<string>();

    for (const user of result.users) {
      syncedExternalIds.add(user.externalId);
      await this.prisma.externalIdentity.upsert({
        where: {
          integrationId_externalId: {
            integrationId: integration.id,
            externalId: user.externalId,
          },
        },
        create: {
          tenantId: actor.tenantId,
          integrationId: integration.id,
          externalId: user.externalId,
          primaryEmail: user.primaryEmail,
          fullName: user.fullName,
          orgUnitPath: user.orgUnitPath,
          roleNames: user.roleNames,
          lastLoginAt: user.lastLoginAt,
          suspended: user.suspended,
          archived: user.archived,
          isAdmin: user.isAdmin,
          isDelegatedAdmin: user.isDelegatedAdmin,
          sourceStatus: user.sourceStatus,
          rawProfile: user.rawProfile as Prisma.InputJsonValue,
          mappedTenantUserId: localUserIdsByEmail.get(user.primaryEmail),
        },
        update: {
          primaryEmail: user.primaryEmail,
          fullName: user.fullName,
          orgUnitPath: user.orgUnitPath,
          roleNames: user.roleNames,
          lastLoginAt: user.lastLoginAt,
          suspended: user.suspended,
          archived: user.archived,
          isAdmin: user.isAdmin,
          isDelegatedAdmin: user.isDelegatedAdmin,
          sourceStatus: user.sourceStatus,
          rawProfile: user.rawProfile as Prisma.InputJsonValue,
          mappedTenantUserId: localUserIdsByEmail.get(user.primaryEmail),
        },
      });
    }

    await this.removeStaleExternalIdentities(actor.tenantId, integration.id, syncedExternalIds);
    await this.markIntegrationSynced(integration.id, result.users.length);

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'integration.google.sync_users',
      resource: 'integration',
      metadata: {
        integrationId: integration.id,
        usersSynced: result.users.length,
      },
    });

    return {
      integration: this.toPublicIntegration(
        await this.prisma.integration.findUniqueOrThrow({ where: { id: integration.id } }),
      ),
      usersSynced: result.users.length,
    };
  }

  async syncGoogleGroups(actor: RequestUser, dto: GoogleSyncDto) {
    const integration = await this.findGoogleIntegration(actor.tenantId, dto.integrationId);
    const config = this.readGoogleConfig(integration.configEncrypted);
    const result = await this.googleIntegration.syncPermissions(config);

    const identities = await this.prisma.externalIdentity.findMany({
      where: { tenantId: actor.tenantId, integrationId: integration.id },
      select: { id: true, externalId: true, primaryEmail: true },
    });

    const identityIdsByExternalId = new Map(
      identities.map((identity) => [identity.externalId, identity.id]),
    );
    const identityIdsByEmail = new Map(
      identities.map((identity) => [identity.primaryEmail.toLowerCase(), identity.id]),
    );

    const groupIdsByExternalId = new Map<string, string>();
    const syncedGroupExternalIds = new Set<string>();

    for (const group of result.groups) {
      syncedGroupExternalIds.add(group.externalId);
      const savedGroup = await this.prisma.externalGroup.upsert({
        where: {
          integrationId_externalId: {
            integrationId: integration.id,
            externalId: group.externalId,
          },
        },
        create: {
          tenantId: actor.tenantId,
          integrationId: integration.id,
          externalId: group.externalId,
          email: group.email,
          name: group.name,
          description: group.description,
          directMembersCount: group.directMembersCount,
          rawProfile: group.rawProfile as Prisma.InputJsonValue,
        },
        update: {
          email: group.email,
          name: group.name,
          description: group.description,
          directMembersCount: group.directMembersCount,
          rawProfile: group.rawProfile as Prisma.InputJsonValue,
        },
      });
      groupIdsByExternalId.set(group.externalId, savedGroup.id);
    }

    const syncedMembershipKeys = new Set<string>();

    for (const membership of result.memberships) {
      const externalGroupId = groupIdsByExternalId.get(membership.groupExternalId);
      if (!externalGroupId) {
        continue;
      }

      const externalIdentityId =
        identityIdsByExternalId.get(membership.memberExternalId) ??
        (membership.memberEmail
          ? identityIdsByEmail.get(membership.memberEmail.toLowerCase())
          : undefined);

      syncedMembershipKeys.add(`${externalGroupId}:${membership.memberExternalId}`);

      await this.prisma.externalGroupMembership.upsert({
        where: {
          externalGroupId_memberExternalId: {
            externalGroupId,
            memberExternalId: membership.memberExternalId,
          },
        },
        create: {
          tenantId: actor.tenantId,
          integrationId: integration.id,
          externalGroupId,
          externalIdentityId,
          memberExternalId: membership.memberExternalId,
          memberEmail: membership.memberEmail,
          memberType: membership.memberType,
          role: membership.role,
          rawProfile: membership.rawProfile as Prisma.InputJsonValue,
        },
        update: {
          externalIdentityId,
          memberEmail: membership.memberEmail,
          memberType: membership.memberType,
          role: membership.role,
          rawProfile: membership.rawProfile as Prisma.InputJsonValue,
        },
      });
    }

    await this.removeStaleGroups(actor.tenantId, integration.id, syncedGroupExternalIds);
    await this.removeStaleMemberships(actor.tenantId, integration.id, syncedMembershipKeys);
    await this.markIntegrationSynced(integration.id, result.memberships.length);

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'integration.google.sync_groups',
      resource: 'integration',
      metadata: {
        integrationId: integration.id,
        groupsSynced: result.groups.length,
        membershipsSynced: result.memberships.length,
      },
    });

    return {
      integration: this.toPublicIntegration(
        await this.prisma.integration.findUniqueOrThrow({ where: { id: integration.id } }),
      ),
      groupsSynced: result.groups.length,
      membershipsSynced: result.memberships.length,
    };
  }

  async syncGoogleRoles(actor: RequestUser, dto: GoogleSyncDto) {
    const integration = await this.findGoogleIntegration(actor.tenantId, dto.integrationId);
    const config = this.readGoogleConfig(integration.configEncrypted);
    const result = await this.googleIntegration.syncRoles(config);

    for (const assignment of result.assignments) {
      await this.prisma.externalIdentity.updateMany({
        where: {
          tenantId: actor.tenantId,
          integrationId: integration.id,
          externalId: assignment.userExternalId,
        },
        data: {
          roleNames: assignment.roleNames,
          isAdmin: assignment.isAdmin,
          isDelegatedAdmin: assignment.isDelegatedAdmin,
          lastLoginAt: assignment.lastLoginAt,
        },
      });
    }

    await this.markIntegrationSynced(integration.id, result.assignments.length);

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'integration.google.sync_roles',
      resource: 'integration',
      metadata: {
        integrationId: integration.id,
        identitiesUpdated: result.assignments.length,
      },
    });

    return {
      integration: this.toPublicIntegration(
        await this.prisma.integration.findUniqueOrThrow({ where: { id: integration.id } }),
      ),
      identitiesUpdated: result.assignments.length,
    };
  }

  async listGoogleUsers(actor: RequestUser) {
    const integration = await this.findGoogleIntegration(actor.tenantId);

    return this.prisma.externalIdentity.findMany({
      where: {
        tenantId: actor.tenantId,
        integrationId: integration.id,
      },
      include: {
        mappedTenantUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
      orderBy: { primaryEmail: 'asc' },
    });
  }

  async listGoogleGroups(actor: RequestUser) {
    const integration = await this.findGoogleIntegration(actor.tenantId);

    return this.prisma.externalGroup.findMany({
      where: {
        tenantId: actor.tenantId,
        integrationId: integration.id,
      },
      include: {
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: { email: 'asc' },
    });
  }

  async listIntegrations(actor: RequestUser) {
    const integrations = await this.prisma.integration.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return integrations.map((integration) => this.toPublicIntegration(integration));
  }

  async listIdentities(actor: RequestUser, integrationId?: string) {
    const integration = integrationId
      ? await this.findGoogleIntegration(actor.tenantId, integrationId)
      : await this.findGoogleIntegration(actor.tenantId);

    return this.prisma.externalIdentity.findMany({
      where: {
        tenantId: actor.tenantId,
        integrationId: integration.id,
      },
      include: {
        mappedTenantUser: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        memberships: {
          include: {
            externalGroup: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { primaryEmail: 'asc' },
    });
  }

  async mapIdentity(actor: RequestUser, externalIdentityId: string, dto: MapIdentityDto) {
    const [externalIdentity, tenantUser] = await Promise.all([
      this.prisma.externalIdentity.findFirst({
        where: { id: externalIdentityId, tenantId: actor.tenantId },
      }),
      this.prisma.tenantUser.findFirst({
        where: { id: dto.tenantUserId, tenantId: actor.tenantId },
      }),
    ]);

    if (!externalIdentity) {
      throw new NotFoundException('External identity not found');
    }

    if (!tenantUser) {
      throw new NotFoundException('Tenant user not found');
    }

    const updated = await this.prisma.externalIdentity.update({
      where: { id: externalIdentityId },
      data: { mappedTenantUserId: tenantUser.id },
      include: {
        mappedTenantUser: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    await this.auditService.log({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: 'iam.identity.mapped',
      resource: 'external_identity',
      metadata: {
        externalIdentityId,
        tenantUserId: tenantUser.id,
      },
    });

    return updated;
  }

  async grantGroupAccess(params: {
    tenantId: string;
    actorUserId: string;
    integrationId: string;
    externalIdentityId: string;
    externalGroupId: string;
    role?: string;
  }) {
    const integration = await this.findGoogleIntegration(params.tenantId, params.integrationId);
    const config = this.readGoogleConfig(integration.configEncrypted);

    const [identity, group] = await Promise.all([
      this.prisma.externalIdentity.findFirst({
        where: {
          id: params.externalIdentityId,
          tenantId: params.tenantId,
          integrationId: integration.id,
        },
      }),
      this.prisma.externalGroup.findFirst({
        where: {
          id: params.externalGroupId,
          tenantId: params.tenantId,
          integrationId: integration.id,
        },
      }),
    ]);

    if (!identity || !group) {
      throw new NotFoundException('Identity or group not found');
    }

    await this.googleIntegration.addGroupMember?.(config, {
      groupExternalId: group.externalId,
      memberEmail: identity.primaryEmail,
      role: params.role ?? 'MEMBER',
    });

    const membership = await this.prisma.externalGroupMembership.upsert({
      where: {
        externalGroupId_memberExternalId: {
          externalGroupId: group.id,
          memberExternalId: identity.externalId,
        },
      },
      create: {
        tenantId: params.tenantId,
        integrationId: integration.id,
        externalGroupId: group.id,
        externalIdentityId: identity.id,
        memberExternalId: identity.externalId,
        memberEmail: identity.primaryEmail,
        memberType: 'USER',
        role: params.role ?? 'MEMBER',
        rawProfile: {} as Prisma.InputJsonValue,
      },
      update: {
        externalIdentityId: identity.id,
        memberEmail: identity.primaryEmail,
        memberType: 'USER',
        role: params.role ?? 'MEMBER',
      },
    });

    await this.auditService.log({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'integration.google.membership.granted',
      resource: 'external_group_membership',
      metadata: {
        integrationId: integration.id,
        externalIdentityId: identity.id,
        externalGroupId: group.id,
        membershipId: membership.id,
      },
    });

    return membership;
  }

  async revokeGroupAccess(params: {
    tenantId: string;
    actorUserId: string;
    integrationId: string;
    externalIdentityId: string;
    externalGroupId: string;
  }) {
    const integration = await this.findGoogleIntegration(params.tenantId, params.integrationId);
    const config = this.readGoogleConfig(integration.configEncrypted);

    const [identity, group] = await Promise.all([
      this.prisma.externalIdentity.findFirst({
        where: {
          id: params.externalIdentityId,
          tenantId: params.tenantId,
          integrationId: integration.id,
        },
      }),
      this.prisma.externalGroup.findFirst({
        where: {
          id: params.externalGroupId,
          tenantId: params.tenantId,
          integrationId: integration.id,
        },
      }),
    ]);

    if (!identity || !group) {
      throw new NotFoundException('Identity or group not found');
    }

    await this.googleIntegration.removeGroupMember?.(config, {
      groupExternalId: group.externalId,
      memberKey: identity.primaryEmail,
    });

    await this.prisma.externalGroupMembership.deleteMany({
      where: {
        externalGroupId: group.id,
        memberExternalId: identity.externalId,
      },
    });

    await this.auditService.log({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'integration.google.membership.revoked',
      resource: 'external_group_membership',
      metadata: {
        integrationId: integration.id,
        externalIdentityId: identity.id,
        externalGroupId: group.id,
      },
    });
  }

  async getGoogleIntegrationSnapshot(tenantId: string, integrationId?: string) {
    return this.findGoogleIntegration(tenantId, integrationId);
  }

  async renderGoogleOnboardingPage(actor: RequestUser) {
    const [tenant, integration] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: actor.tenantId },
      }),
      this.prisma.integration.findFirst({
        where: {
          tenantId: actor.tenantId,
          provider: IntegrationProvider.GOOGLE,
        },
      }),
    ]);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const domain = integration?.externalDomain ?? tenant.primaryDomain ?? '';
    const adminEmail = actor.email;
    const status = integration?.status ?? 'DISCONNECTED';

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IDMatr Google Workspace Onboarding</title>
  <style>
    :root {
      --bg: #f5f1e8;
      --panel: #fffdf8;
      --text: #1e2a24;
      --muted: #5e6b64;
      --accent: #0f766e;
      --border: #d9d2c3;
      --danger: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at top left, rgba(15, 118, 110, 0.18), transparent 30%),
        linear-gradient(135deg, #f7f3ea 0%, #efe7d8 100%);
      color: var(--text);
      min-height: 100vh;
      padding: 32px 16px;
    }
    .shell {
      max-width: 960px;
      margin: 0 auto;
      display: grid;
      gap: 20px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 20px 40px rgba(30, 42, 36, 0.08);
    }
    h1, h2 { margin: 0 0 12px; }
    p, li, label, input, textarea, button { font-size: 16px; }
    .muted { color: var(--muted); }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
    .field { display: grid; gap: 8px; }
    input, textarea, button {
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 12px 14px;
      font: inherit;
    }
    textarea { min-height: 220px; resize: vertical; }
    button {
      background: var(--accent);
      color: white;
      cursor: pointer;
    }
    button.secondary {
      background: #1f2937;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    pre {
      background: #13221f;
      color: #ebfffb;
      padding: 16px;
      border-radius: 14px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .status-ok { color: var(--accent); }
    .status-error { color: var(--danger); }
  </style>
</head>
<body>
  <main class="shell">
    <section class="panel">
      <h1>Connect Google Workspace</h1>
      <p class="muted">OAuth trust is established for <strong>${this.escapeHtml(
        actor.email,
      )}</strong>. Complete the backend setup by attaching the service account used for domain-wide delegation. The backend will perform a full users, groups, and role sync immediately after connect.</p>
      <div class="grid">
        <div>
          <h2>Trusted Tenant</h2>
          <p><strong>${this.escapeHtml(tenant.name)}</strong> (${this.escapeHtml(tenant.slug)})</p>
          <p>Primary domain: <strong>${this.escapeHtml(domain || 'not set')}</strong></p>
          <p>Integration status: <strong>${this.escapeHtml(status)}</strong></p>
        </div>
        <div>
          <h2>Flow</h2>
          <ol>
            <li>Upload or paste the Google service account JSON.</li>
            <li>Confirm the delegated admin email and tenant domain.</li>
            <li>IDMatr validates the credentials, stores them encrypted, and runs a full sync.</li>
          </ol>
        </div>
      </div>
    </section>

    <section class="panel">
      <form id="connect-form">
        <div class="grid">
          <div class="field">
            <label for="serviceAccountFile">Option A (Recommended): Upload service account JSON</label>
            <input id="serviceAccountFile" type="file" accept="application/json" />
          </div>
          <div class="field">
            <label for="adminEmail">Delegated admin email</label>
            <input id="adminEmail" type="email" value="${this.escapeHtml(adminEmail)}" required />
          </div>
          <div class="field">
            <label for="domain">Google Workspace domain</label>
            <input id="domain" type="text" value="${this.escapeHtml(domain)}" required />
          </div>
        </div>
        <div class="field">
          <label for="serviceAccountKeyJson">Option B: Paste service account JSON</label>
          <textarea id="serviceAccountKeyJson" placeholder='{"type":"service_account","client_email":"...","private_key":"..."}' required></textarea>
        </div>
        <div class="actions">
          <button id="connect-button" type="submit">Connect Google Workspace</button>
          <button id="health-button" class="secondary" type="button">Run Health Check</button>
          <button id="roles-button" class="secondary" type="button">Refresh Roles</button>
        </div>
      </form>
    </section>

    <section class="panel">
      <h2>Result</h2>
      <pre id="result">Waiting for action...</pre>
    </section>
  </main>

  <script>
    const fileInput = document.getElementById('serviceAccountFile');
    const jsonField = document.getElementById('serviceAccountKeyJson');
    const resultEl = document.getElementById('result');

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      jsonField.value = await file.text();
    });

    async function postJson(url, body) {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(payload.message || payload.error || response.statusText);
      }
      return payload;
    }

    function buildBody() {
      return {
        adminEmail: document.getElementById('adminEmail').value.trim(),
        domain: document.getElementById('domain').value.trim(),
        serviceAccountKeyJson: jsonField.value.trim(),
      };
    }

    document.getElementById('connect-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      resultEl.textContent = 'Connecting and running full sync...';
      try {
        const payload = await postJson('/api/integrations/google/connect', buildBody());
        resultEl.textContent = JSON.stringify(payload, null, 2);
      } catch (error) {
        resultEl.textContent = error.message;
      }
    });

    document.getElementById('health-button').addEventListener('click', async () => {
      resultEl.textContent = 'Running health check...';
      try {
        const integrations = await fetch('/api/integrations', { credentials: 'include' }).then((response) => response.json());
        const googleIntegration = integrations.find((integration) => integration.provider === 'GOOGLE');
        if (!googleIntegration) {
          throw new Error('Google integration is not configured yet');
        }
        const payload = await postJson('/api/integrations/google/health', { integrationId: googleIntegration.id });
        resultEl.textContent = JSON.stringify(payload, null, 2);
      } catch (error) {
        resultEl.textContent = error.message;
      }
    });

    document.getElementById('roles-button').addEventListener('click', async () => {
      resultEl.textContent = 'Refreshing Google role assignments...';
      try {
        const integrations = await fetch('/api/integrations', { credentials: 'include' }).then((response) => response.json());
        const googleIntegration = integrations.find((integration) => integration.provider === 'GOOGLE');
        if (!googleIntegration) {
          throw new Error('Google integration is not configured yet');
        }
        const payload = await postJson('/api/integrations/google/sync-roles', { integrationId: googleIntegration.id });
        resultEl.textContent = JSON.stringify(payload, null, 2);
      } catch (error) {
        resultEl.textContent = error.message;
      }
    });
  </script>
</body>
</html>`;
  }

  private async findGoogleIntegration(tenantId: string, integrationId?: string) {
    const integration = await this.prisma.integration.findFirst({
      where: integrationId
        ? {
            id: integrationId,
            tenantId,
            provider: IntegrationProvider.GOOGLE,
          }
        : {
            tenantId,
            provider: IntegrationProvider.GOOGLE,
          },
    });

    if (!integration) {
      throw new NotFoundException('Google integration is not configured for this tenant');
    }

    return integration;
  }

  private readGoogleConfig(configEncrypted?: string | null) {
    if (!configEncrypted) {
      throw new BadRequestException('Google integration credentials are missing');
    }

    return this.cryptoService.decryptJson<GoogleIntegrationConfig>(configEncrypted);
  }

  private resolveGoogleConfig(
    dto: GoogleConnectDto,
    defaults?: { adminEmail?: string; domain?: string },
  ): GoogleIntegrationConfig {
    const adminEmail = dto.adminEmail ?? defaults?.adminEmail ?? process.env.GOOGLE_ADMIN_EMAIL;
    const domain = dto.domain ?? defaults?.domain ?? process.env.GOOGLE_DOMAIN;
    const rawServiceAccountKey =
      dto.serviceAccountKeyJson ?? process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!rawServiceAccountKey || !adminEmail || !domain) {
      throw new BadRequestException(
        'Google integration requires service account key JSON, admin email, and domain',
      );
    }

    const parsed = JSON.parse(rawServiceAccountKey) as {
      client_email?: string;
      private_key?: string;
    };

    if (!parsed.client_email || !parsed.private_key) {
      throw new BadRequestException('Invalid Google service account key JSON');
    }

    return {
      serviceAccountKey: {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      },
      adminEmail: adminEmail.toLowerCase(),
      domain: domain.toLowerCase(),
    };
  }

  private assertTrustedGoogleConnection(
    actor: RequestUser,
    tenantPrimaryDomain: string | null,
    config: GoogleIntegrationConfig,
  ) {
    if (!tenantPrimaryDomain) {
      throw new BadRequestException(
        'Complete Google OAuth admin verification before connecting the service account',
      );
    }

    const trustedDomain = tenantPrimaryDomain.toLowerCase();
    const actorDomain = actor.email.split('@')[1]?.toLowerCase();
    const adminDomain = config.adminEmail.split('@')[1]?.toLowerCase();

    if (!actorDomain || actorDomain !== trustedDomain) {
      throw new BadRequestException(
        'The signed-in Google admin does not match the verified tenant domain',
      );
    }

    if (config.domain !== trustedDomain) {
      throw new BadRequestException('Google Workspace domain does not match the verified tenant');
    }

    if (!adminDomain || adminDomain !== trustedDomain) {
      throw new BadRequestException(
        'Delegated Google admin email must belong to the verified tenant domain',
      );
    }

    if (config.adminEmail !== actor.email.toLowerCase() && actor.role !== Role.PLATFORM_ADMIN) {
      throw new BadRequestException(
        'Delegated Google admin email must match the verified Google login for this tenant',
      );
    }
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async markIntegrationSynced(integrationId: string, recordCount: number) {
    await this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        status: IntegrationStatus.CONNECTED,
        lastSyncAt: new Date(),
        lastSyncStatus: `OK (${recordCount})`,
        lastSyncError: null,
      },
    });
  }

  private async removeStaleExternalIdentities(
    tenantId: string,
    integrationId: string,
    syncedExternalIds: Set<string>,
  ) {
    const existing = await this.prisma.externalIdentity.findMany({
      where: {
        tenantId,
        integrationId,
      },
      select: {
        id: true,
        externalId: true,
      },
    });

    const staleIds = existing
      .filter((identity) => !syncedExternalIds.has(identity.externalId))
      .map((identity) => identity.id);

    if (staleIds.length === 0) {
      return;
    }

    await this.prisma.externalIdentity.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  private async removeStaleGroups(
    tenantId: string,
    integrationId: string,
    syncedGroupExternalIds: Set<string>,
  ) {
    const existing = await this.prisma.externalGroup.findMany({
      where: { tenantId, integrationId },
      select: { id: true, externalId: true },
    });

    const staleIds = existing
      .filter((group) => !syncedGroupExternalIds.has(group.externalId))
      .map((group) => group.id);

    if (staleIds.length === 0) {
      return;
    }

    await this.prisma.externalGroup.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  private async removeStaleMemberships(
    tenantId: string,
    integrationId: string,
    syncedMembershipKeys: Set<string>,
  ) {
    const existing = await this.prisma.externalGroupMembership.findMany({
      where: { tenantId, integrationId },
      select: {
        id: true,
        externalGroupId: true,
        memberExternalId: true,
      },
    });

    const staleIds = existing
      .filter(
        (membership) =>
          !syncedMembershipKeys.has(
            `${membership.externalGroupId}:${membership.memberExternalId}`,
          ),
      )
      .map((membership) => membership.id);

    if (staleIds.length === 0) {
      return;
    }

    await this.prisma.externalGroupMembership.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  private toPublicIntegration(integration: {
    id: string;
    tenantId: string;
    provider: IntegrationProvider;
    name: string;
    status: IntegrationStatus;
    externalDomain: string | null;
    scopes: string[];
    metadata: Prisma.JsonValue;
    lastSyncAt: Date | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
    lastHealthCheckAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: integration.id,
      tenantId: integration.tenantId,
      provider: integration.provider,
      name: integration.name,
      status: integration.status,
      externalDomain: integration.externalDomain,
      scopes: integration.scopes,
      metadata: integration.metadata,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncError: integration.lastSyncError,
      lastHealthCheckAt: integration.lastHealthCheckAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }
}

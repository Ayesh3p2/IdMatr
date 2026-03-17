import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateTenantDto, UpdateTenantDto, UpdateTenantSettingsDto,
  UpsertIntegrationDto, CreateApiKeyDto, SUPPORTED_FRAMEWORKS,
} from './dto/create-tenant.dto.js';
import { EmailService } from '../email/email.service.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { EnvelopeEncryptionService } from '../security/envelope-encryption.service.js';
import { TENANT_ADMIN_ROLE } from '../security/roles.js';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private auditLog: AuditLogService,
    private encryption: EnvelopeEncryptionService,
  ) {}

  // ─── Tenant CRUD ────────────────────────────────────────────────────────────

  async create(dto: CreateTenantDto, operatorId: string) {
    // ── Part 1 + 2: Required field validation ─────────────────────────────────
    const errors: string[] = [];

    if (!dto.name?.trim()) {
      errors.push('tenant_name is required');
    }

    if (!dto.adminEmail?.trim()) {
      errors.push('admin_email is required — a Tenant Super Admin will be provisioned at this address');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.adminEmail.trim())) {
      errors.push('admin_email must be a valid email address');
    }

    if (!dto.frameworks || dto.frameworks.length === 0) {
      errors.push(
        `compliance_frameworks is required — select at least one: ${SUPPORTED_FRAMEWORKS.join(', ')}`
      );
    } else {
      const invalid = dto.frameworks.filter(
        f => !SUPPORTED_FRAMEWORKS.map(s => s.toLowerCase()).includes(f.toLowerCase()),
      );
      if (invalid.length > 0) {
        errors.push(
          `unsupported compliance frameworks: ${invalid.join(', ')}. ` +
          `Supported: ${SUPPORTED_FRAMEWORKS.join(', ')}`
        );
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Onboarding validation failed', errors });
    }

    // Normalise inputs
    dto.adminEmail = dto.adminEmail.trim().toLowerCase();
    dto.frameworks = dto.frameworks.map(f => f.toUpperCase());

    // Auto-generate slug from name if not provided
    if (!dto.slug) {
      dto.slug = dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 48);
    }

    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Tenant slug "${dto.slug}" already exists`);

    // ── Part 6: Tenant starts in PENDING state ─────────────────────────────────
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        domain: dto.domain,
        plan: dto.plan || 'starter',
        region: dto.region || 'us-east-1',
        status: 'PENDING',                       // ← PENDING until onboarding completes
        settings: {
          create: {
            frameworks: dto.frameworks,           // persist compliance frameworks
            discoveryEnabled: true,
          },
        },
        integrations: {
          create: [
            { provider: 'GOOGLE_WORKSPACE', status: 'PENDING', enabled: false },
            { provider: 'MICROSOFT_365',    status: 'PENDING', enabled: false },
            { provider: 'SLACK',            status: 'PENDING', enabled: false },
            { provider: 'GITHUB',           status: 'PENDING', enabled: false },
          ],
        },
      },
      include: { settings: true, integrations: true },
    });

    // ── Part 10: Audit — tenant created ───────────────────────────────────────
    await this.audit(operatorId, tenant.id, 'tenant.created', 'tenant', 'info',
      `Tenant "${tenant.name}" (${tenant.slug}) created with status PENDING`,
      { plan: tenant.plan, region: tenant.region, frameworks: dto.frameworks });

    // ── Part 3: Provision Tenant Super Admin ──────────────────────────────────
    let adminCreated = false;
    let onboardingUrl: string | undefined;
    let adminUser: { id: string; email: string; name: string } | undefined;

    const placeholderPasswordHash = await bcrypt.hash(this.generateOpaqueSecret(), 12);

    const adminName = dto.adminEmail.split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    try {
      adminUser = await this.prisma.tenantUser.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail,
          name: adminName,
          passwordHash: placeholderPasswordHash,
          role: TENANT_ADMIN_ROLE,
          forcePasswordChange: true,
        },
        select: { id: true, email: true, name: true },
      });

      onboardingUrl = await this.issueOnboardingLink(tenant.id, adminUser.id, operatorId);
      adminCreated = true;
      this.logger.log(`Tenant super-admin provisioned: ${dto.adminEmail} for tenant ${tenant.slug}`);

      // ── Part 10: Audit — super admin created ──────────────────────────────
      await this.audit(operatorId, tenant.id, 'super_admin_created', 'tenant', 'info',
        `Super-admin "${dto.adminEmail}" provisioned for tenant "${tenant.name}"`,
        { adminEmail: dto.adminEmail });
    } catch (err: any) {
      this.logger.error(`Failed to provision tenant admin for ${tenant.slug}: ${err.message}`);
      // Non-fatal — tenant was created, admin provisioning failed
    }

    // ── Part 4: Send welcome email (async, non-blocking) ──────────────────────
    const loginUrl = process.env.TENANT_PORTAL_URL || process.env.NEXT_PUBLIC_API_URL?.replace('3001', '3000') || 'http://localhost:3000';

    if (adminCreated && onboardingUrl) {
      this.email.sendWelcomeEmail({
        tenantName: tenant.name,
        adminEmail: dto.adminEmail,
        adminName: adminUser!.name,
        onboardingUrl,
        frameworks: dto.frameworks,
      }).then(sent => {
        if (sent) {
          this.audit(operatorId, tenant.id, 'welcome_email_sent', 'tenant', 'info',
            `Welcome email sent to ${dto.adminEmail}`, { adminEmail: dto.adminEmail })
            .catch(() => {});
        }
      }).catch(() => {});
    }

    this.logger.log(`Tenant created: ${tenant.slug} (${tenant.id}) — status: PENDING`);

    return {
      ...tenant,
      adminCreated,
      ...(adminCreated && {
        adminEmail: dto.adminEmail,
        onboardingUrl,
        adminUserId: adminUser?.id,
        onboardingNote: [
          'Tenant is in PENDING status until the super-admin completes onboarding.',
          'The onboarding link is valid for 15 minutes and can be used only once.',
          'Admin must set a compliant password before the tenant becomes ACTIVE.',
        ].join(' '),
      }),
    };
  }

  // ── Part 8: Hard Delete ────────────────────────────────────────────────────

  /**
   * Permanently delete a tenant and all associated data.
   * Requires `confirm = 'permanently-delete'` to prevent accidental deletion.
   */
  async hardDelete(tenantId: string, confirm: string, operatorId: string) {
    if (confirm !== 'permanently-delete') {
      throw new BadRequestException(
        'Hard delete requires confirm="permanently-delete". ' +
        'This action is IRREVERSIBLE and will destroy all tenant data.'
      );
    }

    const tenant = await this.findOne(tenantId);

    // Delete all related data (cascade handles most, but explicit for audit trail)
    this.logger.warn(
      `HARD DELETE initiated for tenant "${tenant.name}" (${tenantId}) by operator ${operatorId}`
    );

    // Audit log BEFORE deletion (so the log persists temporarily via cascade)
    await this.audit(operatorId, tenantId, 'tenant_deleted', 'tenant', 'critical',
      `Tenant "${tenant.name}" permanently deleted by operator`,
      { tenantName: tenant.name, slug: tenant.slug, plan: tenant.plan });

    // Prisma cascade handles related records (tenantUsers, integrations, apiKeys, etc.)
    await this.prisma.tenant.delete({ where: { id: tenantId } });

    this.logger.warn(`Tenant "${tenant.name}" (${tenantId}) permanently deleted`);
    return {
      success: true,
      message: `Tenant "${tenant.name}" has been permanently deleted`,
      deletedTenantId: tenantId,
    };
  }

  // ── Part 9: Regenerate Onboarding ─────────────────────────────────────────

  /**
   * Regenerate temporary password + resend welcome email.
   * Useful when admin missed the initial email or the temp password expired.
   */
  async regenerateOnboarding(tenantId: string, operatorId: string) {
    const tenant = await this.findOne(tenantId);

    // Find the super admin
    const superAdmin = await this.prisma.tenantUser.findFirst({
      where: { tenantId, role: TENANT_ADMIN_ROLE, isActive: true },
    });

    if (!superAdmin) {
      throw new NotFoundException(`No active Tenant Super Admin found for tenant ${tenant.name}`);
    }

    const passwordHash = await bcrypt.hash(this.generateOpaqueSecret(), 12);

    // Reset password + re-enable force change flag
    await this.prisma.tenantUser.update({
      where: { id: superAdmin.id },
      data: {
        passwordHash,
        forcePasswordChange: true,
        updatedAt: new Date(),
      },
    });

    // If tenant was somehow stuck in PENDING, keep it there (must re-complete onboarding)
    // If tenant was ACTIVE, reset to PENDING so they re-complete the flow
    if (tenant.status === 'ACTIVE') {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'PENDING',
          onboardingCompletedAt: null,
        },
      });
    }

    const loginUrl = process.env.TENANT_PORTAL_URL || 'http://localhost:3000';
    const onboardingUrl = await this.issueOnboardingLink(tenantId, superAdmin.id, operatorId);

    // ── Part 10: Audit ────────────────────────────────────────────────────────
    await this.audit(operatorId, tenantId, 'onboarding_link_regenerated', 'tenant', 'warning',
      `Onboarding credentials regenerated for ${superAdmin.email} by operator`,
      { adminEmail: superAdmin.email });

    // Send regenerated credentials email (async, non-blocking)
    this.email.sendRegeneratedCredentialsEmail({
      tenantName: tenant.name,
      adminEmail: superAdmin.email,
      adminName: superAdmin.name,
      onboardingUrl,
      loginUrl,
    }).then(() => {}).catch(() => {});

    this.logger.log(`Onboarding regenerated for tenant ${tenant.slug} (${superAdmin.email})`);

    return {
      success: true,
      message: `New onboarding link generated for ${superAdmin.email}`,
      adminEmail: superAdmin.email,
      onboardingUrl,
      tenantStatus: tenant.status === 'ACTIVE' ? 'PENDING' : tenant.status,
      note: 'Welcome email has been resent. Tenant must complete onboarding again to become ACTIVE.',
    };
  }

  async findAll(filters?: { status?: string; plan?: string; search?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.plan) where.plan = filters.plan;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { domain: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      include: {
        settings: { select: { discoveryEnabled: true, frameworks: true, ssoEnforced: true } },
        integrations: { select: { provider: true, status: true, enabled: true, lastSyncAt: true } },
        _count: { select: { apiKeys: true, tenantUsers: true } },
        healthMetrics: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map(t => ({
      ...t,
      latestHealth: t.healthMetrics[0] || null,
      healthMetrics: undefined,
    }));
  }

  async findOne(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        settings: true,
        integrations: true,
        apiKeys: {
          where: { isActive: true },
          select: { id: true, name: true, keyPrefix: true, scopes: true, expiresAt: true, lastUsedAt: true, createdAt: true },
        },
        tenantUsers: {
          select: { id: true, email: true, name: true, role: true, isActive: true, forcePasswordChange: true, lastLogin: true, createdAt: true },
        },
        healthMetrics: {
          orderBy: { recordedAt: 'desc' },
          take: 24,
        },
      },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    return {
      ...tenant,
      integrations: tenant.integrations.map((integration) => ({
        ...integration,
        configJson: integration.configJson ? '[ENCRYPTED]' : null,
      })),
    };
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException(`Tenant slug "${slug}" not found`);
    return tenant;
  }

  async update(tenantId: string, dto: UpdateTenantDto, operatorId: string) {
    const tenant = await this.findOne(tenantId);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.domain !== undefined) data.domain = dto.domain;
    if (dto.plan !== undefined) data.plan = dto.plan;

    const updated = await this.prisma.tenant.update({ where: { id: tenantId }, data });
    await this.audit(operatorId, tenantId, 'tenant.updated', 'tenant', 'info',
      `Tenant "${tenant.name}" updated`, dto);
    return updated;
  }

  async suspend(tenantId: string, reason: string, operatorId: string) {
    const tenant = await this.findOne(tenantId);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'SUSPENDED', suspendedAt: new Date(), suspendReason: reason },
    });
    // ── Part 10: Audit ────────────────────────────────────────────────────────
    await this.audit(operatorId, tenantId, 'tenant_suspended', 'tenant', 'warning',
      `Tenant "${tenant.name}" suspended: ${reason}`, { reason });
    return { success: true };
  }

  async activate(tenantId: string, operatorId: string) {
    const tenant = await this.findOne(tenantId);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'ACTIVE', suspendedAt: null, suspendReason: null },
    });
    await this.audit(operatorId, tenantId, 'tenant.activated', 'tenant', 'info',
      `Tenant "${tenant.name}" activated by operator`, {});
    return { success: true };
  }

  async offboard(tenantId: string, operatorId: string) {
    const tenant = await this.findOne(tenantId);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'OFFBOARDED' },
    });
    await this.audit(operatorId, tenantId, 'tenant.offboarded', 'tenant', 'warning',
      `Tenant "${tenant.name}" offboarded`, {});
    return { success: true };
  }

  /**
   * Called by AuthService after a TENANT_SUPER_ADMIN completes first password change.
   * Transitions tenant from PENDING → ACTIVE and sets onboardingCompletedAt.
   */
  async completeOnboarding(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.status !== 'PENDING') return; // already active or doesn't exist

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'ACTIVE',
        onboardingCompletedAt: new Date(),
      },
    });

    this.logger.log(`Tenant "${tenant.name}" (${tenantId}) → ACTIVE (onboarding completed)`);
  }

  // ─── Settings ───────────────────────────────────────────────────────────────

  async getSettings(tenantId: string) {
    await this.findOne(tenantId);
    return this.prisma.tenantSettings.findUnique({ where: { tenantId } });
  }

  async updateSettings(tenantId: string, dto: UpdateTenantSettingsDto, operatorId: string) {
    await this.findOne(tenantId);
    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });
    await this.audit(operatorId, tenantId, 'tenant.settings.updated', 'tenant', 'info',
      'Tenant settings updated', Object.keys(dto));
    return settings;
  }

  // ─── Integrations ────────────────────────────────────────────────────────────

  async getIntegrations(tenantId: string) {
    await this.findOne(tenantId);
    const integrations = await this.prisma.tenantIntegration.findMany({ where: { tenantId } });
    return integrations.map((integration) => ({
      ...integration,
      configJson: integration.configJson ? '[ENCRYPTED]' : null,
    }));
  }

  async upsertIntegration(tenantId: string, dto: UpsertIntegrationDto, operatorId: string) {
    await this.findOne(tenantId);
    const encryptedConfig = dto.configJson
      ? this.encryption.encryptString(dto.configJson)
      : dto.configJson;
    const integration = await this.prisma.tenantIntegration.upsert({
      where: { tenantId_provider: { tenantId, provider: dto.provider as any } },
      create: {
        tenantId,
        provider: dto.provider as any,
        enabled: dto.enabled,
        status: dto.enabled ? 'ACTIVE' : 'DISABLED',
        configJson: encryptedConfig,
      },
      update: {
        enabled: dto.enabled,
        status: dto.enabled ? 'ACTIVE' : 'DISABLED',
        ...(dto.configJson !== undefined && { configJson: encryptedConfig }),
      },
    });
    await this.audit(operatorId, tenantId, 'integration.updated', 'integration',
      dto.enabled ? 'info' : 'warning',
      `Integration ${dto.provider} ${dto.enabled ? 'enabled' : 'disabled'}`,
      { provider: dto.provider, enabled: dto.enabled });
    return {
      ...integration,
      configJson: integration.configJson ? '[ENCRYPTED]' : null,
    };
  }

  async triggerIntegrationSync(tenantId: string, provider: string, operatorId: string) {
    await this.findOne(tenantId);
    await this.prisma.tenantIntegration.updateMany({
      where: { tenantId, provider: provider as any },
      data: { lastSyncAt: new Date(), syncCount: { increment: 1 } },
    });
    await this.audit(operatorId, tenantId, 'integration.sync_triggered', 'integration', 'info',
      `Manual sync triggered for ${provider}`, { provider });
    return { success: true, message: `Sync triggered for ${provider}` };
  }

  // ─── API Keys ───────────────────────────────────────────────────────────────

  async createApiKey(tenantId: string, dto: CreateApiKeyDto, operatorId: string) {
    await this.findOne(tenantId);
    const rawKey = `idm_${crypto.randomBytes(20).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const key = await this.prisma.tenantApiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyPrefix,
        keyHash,
        scopes: dto.scopes || ['read:identities', 'read:applications'],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    await this.audit(operatorId, tenantId, 'api-key.created', 'api-key', 'info',
      `API key "${dto.name}" created (${keyPrefix}...)`, { name: dto.name, scopes: dto.scopes });

    return { ...key, key: rawKey };
  }

  async revokeApiKey(tenantId: string, keyId: string, operatorId: string) {
    const key = await this.prisma.tenantApiKey.findFirst({ where: { id: keyId, tenantId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.tenantApiKey.update({ where: { id: keyId }, data: { isActive: false } });
    await this.audit(operatorId, tenantId, 'api-key.revoked', 'api-key', 'warning',
      `API key "${key.name}" revoked`, { keyId, name: key.name });
    return { success: true };
  }

  // ─── Health Metrics ──────────────────────────────────────────────────────────

  async getHealth(tenantId: string) {
    await this.findOne(tenantId);
    const metrics = await this.prisma.tenantHealthMetric.findMany({
      where: { tenantId },
      orderBy: { recordedAt: 'desc' },
      take: 24,
    });
    const latest = metrics[0];
    return { tenantId, latest, history: metrics };
  }

  async exportTenantData(tenantId: string) {
    const tenant = await this.findOne(tenantId);
    const auditLogs = await this.prisma.operatorAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    return {
      exportedAt: new Date().toISOString(),
      tenant,
      auditLogs: auditLogs.map((log) => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      })),
      retention: {
        dataRetentionDays: tenant.settings?.dataRetentionDays ?? 365,
        deletionGraceDays: tenant.settings?.deletionGraceDays ?? 30,
      },
    };
  }

  async recordHealthMetric(tenantId: string, data: Partial<{
    userCount: number; appCount: number; riskEventCount: number;
    auditLogCount: number; apiCallCount: number; discoveryJobCount: number;
    errorCount: number; avgRiskScore: number; status: string;
  }>) {
    return this.prisma.tenantHealthMetric.create({ data: { tenantId, ...data } });
  }

  // ─── Platform Summary ────────────────────────────────────────────────────────

  async getPlatformStats() {
    const [total, byStatus, byPlan, recentTenants] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.tenant.groupBy({ by: ['plan'], _count: { id: true } }),
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, plan: true, status: true, createdAt: true },
      }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map(s => [s.status, s._count.id]));
    const planMap   = Object.fromEntries(byPlan.map(p => [p.plan, p._count.id]));

    return {
      total,
      active:    statusMap['ACTIVE']     || 0,
      suspended: statusMap['SUSPENDED']  || 0,
      trial:     statusMap['TRIAL']      || 0,
      pending:   statusMap['PENDING']    || 0,
      byPlan:    planMap,
      recentTenants,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private generateOpaqueSecret(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  private async issueOnboardingLink(tenantId: string, tenantUserId: string, operatorId: string) {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.onboardingToken.updateMany({
      where: { tenantUserId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    await this.prisma.onboardingToken.create({
      data: {
        tenantId,
        tenantUserId,
        tokenHash,
        expiresAt,
        createdByOperatorId: operatorId,
      },
    });

    const baseUrl = process.env.TENANT_PORTAL_URL || 'http://localhost:3000';
    return `${baseUrl}/onboarding?token=${encodeURIComponent(token)}`;
  }

  private async audit(
    operatorId: string, tenantId: string | null,
    action: string, category: string, severity: string,
    description: string, metadata?: any,
  ) {
    await this.auditLog.write({
      operatorId,
      tenantId,
      action,
      category,
      severity,
      description,
      metadata: metadata || null,
    });
  }
}

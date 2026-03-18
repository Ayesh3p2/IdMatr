import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { randomDate, randomInt, hashPassword } from './base';

const prisma = new PrismaClient();

const NOW = new Date();
const SIX_MONTHS_AGO = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000);

const OPERATOR_ACTIONS = [
  { action: 'tenant.created', category: 'tenant', severity: 'info' },
  { action: 'tenant.updated', category: 'tenant', severity: 'info' },
  { action: 'tenant.suspended', category: 'tenant', severity: 'warning' },
  { action: 'tenant.activated', category: 'tenant', severity: 'info' },
  { action: 'tenant.deleted', category: 'tenant', severity: 'critical' },
  { action: 'integration.enabled', category: 'integration', severity: 'info' },
  { action: 'integration.disabled', category: 'integration', severity: 'warning' },
  { action: 'integration.sync_completed', category: 'integration', severity: 'info' },
  { action: 'integration.sync_failed', category: 'integration', severity: 'error' },
  { action: 'api_key.created', category: 'api-key', severity: 'info' },
  { action: 'api_key.revoked', category: 'api-key', severity: 'warning' },
  { action: 'settings.updated', category: 'system', severity: 'info' },
  { action: 'auth.operator.login', category: 'auth', severity: 'info' },
  { action: 'auth.operator.login_failed', category: 'auth', severity: 'warning' },
  { action: 'access_review.started', category: 'system', severity: 'info' },
  { action: 'access_review.completed', category: 'system', severity: 'info' },
];

const USER_ACTIONS = [
  { action: 'user.login', category: 'auth', severity: 'info' },
  { action: 'user.login_failed', category: 'auth', severity: 'warning' },
  { action: 'user.mfa_enabled', category: 'auth', severity: 'info' },
  { action: 'user.mfa_disabled', category: 'auth', severity: 'warning' },
  { action: 'user.role_changed', category: 'tenant', severity: 'warning' },
  { action: 'user.created', category: 'tenant', severity: 'info' },
  { action: 'user.deactivated', category: 'tenant', severity: 'warning' },
  { action: 'user.deleted', category: 'tenant', severity: 'critical' },
  { action: 'consent.recorded', category: 'privacy', severity: 'info' },
  { action: 'data.request_received', category: 'privacy', severity: 'info' },
  { action: 'data.request_completed', category: 'privacy', severity: 'info' },
  { action: 'data.export_generated', category: 'privacy', severity: 'info' },
];

interface AuditLogSeed {
  operatorId: string | null;
  tenantId: string | null;
  action: string;
  category: string;
  severity: string;
  description: string;
  metadata: string | null;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export async function seedOperatorAuditLogs(count: number = 50000): Promise<AuditLogSeed[]> {
  console.log(`Seeding ${count} operator audit logs...`);
  
  const logs: AuditLogSeed[] = [];
  const operatorIds = Array.from({ length: 5 }, (_, i) => `op-${i}`);
  const tenantIds = Array.from({ length: 100 }, (_, i) => `tenant-seed-${i}`);

  for (let i = 0; i < count; i++) {
    const template = faker.helpers.arrayElement(OPERATOR_ACTIONS);
    const tenantId = template.category !== 'system' ? faker.helpers.arrayElement(tenantIds) : null;
    
    logs.push({
      operatorId: faker.helpers.arrayElement(operatorIds),
      tenantId,
      action: template.action,
      category: template.category,
      severity: template.severity,
      description: `Operator performed ${template.action} on ${tenantId || 'system'}`,
      metadata: JSON.stringify({ resourceId: faker.string.uuid(), oldValue: null, newValue: null }),
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      createdAt: randomDate(SIX_MONTHS_AGO, NOW)
    });

    if ((i + 1) % 10000 === 0) {
      console.log(`  Generated ${i + 1}/${count} logs...`);
    }
  }

  return logs;
}

export async function seedUserAuditLogs(count: number = 50000): Promise<AuditLogSeed[]> {
  console.log(`Seeding ${count} user audit logs...`);
  
  const logs: AuditLogSeed[] = [];
  const tenantIds = Array.from({ length: 100 }, (_, i) => `tenant-seed-${i}`);

  for (let i = 0; i < count; i++) {
    const template = faker.helpers.arrayElement(USER_ACTIONS);
    const tenantId = faker.helpers.arrayElement(tenantIds);
    const userCount = randomInt(20, 200);
    const userId = `user-${Math.floor(Math.random() * 100)}-${randomInt(0, userCount)}`;
    
    logs.push({
      operatorId: null,
      tenantId,
      action: template.action,
      category: template.category,
      severity: template.severity,
      description: `User ${userId} performed ${template.action}`,
      metadata: JSON.stringify({ userId, tenantId }),
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      createdAt: randomDate(SIX_MONTHS_AGO, NOW)
    });

    if ((i + 1) % 10000 === 0) {
      console.log(`  Generated ${i + 1}/${count} logs...`);
    }
  }

  return logs;
}

export async function insertAuditLogsBatch(logs: AuditLogSeed[]): Promise<void> {
  console.log('Inserting audit logs...');
  
  for (let i = 0; i < logs.length; i += 1000) {
    const batch = logs.slice(i, i + 1000);
    await prisma.operatorAuditLog.createMany({
      data: batch.map(log => ({
        ...log,
        entryHash: `hash-${i}-${Math.random().toString(36).substr(2, 9)}`
      })),
      skipDuplicates: true
    });
    console.log(`  Inserted ${Math.min(i + 1000, logs.length)}/${logs.length} audit logs`);
  }
}

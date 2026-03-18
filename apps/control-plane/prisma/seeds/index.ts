import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { hashPassword, randomInt, randomDate } from './base';
import { seedTenants, seedTenantSettings, insertTenantsBatch, insertTenantUsersBatch } from './tenant.seeder';
import { seedOperatorAuditLogs, seedUserAuditLogs, insertAuditLogsBatch } from './audit.seeder';
import { seedIntegrations, seedHealthMetrics, seedApiKeys, insertIntegrationsBatch, insertHealthMetricsBatch, insertApiKeysBatch } from './integration.seeder';

const prisma = new PrismaClient();

const BATCH_SIZE = 500;
const NOW = new Date();
const SIX_MONTHS_AGO = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000);

interface SeedStats {
  operators: number;
  tenants: number;
  tenantUsers: number;
  integrations: number;
  apiKeys: number;
  healthMetrics: number;
  operatorAuditLogs: number;
  userAuditLogs: number;
  total: number;
}

async function truncateTables(): Promise<void> {
  console.log('Truncating existing data...');
  
  await prisma.operatorAuditLog.deleteMany({});
  await prisma.tenantHealthMetric.deleteMany({});
  await prisma.tenantApiKey.deleteMany({});
  await prisma.tenantIntegration.deleteMany({});
  await prisma.tenantSettings.deleteMany({});
  await prisma.tenantUser.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.operator.deleteMany({});
  
  console.log('All tables truncated.\n');
}

async function seedOperators(): Promise<void> {
  console.log('Seeding platform operators...');
  
  const passwordHash = await hashPassword('Admin@123');
  
  const operators = [
    {
      id: 'op-0',
      email: 'superadmin@idmatr.io',
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      mfaEnabled: true,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'op-1',
      email: 'admin@idmatr.io',
      name: 'Platform Admin',
      passwordHash,
      role: 'ADMIN',
      mfaEnabled: false,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'op-2',
      email: 'support@idmatr.io',
      name: 'Support Engineer',
      passwordHash,
      role: 'SUPPORT',
      mfaEnabled: false,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'op-3',
      email: 'auditor@idmatr.io',
      name: 'Compliance Auditor',
      passwordHash,
      role: 'AUDITOR',
      mfaEnabled: true,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW
    },
    {
      id: 'op-4',
      email: 'readonly@idmatr.io',
      name: 'Read Only User',
      passwordHash,
      role: 'READONLY_ADMIN',
      mfaEnabled: false,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW
    }
  ];

  await prisma.operator.createMany({ data: operators, skipDuplicates: true });
  console.log(`  Created ${operators.length} operators\n`);
}

async function runSeed(env: 'dev' | 'staging' | 'prod'): Promise<SeedStats> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`IDMatr Data Seeding - ${env.toUpperCase()} Environment`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();
  const stats: SeedStats = {
    operators: 0,
    tenants: 0,
    tenantUsers: 0,
    integrations: 0,
    apiKeys: 0,
    healthMetrics: 0,
    operatorAuditLogs: 0,
    userAuditLogs: 0,
    total: 0
  };

  try {
    await truncateTables();
    await seedOperators();
    stats.operators = 5;

    const tenantCount = env === 'prod' ? 100 : env === 'staging' ? 50 : 20;
    const auditCount = env === 'prod' ? 100000 : env === 'staging' ? 20000 : 5000;
    const metricsCount = env === 'prod' ? 10000 : env === 'staging' ? 5000 : 1000;

    const { tenants, users } = await seedTenants(tenantCount);
    stats.tenants = tenants.length;
    stats.tenantUsers = users.length;

    console.log('Inserting tenants...');
    await insertTenantsBatch(tenants);
    console.log('');

    console.log('Inserting tenant users...');
    await insertTenantUsersBatch(users);
    console.log('');

    console.log('Inserting tenant settings...');
    const settings = await seedTenantSettings(tenants);
    await prisma.tenantSettings.createMany({
      data: settings,
      skipDuplicates: true
    });
    console.log('');

    console.log('Seeding integrations...');
    const integrations = await seedIntegrations(Math.floor(tenantCount * 3));
    stats.integrations = integrations.length;
    await insertIntegrationsBatch(integrations);
    console.log('');

    console.log('Seeding API keys...');
    const apiKeys = await seedApiKeys(tenantCount * 5);
    stats.apiKeys = apiKeys.length;
    await insertApiKeysBatch(apiKeys);
    console.log('');

    console.log('Seeding health metrics...');
    const healthMetrics = await seedHealthMetrics(metricsCount);
    stats.healthMetrics = healthMetrics.length;
    await insertHealthMetricsBatch(healthMetrics);
    console.log('');

    console.log('Seeding operator audit logs...');
    const operatorLogs = await seedOperatorAuditLogs(Math.floor(auditCount / 2));
    stats.operatorAuditLogs = operatorLogs.length;
    await insertAuditLogsBatch(operatorLogs);
    console.log('');

    console.log('Seeding user audit logs...');
    const userLogs = await seedUserAuditLogs(Math.floor(auditCount / 2));
    stats.userAuditLogs = userLogs.length;
    await insertAuditLogsBatch(userLogs);
    console.log('');

    stats.total = Object.values(stats).reduce((a, b) => a + b, 0);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`${'='.repeat(60)}`);
    console.log('SEEDING COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`Duration: ${duration.toFixed(1)}s`);
    console.log('\nRecords Created:');
    console.log(`  Operators:        ${stats.operators.toLocaleString()}`);
    console.log(`  Tenants:          ${stats.tenants.toLocaleString()}`);
    console.log(`  Tenant Users:     ${stats.tenantUsers.toLocaleString()}`);
    console.log(`  Integrations:     ${stats.integrations.toLocaleString()}`);
    console.log(`  API Keys:         ${stats.apiKeys.toLocaleString()}`);
    console.log(`  Health Metrics:   ${stats.healthMetrics.toLocaleString()}`);
    console.log(`  Operator Logs:    ${stats.operatorAuditLogs.toLocaleString()}`);
    console.log(`  User Logs:        ${stats.userAuditLogs.toLocaleString()}`);
    console.log(`  ─────────────────────────`);
    console.log(`  TOTAL:            ${stats.total.toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);

    return stats;

  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const env = (process.argv[2] || 'dev') as 'dev' | 'staging' | 'prod';
runSeed(env)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

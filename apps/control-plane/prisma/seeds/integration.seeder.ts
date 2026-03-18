import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { randomDate, randomInt, INTEGRATION_PROVIDERS } from './base';

const prisma = new PrismaClient();

const NOW = new Date();
const SIX_MONTHS_AGO = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000);

interface IntegrationSeed {
  tenantId: string;
  provider: string;
  status: string;
  enabled: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  syncCount: number;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface HealthMetricSeed {
  tenantId: string;
  recordedAt: Date;
  userCount: number;
  appCount: number;
  riskEventCount: number;
  auditLogCount: number;
  apiCallCount: number;
  discoveryJobCount: number;
  errorCount: number;
  avgRiskScore: number;
  status: string;
}

interface ApiKeySeed {
  tenantId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export async function seedIntegrations(count: number = 300): Promise<IntegrationSeed[]> {
  console.log(`Seeding ${count} tenant integrations...`);
  
  const integrations: IntegrationSeed[] = [];
  const tenantIds = Array.from({ length: 100 }, (_, i) => `tenant-seed-${i}`);

  for (let i = 0; i < count; i++) {
    const tenantId = faker.helpers.arrayElement(tenantIds);
    const provider = faker.helpers.arrayElement(INTEGRATION_PROVIDERS);
    const enabled = faker.datatype.boolean(0.7);
    const lastSyncAt = enabled ? randomDate(SIX_MONTHS_AGO, NOW) : null;
    
    integrations.push({
      tenantId,
      provider,
      status: enabled ? (faker.datatype.boolean(0.9) ? 'ACTIVE' : 'ERROR') : 'DISABLED',
      enabled,
      lastSyncAt,
      lastSyncStatus: lastSyncAt ? (faker.datatype.boolean(0.85) ? 'success' : 'error') : null,
      syncCount: randomInt(0, 500),
      errorCount: randomInt(0, 20),
      createdAt: randomDate(SIX_MONTHS_AGO, NOW),
      updatedAt: NOW
    });
  }

  return integrations;
}

export async function seedHealthMetrics(count: number = 10000): Promise<HealthMetricSeed[]> {
  console.log(`Seeding ${count} health metrics...`);
  
  const metrics: HealthMetricSeed[] = [];
  const tenantIds = Array.from({ length: 100 }, (_, i) => `tenant-seed-${i}`);

  for (let i = 0; i < count; i++) {
    const tenantId = faker.helpers.arrayElement(tenantIds);
    const avgRiskScore = randomInt(10, 95);
    
    metrics.push({
      tenantId,
      recordedAt: randomDate(SIX_MONTHS_AGO, NOW),
      userCount: randomInt(50, 5000),
      appCount: randomInt(5, 100),
      riskEventCount: randomInt(0, 100),
      auditLogCount: randomInt(100, 10000),
      apiCallCount: randomInt(1000, 100000),
      discoveryJobCount: randomInt(0, 50),
      errorCount: randomInt(0, 50),
      avgRiskScore,
      status: avgRiskScore > 80 ? 'critical' : avgRiskScore > 60 ? 'degraded' : 'healthy'
    });

    if ((i + 1) % 2000 === 0) {
      console.log(`  Generated ${i + 1}/${count} metrics...`);
    }
  }

  return metrics;
}

export async function seedApiKeys(count: number = 500): Promise<ApiKeySeed[]> {
  console.log(`Seeding ${count} API keys...`);
  
  const keys: ApiKeySeed[] = [];
  const tenantIds = Array.from({ length: 100 }, (_, i) => `tenant-seed-${i}`);
  const scopeOptions = [
    ['read:identities'],
    ['read:identities', 'write:discovery'],
    ['read:identities', 'read:risk'],
    ['admin'],
    ['read:all', 'write:discovery', 'read:risk']
  ];

  for (let i = 0; i < count; i++) {
    const tenantId = faker.helpers.arrayElement(tenantIds);
    const keyPrefix = `idm_${faker.string.alphanumeric(6).toLowerCase()}`;
    
    keys.push({
      tenantId,
      name: `${faker.helpers.arrayElement(['Production', 'Staging', 'Dev', 'CI/CD'])} API Key`,
      keyPrefix,
      keyHash: faker.string.alphanumeric(64),
      scopes: faker.helpers.arrayElement(scopeOptions),
      isActive: faker.datatype.boolean(0.85),
      lastUsedAt: faker.datatype.boolean(0.7) ? randomDate(SIX_MONTHS_AGO, NOW) : null,
      createdAt: randomDate(SIX_MONTHS_AGO, NOW)
    });
  }

  return keys;
}

export async function insertIntegrationsBatch(integrations: IntegrationSeed[]): Promise<void> {
  console.log('Inserting integrations...');
  
  for (let i = 0; i < integrations.length; i += 100) {
    const batch = integrations.slice(i, i + 100);
    await prisma.tenantIntegration.createMany({
      data: batch.map((int, idx) => ({
        ...int,
        id: `integration-${i + idx}`
      })),
      skipDuplicates: true
    });
    console.log(`  Inserted ${Math.min(i + 100, integrations.length)}/${integrations.length} integrations`);
  }
}

export async function insertHealthMetricsBatch(metrics: HealthMetricSeed[]): Promise<void> {
  console.log('Inserting health metrics...');
  
  for (let i = 0; i < metrics.length; i += 500) {
    const batch = metrics.slice(i, i + 500);
    await prisma.tenantHealthMetric.createMany({
      data: batch.map((m, idx) => ({
        ...m,
        id: `health-${i + idx}`
      })),
      skipDuplicates: true
    });
    console.log(`  Inserted ${Math.min(i + 500, metrics.length)}/${metrics.length} health metrics`);
  }
}

export async function insertApiKeysBatch(keys: ApiKeySeed[]): Promise<void> {
  console.log('Inserting API keys...');
  
  await prisma.tenantApiKey.createMany({
    data: keys.map((key, idx) => ({
      ...key,
      id: `apikey-${idx}`
    })),
    skipDuplicates: true
  });
  console.log(`  Inserted ${keys.length} API keys`);
}

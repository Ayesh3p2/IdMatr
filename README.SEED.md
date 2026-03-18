# IDMatr - Realistic Data Seeding

Generate 10K+ synthetic records for identity platform testing and development.

## Quick Start

```bash
cd apps/control-plane

# Install dependencies (faker is included)
npm install

# Generate database client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed:dev
```

## Seed Environments

| Environment | Tenants | Audit Logs | Health Metrics | Duration |
|-------------|---------|------------|----------------|----------|
| **dev** | 20 | 5,000 | 1,000 | ~30s |
| **staging** | 50 | 20,000 | 5,000 | ~2min |
| **prod** | 100 | 100,000 | 10,000 | ~5min |

## Commands

```bash
# Development seed (20 tenants, 5K logs)
npm run db:seed:dev

# Staging seed (50 tenants, 20K logs)
npm run db:seed:staging

# Production seed (100 tenants, 100K logs)
npm run db:seed:prod

# Reset and reseed
npm run db:reset

# Run specific environment
npx ts-node prisma/seeds/index.ts prod
```

## Data Generated

### Platform Operators (5)
| Email | Role | MFA |
|-------|------|-----|
| superadmin@idmatr.io | SUPER_ADMIN | Yes |
| admin@idmatr.io | ADMIN | No |
| support@idmatr.io | SUPPORT | No |
| auditor@idmatr.io | AUDITOR | Yes |
| readonly@idmatr.io | READONLY_ADMIN | No |

**Password:** `Admin@123` (all accounts)

### Tenants (20-100)
- Realistic company names (Acme Corp, Global Solutions, etc.)
- Multi-industry: Tech, Finance, Healthcare, Retail
- Status distribution: 60% ACTIVE, 20% TRIAL, 10% PENDING
- Plans: starter, pro, enterprise
- Regions: Bengaluru HQ + global locations

### Tenant Users (1K-10K)
- Realistic Indian names (Bengaluru workforce)
- Department distribution: IT, HR, Finance, Engineering, Sales
- Roles: tenant_admin, tenant_user, viewer
- 40% have MFA enabled
- Password: `Test@123`

### Integrations (60-300)
- GOOGLE_WORKSPACE, MICROSOFT_365, SLACK, GITHUB
- OKTA, AZURE_AD, AWS_IAM, GITHUB_ENTERPRISE
- Sync status tracking

### API Keys (100-500)
- Scoped access: read:identities, write:discovery
- Active/inactive status

### Health Metrics (1K-10K)
- Time-series data (6 months)
- User counts, app counts, risk scores
- API call volumes

### Audit Logs (5K-100K)
- Operator actions: tenant management, integrations
- User actions: logins, role changes, consent
- Immutable hash-chained records

## Entity Relationships

```
Operator (1) ──────┬───── (*) OperatorAuditLog
                   │
Tenant (100) ──────┼───── (*) TenantUser
      │            │            │
      ├───── (*) TenantSettings
      ├───── (*) TenantIntegration
      ├───── (*) TenantApiKey
      ├───── (*) TenantHealthMetric
      └───── (*) OperatorAuditLog
```

## Test Credentials

### Platform Operators
```bash
# Super Admin
Email: superadmin@idmatr.io
Password: Admin@123

# Platform Admin
Email: admin@idmatr.io
Password: Admin@123
```

### Tenant Users
```bash
# Tenant Admin (first user of each tenant)
Email: admin@<company-domain>
Password: Test@123

# Regular Users
Email: <name>@<company-domain>
Password: Test@123
```

## Performance Benchmarks

| Query | Target | Seed Volume |
|-------|--------|-------------|
| List tenants | < 50ms | 100 tenants |
| Get tenant users | < 100ms | 10K users |
| Search audit logs | < 200ms | 100K logs |
| Health metrics | < 100ms | 10K metrics |

## Load Testing

```bash
# Run with seeded data
artillery run deploy/load-test.yml \
  --variables '{"JWT_TOKEN": "<admin-token>"}'
```

## Verification Queries

```sql
-- Count all records
SELECT 'Operators' as entity, COUNT(*) FROM operators
UNION ALL SELECT 'Tenants', COUNT(*) FROM tenants
UNION ALL SELECT 'Tenant Users', COUNT(*) FROM tenant_users
UNION ALL SELECT 'Integrations', COUNT(*) FROM tenant_integrations
UNION ALL SELECT 'API Keys', COUNT(*) FROM tenant_api_keys
UNION ALL SELECT 'Health Metrics', COUNT(*) FROM tenant_health_metrics
UNION ALL SELECT 'Audit Logs', COUNT(*) FROM operator_audit_logs;

-- Check user distribution
SELECT tenant_id, COUNT(*) as user_count 
FROM tenant_users 
GROUP BY tenant_id 
ORDER BY user_count DESC 
LIMIT 10;

-- Check audit log volume by day
SELECT DATE(created_at) as date, COUNT(*) 
FROM operator_audit_logs 
GROUP BY DATE(created_at) 
ORDER BY date DESC 
LIMIT 30;
```

## Troubleshooting

### Seed hangs
```bash
# Increase Node memory
export NODE_OPTIONS="--max-old-space-size=4096"
npm run db:seed:prod
```

### Duplicate key errors
```bash
# Reset database first
npm run db:reset
npm run db:seed:dev
```

### Slow inserts
- Already optimized with batch inserts (500 records/batch)
- Consider increasing `BATCH_SIZE` in `base.ts`

## Production Seed Warning

⚠️ **DANGER: Production seed will TRUNCATE all tables!**

```bash
# PRODUCTION - Requires confirmation
npm run db:seed:prod
```

**Confirmation required:** Type `PRODUCTION_SEED=true` to proceed.

---

**Real data validated!** 🚀

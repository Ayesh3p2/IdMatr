# IDMatr Administrator Guide
**Version 1.0 | Enterprise Identity Security Platform**

---

## Table of Contents
1. [System Requirements](#1-system-requirements)
2. [Production Deployment](#2-production-deployment)
3. [Environment Configuration Reference](#3-environment-configuration-reference)
4. [Database Administration](#4-database-administration)
5. [Security Hardening](#5-security-hardening)
6. [Role Management](#6-role-management)
7. [API Integration Reference](#7-api-integration-reference)
8. [Monitoring & Alerting](#8-monitoring--alerting)
9. [Backup & Recovery](#9-backup--recovery)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. System Requirements

### Minimum (Development / Small Org <5,000 identities)
- CPU: 4 cores
- RAM: 8GB
- Disk: 50GB SSD
- OS: Ubuntu 22.04 LTS, RHEL 9, or macOS 14+
- Docker: 24.x, Docker Compose: v2.x

### Recommended (Production / Enterprise <50,000 identities)
- CPU: 8–16 cores
- RAM: 16–32GB
- Disk: 200GB NVMe SSD
- OS: Ubuntu 22.04 LTS
- Docker: 24.x or Kubernetes 1.28+

### Large Scale (>50,000 identities)
- Kubernetes cluster: 3+ worker nodes
- PostgreSQL: Managed RDS/Cloud SQL with read replicas
- Redis: ElastiCache/Memorystore cluster
- Neo4j: Enterprise cluster (3 nodes)
- NATS: JetStream cluster (3 nodes)

---

## 2. Production Deployment

### Docker Compose (Recommended for ≤500 users)

```bash
# 1. Prepare environment
cp .env.example .env
vim .env  # Set all required values

# 2. Validate configuration
docker compose config

# 3. Start infrastructure first
docker compose up -d postgres redis neo4j nats

# 4. Wait for infrastructure health
docker compose ps  # All should show "healthy"

# 5. Run database migrations
docker compose run --rm identity-service npx prisma migrate deploy
docker compose run --rm discovery-service npx prisma migrate deploy
docker compose run --rm governance-service npx prisma migrate deploy
docker compose run --rm risk-engine npx prisma migrate deploy
docker compose run --rm audit-service npx prisma migrate deploy

# 6. Start all services
docker compose up -d

# 7. Verify all healthy
docker compose ps
curl http://localhost:3001/api/health
```

### Environment Validation

Before starting, verify your `.env` has secure values:

```bash
# Check JWT_SECRET strength (must be >32 chars)
grep JWT_SECRET .env | awk -F= '{print length($2), "chars"}'

# Should NOT contain these weak values
grep -E "password123|changeme|secret|REPLACE" .env && echo "WARNING: Weak values found!"
```

---

## 3. Environment Configuration Reference

### Complete Variable Reference

```bash
# ── REQUIRED ─────────────────────────────────────────────
JWT_SECRET          # Min 64-char random string. openssl rand -base64 64
POSTGRES_PASSWORD   # PostgreSQL password. openssl rand -base64 32
NEO4J_PASSWORD      # Neo4j password. openssl rand -base64 32

# ── NETWORK ──────────────────────────────────────────────
NATS_URL            # Default: nats://nats:4222 (Docker) or nats://localhost:4222 (local)
REDIS_URL           # Default: redis://redis:6379 (Docker) or redis://localhost:6379 (local)
ALLOWED_ORIGINS     # Comma-separated: https://idmatr.yourdomain.com,https://admin.yourdomain.com

# ── RUNTIME ──────────────────────────────────────────────
NODE_ENV            # production | development
DEMO_MODE           # true = use mock data when DB is empty
PORT                # Per-service port (set in docker-compose)

# ── RATE LIMITING ─────────────────────────────────────────
RATE_LIMIT_TTL      # Seconds per window (default: 60)
RATE_LIMIT_MAX      # Max requests per window per IP (default: 100)

# ── NOTIFICATIONS ─────────────────────────────────────────
SMTP_HOST           # SMTP server hostname
SMTP_PORT           # SMTP port (default: 587)
SMTP_USER           # SMTP username
SMTP_PASS           # SMTP password
SMTP_FROM           # From address (default: noreply@idmatr.com)
SLACK_WEBHOOK_URL   # Slack incoming webhook URL

# ── CONNECTORS ───────────────────────────────────────────
MS365_TENANT_ID     # Azure AD tenant ID
MS365_CLIENT_ID     # Azure AD app client ID
MS365_CLIENT_SECRET # Azure AD app client secret
GOOGLE_CLIENT_ID    # Google OAuth2 client ID
GOOGLE_CLIENT_SECRET# Google OAuth2 client secret
GOOGLE_DOMAIN       # Google Workspace domain
GITHUB_TOKEN        # GitHub personal access token (read:org scope)
SLACK_TOKEN         # Slack bot token (users:read scope)
```

---

## 4. Database Administration

### Schema Layout

Each service uses a PostgreSQL schema within the shared `idmatr_db` database:

| Schema | Service | Key Tables |
|--------|---------|-----------|
| `identity_service` | identity-service, policy-engine | User, Application, Role, Permission, AccessGrant |
| `discovery_service` | discovery-service | DiscoveredApp, DiscoveredUser, DiscoveryConnector |
| `governance_service` | governance-service | ApprovalWorkflow, WorkflowHistory, CertificationCampaign, JMLEvent |
| `risk_engine` | risk-engine | RiskEvent, RiskProfile |
| `audit_service` | audit-service | AuditLog |

### Running Migrations

```bash
# Apply all pending migrations
docker compose exec identity-service npx prisma migrate deploy

# Check migration status
docker compose exec identity-service npx prisma migrate status

# Reset database (DESTRUCTIVE — development only)
docker compose exec identity-service npx prisma migrate reset
```

### Database Backup

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U idmatr idmatr_db > backup_$(date +%Y%m%d).sql

# Restore from backup
docker compose exec -T postgres psql -U idmatr idmatr_db < backup_20260312.sql

# Backup Neo4j
docker compose exec neo4j neo4j-admin dump --database=neo4j --to=/backups/neo4j_$(date +%Y%m%d).dump
```

---

## 5. Security Hardening

### Secrets Rotation

**JWT Secret Rotation** (zero-downtime):
1. Generate new secret: `openssl rand -base64 64`
2. Update `.env` JWT_SECRET
3. Restart API Gateway: `docker compose restart api-gateway`
4. Active sessions will be invalidated — users must re-login

**Database Password Rotation**:
```bash
# 1. Update PostgreSQL password
docker compose exec postgres psql -U idmatr -c "ALTER USER idmatr WITH PASSWORD 'new_password';"

# 2. Update .env POSTGRES_PASSWORD=new_password

# 3. Restart all services
docker compose restart
```

### Network Hardening

For production, restrict external access:

```yaml
# docker-compose.override.yml — only expose necessary ports
services:
  postgres:
    ports: []  # No external access — internal only
  redis:
    ports: []  # No external access — internal only
  neo4j:
    ports: []  # No external access — internal only
  nats:
    ports:
      - "4222:4222"  # Remove if no external NATS clients
    # Remove management port:
    # - "8222:8222"
```

### TLS/HTTPS

For production, place IDMatr behind a reverse proxy:

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name idmatr.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/idmatr.crt;
    ssl_certificate_key /etc/ssl/private/idmatr.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 6. Role Management

### Built-in Roles

| Role | Permissions |
|------|------------|
| `admin` | Full access to all API endpoints and dashboard |
| `user` | Read-only access to dashboard data |
| `auditor` | Read-only access to audit trail and compliance |

### Creating JWT Tokens (Admin Use)

The API Gateway issues JWTs upon authentication. To create a test token:

```bash
# Using the auth endpoint (once auth service is implemented)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@idmatr.com","password":"your-password"}'

# Response: { "access_token": "eyJ..." }
```

### Using JWT in API Calls

```bash
TOKEN="eyJ..."

# Get all identities (admin role required)
curl http://localhost:3001/api/identities \
  -H "Authorization: Bearer $TOKEN"

# Get risk scores
curl http://localhost:3001/api/risk/scores \
  -H "Authorization: Bearer $TOKEN"
```

---

## 7. API Integration Reference

### Base URL
```
http://localhost:3001   (development)
https://api.idmatr.yourdomain.com  (production)
```

### Authentication
All endpoints require JWT Bearer token except `GET /api/health`.

```
Authorization: Bearer <jwt_token>
```

### Key Endpoints

```
GET  /api/health                     System health check (no auth)
GET  /api/identities                 List all identities
POST /api/identities                 Create identity
GET  /api/identities/:id             Get identity by ID
GET  /api/applications               List discovered applications
POST /api/discovery/scan             Trigger app discovery scan
GET  /api/risk/scores                Get risk profiles
GET  /api/risk/events                Get risk events
GET  /api/itdr/threats               Get active ITDR threats
POST /api/itdr/threats/:id/respond   Respond to threat
GET  /api/governance/workflows       List approval workflows
POST /api/governance/workflows/:id/approve  Approve workflow
GET  /api/governance/jml             Get JML events
POST /api/governance/jml             Create JML event
GET  /api/audit/logs                 Get audit logs
GET  /api/compliance/metrics         Get compliance scores
GET  /api/posture/score              Get ISPM posture score
GET  /api/graph/identity/:id         Get identity graph
GET  /api/graph/toxic-combinations   Get SoD violations
GET  /api/graph/attack-paths         Get attack path analysis
GET  /api/analytics/risk-trends      Get risk trend data
GET  /api/dashboard/summary          Get dashboard summary stats
```

### Rate Limits
- Default: 100 requests per 60 seconds per IP
- Configure via `RATE_LIMIT_TTL` and `RATE_LIMIT_MAX` env vars

### SIEM Integration (Splunk/QRadar)

```bash
# Webhook for audit events — forward to SIEM
# Set up in Settings → Notifications → Webhooks (coming in v1.1)

# Or poll the audit API
curl http://api.idmatr.com/api/audit/logs \
  -H "Authorization: Bearer $API_KEY" \
  -G --data-urlencode "since=2026-03-12T00:00:00Z" \
  | jq '.[] | {timestamp, actor, action, risk}'
```

---

## 8. Monitoring & Alerting

### Health Checks

```bash
# Quick health check
curl http://localhost:3001/api/health

# All services
for port in 3002 3003 3004 3005 3006 3007 3008 3009 3010; do
  echo -n "Port $port: "
  curl -s http://localhost:$port/health | jq -r '.status'
done
```

### Docker Logs

```bash
# Follow all service logs
docker compose logs -f

# Follow specific service
docker compose logs -f risk-engine

# Last 100 lines from API gateway
docker compose logs --tail=100 api-gateway

# Filter errors
docker compose logs | grep -i "error\|fatal\|exception"
```

### Log Levels

Set log verbosity per service in `docker-compose.yml`:
```yaml
environment:
  LOG_LEVEL: debug  # debug | log | warn | error
```

### Recommended Monitoring Stack

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports: ["3030:3000"]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: your-grafana-password

  loki:
    image: grafana/loki:latest
    ports: ["3100:3100"]
```

---

## 9. Backup & Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh — Run daily via cron: 0 2 * * * /opt/idmatr/backup.sh

BACKUP_DIR="/backups/idmatr/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# PostgreSQL backup
docker compose exec -T postgres pg_dump -U idmatr idmatr_db \
  | gzip > "$BACKUP_DIR/postgres.sql.gz"

# Neo4j backup
docker compose exec neo4j neo4j-admin dump \
  --database=neo4j \
  --to=/tmp/neo4j_backup.dump
docker compose cp neo4j:/tmp/neo4j_backup.dump "$BACKUP_DIR/neo4j.dump"

# Redis backup (AOF file)
docker compose cp redis:/data/appendonly.aof "$BACKUP_DIR/redis.aof"

echo "Backup completed: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
```

### Recovery Procedure

```bash
# 1. Stop application services (keep infrastructure running)
docker compose stop api-gateway admin-dashboard identity-service \
  discovery-service governance-service risk-engine audit-service \
  policy-engine graph-service notification-service worker-queue

# 2. Restore PostgreSQL
gunzip -c /backups/idmatr/20260312/postgres.sql.gz \
  | docker compose exec -T postgres psql -U idmatr idmatr_db

# 3. Restore Neo4j
docker compose cp /backups/idmatr/20260312/neo4j.dump neo4j:/tmp/
docker compose exec neo4j neo4j-admin load \
  --from=/tmp/neo4j.dump --database=neo4j --force

# 4. Restart services
docker compose up -d

# 5. Verify
curl http://localhost:3001/api/health
```

---

## 10. Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs identity-service | tail -30

# Common issues:
# "Missing required environment variables" → Check .env file
# "Connection refused" to postgres → postgres not healthy yet, wait ~30s
# "NATS connect failed" → NATS not healthy yet, wait ~15s
```

### Database Connection Failed

```bash
# Test PostgreSQL connection
docker compose exec postgres psql -U idmatr -d idmatr_db -c "SELECT 1"

# Check schema exists
docker compose exec postgres psql -U idmatr -d idmatr_db \
  -c "SELECT schema_name FROM information_schema.schemata;"

# Re-run migrations
docker compose exec identity-service npx prisma migrate deploy
```

### API Returns 401 Unauthorized

```bash
# Check JWT_SECRET is set
docker compose exec api-gateway env | grep JWT_SECRET

# Verify token hasn't expired (1hr default)
# Decode JWT: echo "eyJ..." | base64 -d | jq
```

### High Memory Usage

```bash
# Check container resource usage
docker stats --no-stream

# If Neo4j using too much RAM, adjust heap:
# In docker-compose.yml environment:
# NEO4J_dbms_memory_heap_max__size: 256m  (reduce from 512m)
```

### Prisma Client Out of Sync

```bash
# Regenerate Prisma client
docker compose exec identity-service npx prisma generate

# Run pending migrations
docker compose exec identity-service npx prisma migrate deploy
```

### Discovery Scan Not Finding Apps

1. Verify connector credentials in Settings → Identity Providers
2. Check DEMO_MODE is set to `false`
3. Check connector logs: `docker compose logs discovery-service`
4. Verify OAuth scopes are correct for your connector

---

*For feature requests and bug reports, open an issue on GitHub.*
*For enterprise support, contact your IDMatr account representative.*

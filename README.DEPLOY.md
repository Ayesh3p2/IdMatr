# IDMatr - Production Deployment Guide

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- NATS Server

### Local Development
```bash
# Clone and install
npm install

# Copy environment
cp .env.example .env
# Edit .env with your values

# Start infrastructure
docker-compose up -d postgres redis nats

# Run migrations
npm run db:migrate

# Start services
npm run dev
```

### Production Deployment

#### Option 1: Docker Compose
```bash
# Build production images
docker-compose -f docker-compose.yml build --parallel

# Start all services
docker-compose -f docker-compose.yml up -d

# Check status
docker-compose ps
```

#### Option 2: Kubernetes
```bash
# Apply manifests
kubectl apply -f deploy/k8s/production/

# Check pods
kubectl get pods -n idmatr

# Check logs
kubectl logs -n idmatr -l app=api-gateway -f
```

#### Option 3: Helm
```bash
# Install chart
helm install idmatr ./deploy/helm/idmatr

# Upgrade
helm upgrade idmatr ./deploy/helm/idmatr --set image.tag=v1.0.0
```

---

## Go-Live Checklist

### Security ✅
| Check | Status | Command/Evidence |
|-------|--------|------------------|
| Secrets in vault | ☐ | `kubectl get secrets -n idmatr` |
| TLS certificates valid | ☐ | `kubectl get certificates -n idmatr` |
| Security scan clean | ☐ | `npm audit` passes |
| CORS restricted | ☐ | Only production domains in `ALLOWED_ORIGINS` |
| Rate limiting enabled | ☐ | Check `/metrics` for rate limit metrics |
| Helmet middleware active | ☐ | Check security headers |
| JWT secrets rotated | ☐ | Use 64-char random secrets |

### Performance ✅
| Check | Status | Target |
|-------|--------|--------|
| API response P95 | ☐ | < 200ms |
| Cache hit rate | ☐ | > 90% |
| Compression enabled | ☐ | Check response headers |
| Database pooling | ☐ | Check Prisma config |
| Health checks active | ☐ | `/health/live`, `/health/ready` |

### Reliability ✅
| Check | Status | Command |
|-------|--------|---------|
| 99.9% uptime | ☐ | Run for 24hrs |
| Rollback tested | ☐ | `helm rollback idmatr` |
| Backup tested | ☐ | Restore from snapshot |
| HPA scaling | ☐ | Load test with Artillery |
| Graceful shutdown | ☐ | Check pod termination |

### Compliance ✅
| Check | Status | Evidence |
|-------|--------|----------|
| GDPR data handling | ☐ | Privacy notices implemented |
| SOC2 audit logs | ☐ | Hash-chained immutable logs |
| Data retention | ☐ | Privacy service configured |
| Access reviews | ☐ | Periodic review workflow |

---

## Monitoring

### Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic health |
| `GET /health/live` | Liveness probe |
| `GET /health/ready` | Readiness probe |
| `GET /health/overview` | Detailed status |
| `GET /metrics` | Prometheus metrics |

### Key Metrics
- `http_request_duration_seconds` - Latency histogram
- `http_requests_total` - Request count
- `auth_login_attempts_total` - Authentication attempts
- `tenant_operations_total` - Tenant operations

### Alerts (Datadog/New Relic)
```yaml
CPU > 80%: kubectl top pods
Error rate > 1%: Check /metrics error_rate_total
P95 latency > 200ms: Check http_request_duration_seconds
```

---

## Load Testing

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run deploy/load-test.yml --output report.json

# Generate HTML report
artillery report report.json
```

---

## Rollback Procedures

### Docker Compose
```bash
# Rollback to previous version
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml -f docker-compose.yml.backup up -d
```

### Kubernetes
```bash
# Rollback deployment
kubectl rollout undo deployment/api-gateway -n idmatr

# Check rollback status
kubectl rollout status deployment/api-gateway -n idmatr
```

### Helm
```bash
# List revisions
helm history idmatr

# Rollback to revision
helm rollback idmatr <revision>
```

---

## Backup & Disaster Recovery

### Database Backup
```bash
# PostgreSQL backup
pg_dump -h postgres -U idmatr idmatr > backup_$(date +%Y%m%d).sql

# Restore
psql -h postgres -U idmatr idmatr < backup_20240101.sql
```

### Redis Backup
```bash
# BGSAVE
redis-cli -h redis BGSAVE

# Check status
redis-cli -h redis LASTSAVE
```

---

## Environment Variables

### Required for Production
```bash
NODE_ENV=production
JWT_SECRET=<64-char-random>
INTERNAL_API_SECRET=<64-char-random>
DATA_ENCRYPTION_KEY=<32-byte-base64>
CONTROL_PLANE_JWT_SECRET=<64-char-random>
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
ALLOWED_ORIGINS=https://idmatr.io,https://admin.idmatr.io
```

### Generate Secrets
```bash
# JWT secrets
openssl rand -base64 64

# Encryption keys
openssl rand -base64 32

# Passwords
openssl rand -base64 24
```

---

## Support

- Documentation: `/docs`
- API Docs: `/api/docs`
- Health: `/health`
- Metrics: `/metrics`

---

**IDMatr is LIVE-READY!** 🚀

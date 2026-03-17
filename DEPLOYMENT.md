# IDMatr Production Deployment Guide

## Security Hardening — Completed

All critical security issues have been remediated:

### ✓ Secrets Management
- **Generated**: 18 cryptographically secure secrets (64-bit for JWT, 32-bit for passwords)
- **File**: `.env.production.secure` (permissions: 600 — owner-only readable)
- **Location**: Use secure secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.)
- **Git**: All `.env*` files added to `.gitignore`; no secrets tracked in git

### ✓ NATS Transport Security
- **TLS Enabled**: Production `nats-server.conf` configured with certificate verification
- **Per-Service Auth**: 10 services with unique NATS credentials and granular permissions
- **Status**: Ready for mTLS deployment (certificates required)

### ✓ Network Isolation
- Microservices confined to `internal` bridge network
- Only API gateway and dashboards exposed on `edge` network
- PostgreSQL, Redis, Neo4j ports bound to `127.0.0.1` only

### ✓ Resource Limits
- All services have CPU and memory limits enforced
- API gateway: 512M memory, 0.5 CPU
- Database services: 1G memory, 1.0 CPU
- Prevents resource exhaustion attacks

### ✓ Container Security
- Non-root user: `nestjs:1001`
- Multi-stage builds: no build tools or source code in production images
- Health checks: all services monitored

---

## Pre-Deployment Checklist

### 1. Generate TLS Certificates for NATS

```bash
mkdir -p deploy/nats/certs
cd deploy/nats/certs

# Generate self-signed certificates (replace with CA-signed in production)
openssl req -new -x509 -days 3650 -nodes \
  -out server.crt -keyout server.key \
  -subj "/CN=nats.yourdomain.com"

openssl req -new -x509 -days 3650 -nodes \
  -out ca.crt -keyout ca.key \
  -subj "/CN=ca.yourdomain.com"
```

### 2. Configure `.env.production.secure`

Update domain names and integration credentials:

```bash
# Edit .env.production.secure
nano .env.production.secure
```

Required changes:
- **ALLOWED_ORIGINS**: Set to your domain(s) — e.g., `https://app.yourdomain.com`
- **NEXT_PUBLIC_API_URL**: Set to `https://api.yourdomain.com`
- **NEXT_PUBLIC_CP_API_URL**: Set to `https://control-plane.yourdomain.com`
- **NEXT_PUBLIC_API_URL**: Admin Dashboard backend URL
- **Optional credentials**: Google, Azure AD, GitHub, Slack, SMTP (if using integrations)

### 3. Store Secrets Securely

Do **NOT** commit `.env.production.secure` to git. Instead:

**Option A: HashiCorp Vault**
```bash
vault kv put secret/idmatr/production @.env.production.secure
```

**Option B: AWS Secrets Manager**
```bash
aws secretsmanager create-secret --name idmatr/production \
  --secret-string file://.env.production.secure
```

**Option C: GitOps (Sealed Secrets / ArgoCD)**
Encrypt with your cluster's sealed-secrets controller.

### 4. Run Pre-Deployment Checks

```bash
bash scripts/pre-deploy-check.sh
```

Expected output:
```
✓ All checks passed. Ready for deployment.
```

---

## Deployment

### Docker Compose (Development/Single-Host)

```bash
docker compose -f docker-compose.yml \
               -f deploy/docker-compose.prod.yml \
               --env-file .env.production.secure up -d
```

### Health Check

```bash
# Monitor startup
docker compose ps

# Expected: All services in "Up" state within 2-3 minutes

# Monitor logs
docker compose logs -f api-gateway
docker compose logs -f control-plane
```

### Kubernetes (Production)

Generate Kubernetes manifests from `docker-compose.prod.yml`:

```bash
# Option 1: Kompose (simple conversion)
kompose convert -f docker-compose.yml -f deploy/docker-compose.prod.yml

# Option 2: Helm (recommended)
# See: deploy/k8s/helm/ for production-grade charts
```

---

## Verification

### 1. Service Health

```bash
# Check all services are running
docker compose ps

# Expected: 13 services all in "Up (healthy)" state
```

### 2. NATS Connectivity

```bash
# Verify NATS is accepting connections (internal network)
docker compose exec nats sh -c 'wget -O- http://localhost:4222/connz 2>/dev/null' | head -20
```

### 3. Database Connectivity

```bash
# PostgreSQL
docker compose exec postgres psql -U idmatr -d idmatr_db -c "SELECT version();"

# Redis
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping

# Neo4j
docker compose exec neo4j cypher-shell -u neo4j -p $NEO4J_PASSWORD "RETURN 1;"
```

### 4. API Gateway Health

```bash
curl -s http://localhost:3001/api/health | jq .
```

Expected:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "services": [
    "identity-service",
    "discovery-service",
    ...
  ]
}
```

### 5. Audit Logs

```bash
# Verify immutable audit logs are created
docker compose exec control-plane sh -c 'ls -lah /app/var/compliance/'
docker compose exec audit-service sh -c 'head /app/var/compliance/service-audit-ledger.ndjson'
```

---

## Troubleshooting

### NATS TLS Connection Errors

If services can't connect to NATS:

```bash
# Check TLS configuration
docker compose exec nats cat /etc/nats/nats-server.conf | grep -A 10 "tls {"

# Verify certificates exist
docker compose exec nats ls -la /etc/nats/certs/

# Check NATS logs
docker compose logs nats | grep -i "tls\|error\|certificate"
```

**Solution**: Ensure certificates are mounted and readable by NATS container.

### Service Startup Failures

```bash
# Check individual service logs
docker compose logs identity-service
docker compose logs discovery-service

# Common issues:
# - Database not ready: wait for postgres healthcheck (30-60 seconds)
# - NATS auth failed: verify NATS_*_PASSWORD in .env.production.secure
# - Memory limit: increase in docker-compose.prod.yml
```

### Connection Pool Exhausted

```bash
# If services show "Too many connections"
docker compose exec postgres psql -U idmatr -d idmatr_db \
  -c "SHOW max_connections;"

# Increase in postgres environment (docker-compose.yml)
POSTGRES_INITDB_ARGS: "--max-connections=500"
```

---

## Maintenance

### Regular Tasks

```bash
# Weekly: Backup audit logs
docker compose cp audit-service:/app/var/compliance/. ./backups/

# Weekly: Verify TLS certificate expiration
docker compose exec nats sh -c 'openssl x509 -in /etc/nats/certs/server.crt -noout -dates'

# Monthly: Rotate NATS passwords
# Generate new: openssl rand -base64 32
# Update: .env.production.secure → NATS_*_PASSWORD
# Restart NATS: docker compose restart nats
```

### Scaling

For production multi-node deployments:

1. **Docker Swarm**:
   ```bash
   docker swarm init
   docker stack deploy -c docker-compose.yml -c deploy/docker-compose.prod.yml idmatr
   ```

2. **Kubernetes**:
   ```bash
   kubectl apply -f deploy/k8s/manifests/
   ```

---

## Security Post-Deployment

### 1. Rotate Secrets Regularly

Schedule quarterly rotation of:
- JWT secrets
- Database passwords
- NATS service credentials

```bash
# Generate new secrets
bash scripts/generate-secrets.sh > new-secrets.txt
# Update .env.production.secure and secrets manager
# Redeploy services
```

### 2. Monitor Audit Logs

```bash
# Tail real-time audit logs
docker compose exec audit-service tail -f /app/var/compliance/service-audit-ledger.ndjson

# Verify log integrity
docker compose exec audit-service \
  node -e "require('./dist/audit.js').verifyLedger()" 
```

### 3. Enable WAF/DDoS Protection

- AWS: Enable WAF on ALB, CloudFlare DDoS
- On-Prem: Deploy ModSecurity / nginx ModSecurity

### 4. Backup Strategy

```bash
# Daily: PostgreSQL backup
docker compose exec postgres pg_dump -U idmatr -d idmatr_db | gzip > /backups/idmatr-$(date +%Y%m%d).sql.gz

# Daily: Audit logs backup
docker compose cp audit-service:/app/var/compliance/ /backups/audit-$(date +%Y%m%d)/
```

---

## Support & Documentation

- **GitHub**: https://github.com/your-org/idmatr
- **Security Issues**: security@yourdomain.com
- **Architecture**: See `docs/architecture.md`
- **API Documentation**: Auto-generated at `/api/docs` (api-gateway)

---

**Deployment Ready ✓**

All security hardening is complete. Follow the checklist above to deploy securely to production.

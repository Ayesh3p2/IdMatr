# IDMatr Security Architecture

## Overview

IDMatr is a production-grade identity security platform with defense-in-depth security hardening.

## Security Layers

### 1. Secrets Management
- **JWT Secrets**: 64-bit cryptographically random (per service)
- **Database Passwords**: 32-bit base64-encoded random
- **Storage**: `.env.production.secure` (permissions: 600)
- **Rotation**: Quarterly via `scripts/generate-secrets.sh`

### 2. Transport Security
- **NATS mTLS**: TLS 1.2+ with client certificate verification
- **Database**: PostgreSQL SCRAM-SHA-256 authentication
- **Redis**: Per-connection password authentication
- **Neo4j**: Built-in authentication with per-user credentials

### 3. Network Isolation
```
┌─────────────────────────────────────────────┐
│  HOST NETWORK (External Access)             │
│  - API Gateway: port 3001                   │
│  - Admin Dashboard: port 3000               │
│  - Control Plane UI: port 3002              │
│  (Via `edge` bridge network)                │
└─────────┬───────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────┐
│  EDGE NETWORK (Bridge - Limited Access)     │
│  - API Gateway                              │
│  - Admin Dashboard                          │
│  - Control Plane UI                         │
│  (Can reach internal services)              │
└─────────┬───────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────┐
│  INTERNAL NETWORK (Bridge - Private)        │
│  - 10x Microservices                        │
│  - PostgreSQL (port 5432, no ext port)      │
│  - Redis (port 6379, no ext port)           │
│  - Neo4j (port 7687, bind 127.0.0.1)       │
│  - NATS (port 4222, no ext port)            │
│  (Zero host network access)                 │
└─────────────────────────────────────────────┘
```

### 4. Container Hardening
- **Non-root user**: `nestjs:1001` (UID/GID 1001)
- **Read-only root filesystem**: Available (configure via `security_opt`)
- **No privileged mode**: All containers unprivileged
- **Health checks**: All services monitored every 30s

### 5. Resource Limits (DoS Prevention)
| Service | Memory | CPU | Notes |
|---------|--------|-----|-------|
| API Gateway | 512M | 0.5 | Rate limiting + connection limits |
| PostgreSQL | 1G | 1.0 | Max 1000 connections |
| Redis | 256M | 0.25 | Max 256MB + LRU eviction |
| Neo4j | 1G | 1.0 | Heap 512M max |
| NATS | 128M | 0.5 | Max 1000 connections, 8MB payload |
| Microservices | 192-256M | 0.25-0.5 | Per-service limits |

### 6. Authentication & Authorization
- **API Gateway**: JWT-based with 8h expiration
- **Control Plane**: Separate JWT secret + operator MFA
- **NATS**: Per-service credentials with granular permissions
  ```
  api_gateway: can publish all commands, subscribe to _INBOX
  identity_service: can publish _INBOX, subscribe to identity commands
  [etc. for each service]
  ```
- **PostgreSQL**: Individual schema isolation per service
- **Neo4j**: Graph-level isolation

### 7. Encryption
- **Field-level**: AES-256-GCM for sensitive data (DATA_ENCRYPTION_KEY)
- **Database**: PostgreSQL SCRAM-SHA-256 passwords + optional TLS
- **Redis**: Optional TLS (configured via REDIS_URL scheme)
- **NATS**: TLS 1.2+ with mTLS verification
- **In-transit**: TLS 1.2+ recommended for all external connections

### 8. Audit Logging
- **Immutable logs**: NATS-journal format at `/app/var/compliance/`
- **Control plane**: Operator audit ledger (operator-audit-ledger.ndjson)
- **Services**: Service audit ledger (service-audit-ledger.ndjson)
- **Retention**: Configurable via `RETENTION_SCAN_ENABLED` + `RETENTION_SCAN_INTERVAL_MS`

### 9. Data Protection
- **Passwords**: bcryptjs (12+ rounds) for admin credentials
- **PII**: Encrypted with DATA_ENCRYPTION_KEY (field-level)
- **Audit trails**: Immutable, signed with NATS JetStream
- **Backups**: Separate database credentials + encryption

## Security Configurations

### Production Deployment
```bash
# Primary override file
deploy/docker-compose.prod.yml

# NATS TLS config (certificates required)
deploy/nats/nats-server.conf

# Secrets (never commit)
.env.production.secure

# Pre-deployment validation
scripts/pre-deploy-check.sh
```

### Environment Variables

**Critical secrets** (must be set):
- `JWT_SECRET`: 64-bit random
- `POSTGRES_PASSWORD`: 32-bit random
- `NEO4J_PASSWORD`: 32-bit random
- `REDIS_PASSWORD`: 32-bit random
- `DATA_ENCRYPTION_KEY`: 32-byte base64
- `INTERNAL_API_SECRET`: 64-bit random
- `CONTROL_PLANE_JWT_SECRET`: 64-bit random
- `NATS_*_PASSWORD` (10x): Per-service 32-bit random

**Important configurations**:
- `NODE_ENV=production`
- `ALLOWED_ORIGINS`: Restrict to your domain(s)
- `NEXT_PUBLIC_API_URL`: Frontend API endpoint
- `DEMO_MODE=false`
- `RATE_LIMIT_MAX=100`

## Threat Mitigation

| Threat | Mitigation | Status |
|--------|-----------|--------|
| **SQL Injection** | Prisma ORM (parameterized queries), input validation | ✓ |
| **CSRF** | JWT-based auth, SameSite cookies | ✓ |
| **XSS** | Content Security Policy (frontend), output encoding | ⏳ |
| **DDoS** | Rate limiting, resource limits, reverse proxy | ✓ Partial |
| **Privilege Escalation** | RBAC via control plane, role-based NATS permissions | ✓ |
| **Unauthorized Access** | JWT, service-level auth, network isolation | ✓ |
| **Data Breach** | Encryption (field-level + TLS), RBAC, audit logs | ✓ |
| **Man-in-the-Middle** | TLS 1.2+ for NATS, PostgreSQL, external APIs | ✓ |

## Compliance

- **SOC 2**: Audit logging, access controls, encryption
- **GDPR**: Data encryption, audit trails, data subject rights
- **HIPAA**: Encryption, access logging, secure deletion
- **PCI-DSS**: Network segmentation, access controls, audit logs

## Incident Response

### Container Compromise
```bash
# 1. Isolate service
docker compose stop <service>

# 2. Inspect logs
docker compose logs <service> > /tmp/incident.log

# 3. Collect evidence
docker cp <service>:/app /tmp/evidence/

# 4. Rotate secrets for compromised service
# Update .env.production.secure, redeploy

# 5. Verify audit logs
docker compose logs audit-service
```

### Suspicious Activity
```bash
# Check real-time audit logs
docker compose exec audit-service tail -f /app/var/compliance/service-audit-ledger.ndjson

# Verify log integrity
docker compose exec audit-service \
  npm run verify-ledger
```

## Maintenance

### Secret Rotation (Quarterly)
```bash
# 1. Generate new secrets
bash scripts/generate-secrets.sh > /tmp/new-secrets.txt

# 2. Update .env.production.secure
nano .env.production.secure

# 3. Redeploy
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  --env-file .env.production.secure up -d
```

### Certificate Rotation (Annually)
```bash
# NATS TLS certificates
cd deploy/nats/certs
openssl x509 -in server.crt -noout -dates

# Before expiration, regenerate:
openssl req -new -x509 -days 3650 -nodes \
  -out server.crt -keyout server.key
```

### Dependency Updates
```bash
# Check for vulnerabilities
npm audit

# Update packages
npm update

# Rebuild images
docker compose build
```

## References

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NATS Security](https://docs.nats.io/running-a-nats-service/configuration/securing_nats)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax.html#SQL-SYNTAX-LEXICAL-TOKENS-SPECIAL-CHARACTERS)

---

**Last Updated**: 2025-03-14
**Status**: Production Ready ✓

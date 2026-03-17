# IDMatr Security Architecture

**Platform:** IDMatr — Enterprise Identity Security Platform
**Version:** 1.0.0
**Document Date:** 2026-03-13
**Audience:** Security Engineers, Platform Team, Auditors

---

## 1. Architecture Principles

IDMatr is built on five security principles:

1. **Zero-Trust at every boundary** — Every request is authenticated and tenant-scoped regardless of origin.
2. **Multi-tenant isolation by default** — `tenantId` is a mandatory field on every data model; no global queries exist in application code.
3. **Least privilege** — Services communicate only via NATS message patterns; no service holds credentials for another.
4. **Immutable audit trail** — Every state-changing operation produces an immutable `AuditLog` record.
5. **Fail-secure** — Startup fails hard on missing `JWT_SECRET`; Prisma connection failures surface immediately.

---

## 2. Network Security Model

### 2.1 Ingress Boundary

```
External Traffic
      │
      ▼
 ┌────────────────────────────────────────┐
 │           API Gateway :3001             │
 │  • JWT validation (Passport-JWT)        │
 │  • TenantMiddleware (header/JWT/sub)    │
 │  • Request rate-limiting (middleware)   │
 │  • Input validation (class-validator)   │
 └────────────┬───────────────────────────┘
              │  NATS (internal)
              ▼
 ┌──────────────────────────────────────────────────────────┐
 │                   Private Service Mesh                    │
 │                                                           │
 │  identity-service  │  discovery-service  │  audit-service │
 │  governance-svc    │  risk-engine        │  policy-engine │
 │  graph-service     │  notification-svc   │  worker-queue  │
 └──────────────────────────────────────────────────────────┘
              │
              ▼
 ┌──────────────────────────────────────┐
 │          Data Layer                   │
 │  PostgreSQL 15   Neo4j 5   Redis 7   │
 └──────────────────────────────────────┘
```

- The API Gateway is the **only** service that accepts external HTTP connections.
- All microservices expose only NATS message pattern handlers — no HTTP ports are published to the host network.
- Infrastructure services (PostgreSQL, Neo4j, Redis, NATS) are on a private Docker network.

### 2.2 Admin Boundaries

```
Operators ──► Admin Dashboard :3000 (Next.js)
                     │
                     ▼
          API Gateway :3001 (JWT admin role)

Tenant Admins ──► Control Plane UI :3002 (Next.js)
                     │
                     ▼
          Control Plane API :3010 (separate JWT context)
```

The control plane operates independently from the data plane. Control plane credentials cannot be used to access tenant data APIs.

---

## 3. Authentication & Session Management

### 3.1 JWT Configuration

| Parameter | Value | Configuration |
|-----------|-------|---------------|
| Algorithm | HS256 | `@nestjs/jwt` default |
| Secret | Minimum 256-bit | `JWT_SECRET` env var (throws at startup if absent) |
| Expiry | 8 hours | `JWT_EXPIRES_IN` env var (default: `8h`) |
| Claims | `sub`, `email`, `tenantId`, `role` | Set by identity-service on login |

### 3.2 Tenant Resolution Order

```
Request arrives at API Gateway
         │
         ▼
1. X-Tenant-ID header present?
   └─ YES → validate UUID format → set req.tenantId
         │
         ▼
2. Authorization: Bearer <jwt> present?
   └─ YES → decode payload → read payload.tenantId (UUID) → set req.tenantId
         │
         ▼
3. Subdomain of hostname (e.g. acme.idmatr.app)?
   └─ YES → extract slug → set req.tenantId (slug, resolved later)
         │
         ▼
4. No tenant context → proceed (admin/health routes only)
```

### 3.3 Cross-Tenant Protection

Routes exempt from tenant enforcement (public/admin):
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`

All other routes: controller reads `req.tenantId` and includes it in every NATS payload. Services validate that `tenantId` matches record ownership before returning data.

---

## 4. Data Isolation Architecture

### 4.1 Database Schema Isolation

Each service has a dedicated PostgreSQL connection string and separate database schema. Prisma enforces schema boundaries at compile time.

| Service | Database | Schema |
|---------|----------|--------|
| identity-service | `identity_service` | User, Application, Role, Permission, AccessGrant |
| discovery-service | `discovery_service` | DiscoveredApp, DiscoveredUser, DiscoveryConnector |
| governance-service | `governance_service` | ApprovalWorkflow, WorkflowHistory, CertificationCampaign |
| risk-engine | `risk_engine` | RiskEvent, RiskProfile |
| audit-service | `audit_service` | AuditLog |
| policy-engine | `identity_service` (shared) | User, Role, Permission, AccessGrant (read-only policy evaluation) |

### 4.2 Row-Level Tenant Isolation

Every model follows this pattern:

```typescript
// Example: identity-service AppService
async getAllIdentities(tenantId: string) {
  return this.prisma.user.findMany({
    where: { tenantId },     // ← never omitted
    orderBy: { createdAt: 'desc' },
  });
}

async getIdentity(tenantId: string, id: string) {
  return this.prisma.user.findFirst({
    where: { id, tenantId }, // ← both id AND tenantId required
  });
}
```

Compound unique constraints prevent cross-tenant collisions:
- `User`: `@@unique([tenantId, email])`
- `DiscoveredApp`: `@@unique([tenantId, name])`
- `RiskProfile`: `@@unique([tenantId, targetId])`

### 4.3 NATS Message Isolation

Every NATS message payload includes `tenantId`:

```typescript
// Controller (api-gateway)
this.identityClient.send({ cmd: 'get_all_identities' }, { tenantId });

// Handler (identity-service)
@MessagePattern({ cmd: 'get_all_identities' })
async getAllIdentities(@Payload() data: { tenantId: string }) {
  return this.appService.getAllIdentities(data.tenantId);
}
```

There is no broadcast pattern or wildcard subscription that would allow cross-tenant message interception.

---

## 5. Secrets Management

### 5.1 Secret Inventory

| Secret | Location | Rotation |
|--------|----------|---------|
| `JWT_SECRET` | `.env` file / container env | On-demand; service restart required |
| `DATABASE_URL` | Per-service `.env` | On credential rotation |
| `REDIS_URL` | Worker/notification service `.env` | On credential rotation |
| `NEO4J_*` | Graph service `.env` | On credential rotation |
| `GOOGLE_*` | Discovery service `.env` | OAuth token refresh automated |
| `MICROSOFT_*` | Discovery service `.env` | OAuth token refresh automated |
| `SLACK_BOT_TOKEN` | Discovery service `.env` | On Slack app rotation |
| `GITHUB_TOKEN` | Discovery service `.env` | On PAT expiry |

### 5.2 Secret Handling Rules

- Secrets are never logged (Logger calls use safe field names only)
- `JWT_SECRET` throws an error at startup if undefined — no silent fallback
- Database URLs are never exposed through API responses
- OAuth tokens are stored as connector configuration, not returned to API consumers

---

## 6. Password Security

Passwords are hashed with `bcryptjs` before storage:

```typescript
import * as bcrypt from 'bcryptjs';

// On creation
const passwordHash = await bcrypt.hash(plaintext, 12); // cost factor 12

// On verification
const valid = await bcrypt.compare(plaintext, storedHash);
```

- Cost factor 12 (approximately 250ms per hash on modern hardware)
- Plaintext never stored or logged
- Hash never returned in API responses

**Gap:** Minimum complexity is not currently enforced at the API layer (see Compliance Report Gap PCI-DSS #1).

---

## 7. Audit Logging Architecture

### 7.1 AuditLog Model

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  tenantId   String
  actorId    String          // who performed the action
  actorType  String          // user | service | api-key
  action     String          // e.g. "user.create", "access.grant", "threat.respond"
  targetId   String          // entity ID being acted upon
  targetType String          // e.g. "user", "application", "threat"
  status     String          // success | failure | blocked
  details    Json            // structured action-specific data
  ipAddress  String?
  userAgent  String?
  timestamp  DateTime @default(now())

  @@index([tenantId, timestamp])  // fast per-tenant time-range queries
}
```

### 7.2 Audit Coverage

| Event Category | Logged | Fields Captured |
|----------------|--------|----------------|
| User login | Yes | actorId, ipAddress, userAgent, status |
| Access grant/revoke | Yes | actorId, targetId (userId), applicationId |
| Role change | Yes | actorId, targetId, old/new role |
| Threat detection | Yes | automated, eventType, severity, userId |
| Threat response | Yes | actorId, threatId, action (resolve/escalate) |
| Discovery scan | Yes | tenantId, source, identities found |
| Workflow approval | Yes | approverId, decision, comment |
| Identity create/update/delete | Yes | actorId, targetId, changed fields |

### 7.3 Log Integrity

Current state: Logs are write-once by application design (no update/delete endpoint exposed). A privileged database user could modify records.

Recommended hardening:
```sql
-- PostgreSQL row security to prevent deletes
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_no_delete ON "AuditLog" FOR DELETE USING (false);
REVOKE DELETE ON "AuditLog" FROM application_role;
```

---

## 8. Threat Detection Architecture

### 8.1 Risk Scoring Model

```
Risk Score = Σ (event_weight × frequency) − (days_since_last_event × 2)
  Capped at [0, 100]

Weights:
  critical event: 40 points
  high event:     20 points
  medium event:   10 points
  low event:       5 points

Temporal decay: −2 points per day of inactivity
```

### 8.2 ITDR Detection Patterns

| Pattern | Detection Logic | MITRE Tactic |
|---------|----------------|--------------|
| Impossible Travel | ≥2 `abnormal_behavior` events for same user | T1078 — Valid Accounts |
| Privilege Escalation | Any `privilege_escalation` event | T1068 — Privilege Escalation |
| Dormant Account Activation | Any `dormant_account` event | T1098 — Account Manipulation |
| Excessive Privilege | Any `excessive_privilege` event | T1134 — Access Token Manipulation |

### 8.3 Response Playbooks

| Playbook | Threat Type | Actions |
|----------|-------------|---------|
| ATO-001 | Account Takeover (abnormal_behavior) | Suspend session, force password reset, notify |
| PRIV-001 | Excessive Privilege | Revoke over-provisioned grants, trigger review |
| PRIV-003 | Privilege Escalation | Suspend account, escalate to security team |
| DORM-001 | Dormant Account | Lock account, initiate access review workflow |

---

## 9. Container Security

### 9.1 Image Hardening

All production images implement:

- **Multi-stage builds** — Build artifacts only; no build toolchain in runner image
- **Non-root execution** — `adduser -S nestjs -u 1001 -G nodejs`; `USER nestjs`
- **Read-only filesystem** — All writes go to mounted volumes (database/cache)
- **Minimal base** — `node:20-alpine` (Alpine Linux; ~5MB base)
- **PID 1 safety** — `dumb-init` as ENTRYPOINT prevents zombie processes
- **Health checks** — Every container has a `HEALTHCHECK` directive

### 9.2 Environment Variables

No secrets are baked into Docker images. All sensitive configuration is injected at runtime via:
- Docker Compose `environment:` sections (development)
- Kubernetes Secrets (production)
- Cloud provider secret managers (production)

### 9.3 Dependency Supply Chain

- `npm ci --ignore-scripts` used in all Dockerfiles (prevents postinstall script execution)
- Lock file (`package-lock.json`) committed and used for reproducible builds
- Prisma binary targets explicitly pinned: `["native", "linux-musl-arm64-openssl-3.0.x"]`

---

## 10. Known Security Gaps (Priority Order)

| Priority | Gap | Impact | Status |
|----------|-----|--------|--------|
| P1 | MFA not implemented | Account takeover risk | Open |
| P1 | NATS bus not TLS-encrypted | Internal traffic interception | Open |
| P1 | No right-to-erasure endpoint | GDPR violation risk | Open |
| P1 | Password complexity not enforced | Weak credential risk | Open |
| P2 | No penetration test conducted | Unknown vulnerabilities | Open |
| P2 | Audit log not append-only at DB level | Log tampering risk | Open |
| P2 | No SIEM integration | Delayed incident detection | Open |
| P3 | Docker images not signed | Supply chain risk | Open |
| P3 | No backup/restore procedure | Data loss risk | Open |
| P3 | No idle session timeout | Abandoned session risk | Open |

---

## 11. Security Contact & Incident Response

**Responsible Team:** Platform Security
**Incident Classification:**

| Severity | Description | Response Time |
|----------|-------------|---------------|
| Critical | Active breach, data exfiltration, credential compromise | 1 hour |
| High | Privilege escalation, dormant account activation, ITDR alert | 4 hours |
| Medium | Policy violation, failed authentication spike | 24 hours |
| Low | Informational, low-risk configuration drift | 72 hours |

**ITDR Alert Pipeline:**
```
Risk Engine detects pattern
    → Notification Service alerts security team
    → ITDR console shows threat (Admin Dashboard /itdr)
    → Security analyst invokes respondToThreat(action: "resolve"|"escalate"|"investigate")
    → AuditLog records response with actor and notes
```

---

*This document reflects the security architecture as implemented. It should be reviewed quarterly and updated following any significant architectural change.*

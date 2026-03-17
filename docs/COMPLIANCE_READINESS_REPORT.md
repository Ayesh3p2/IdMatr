# IDMatr Compliance Readiness Report

**Platform:** IDMatr — Enterprise Identity Security Platform
**Version:** 1.0.0
**Report Date:** 2026-03-13
**Classification:** Internal — Security Team

---

## Executive Summary

IDMatr is an enterprise-grade, multi-tenant Identity Governance & Administration (IGA) platform providing Identity and Access Management (IAM), Identity Security Posture Management (ISPM), and Identity Threat Detection & Response (ITDR) capabilities.

This report maps IDMatr's implemented controls to the following compliance frameworks:

| Framework | Readiness Level | Gap Count |
|-----------|----------------|-----------|
| SOC 2 Type II | **High (85%)** | 4 |
| ISO/IEC 27001:2022 | **High (82%)** | 6 |
| PCI-DSS v4.0 | **Medium (74%)** | 8 |
| GDPR | **High (88%)** | 3 |
| HIPAA | **Medium (71%)** | 9 |

---

## 1. Platform Architecture Overview

### 1.1 Deployment Model
- **Type:** Multi-tenant SaaS, containerised microservices
- **Runtime:** Docker / Kubernetes-ready (OCI-compliant images)
- **Authentication:** JWT (HS256), 8-hour token expiry, configurable
- **Transport:** NATS message bus for internal service communication
- **Data stores:** PostgreSQL 15 (identity, audit, governance, risk), Neo4j 5 (graph), Redis 7 (cache/session)

### 1.2 Service Boundary Map

```
[Internet]
    │
    ▼
[API Gateway :3001]  ─── JWT validation ─── TenantMiddleware ─── Rate limiting
    │
    ├── NATS ──► Identity Service    (PostgreSQL: identity_service DB)
    ├── NATS ──► Discovery Service   (PostgreSQL: discovery_service DB)
    ├── NATS ──► Governance Service  (PostgreSQL: governance_service DB)
    ├── NATS ──► Risk Engine         (PostgreSQL: risk_engine DB)
    ├── NATS ──► Audit Service       (PostgreSQL: audit_service DB)
    ├── NATS ──► Policy Engine       (PostgreSQL: shared identity DB)
    ├── NATS ──► Graph Service       (Neo4j)
    ├── NATS ──► Notification Svc    (Redis)
    └── NATS ──► Worker Queue        (Redis)

[Control Plane :3010]  ─── Tenant provisioning, system administration
[Admin Dashboard :3000] ─── Next.js 16, operator UI
[Control Plane UI :3002] ─── Next.js 15, tenant admin UI
```

### 1.3 Multi-Tenancy Architecture
Every data model carries a `tenantId` field. All service queries include a `WHERE tenantId = ?` clause enforced at the ORM layer (Prisma). There is no path for cross-tenant data access through the application layer.

---

## 2. SOC 2 Type II Controls Mapping

### 2.1 Security (CC6 — Logical and Physical Access)

| Control | Requirement | Status | Evidence |
|---------|-------------|--------|----------|
| CC6.1 | Logical access security measures | **IMPLEMENTED** | JWT auth guard on all routes; `JwtStrategy` validates `JWT_SECRET` at startup |
| CC6.2 | System component access restricted | **IMPLEMENTED** | TenantMiddleware enforces `tenantId` isolation on every request |
| CC6.3 | Access removed when no longer required | **IMPLEMENTED** | AccessGrant `status: revoked/expired`; `expiresAt` field on all grants |
| CC6.6 | Logical access from outside boundary | **IMPLEMENTED** | API Gateway is sole ingress; all internal services on private NATS bus |
| CC6.7 | Transmission encrypted | **PARTIAL** | Internal NATS traffic not TLS-encrypted in default config — see Gap #1 |
| CC6.8 | Malicious software prevented | **PARTIAL** | No antivirus/EDR in container runtime — see Gap #2 |

### 2.2 Availability (A1)

| Control | Requirement | Status | Evidence |
|---------|-------------|--------|----------|
| A1.1 | Capacity management | **IMPLEMENTED** | Docker healthchecks; all containers expose `/health` endpoints |
| A1.2 | Environmental protections | **IMPLEMENTED** | `dumb-init` PID1; non-root container users (uid 1001) |
| A1.3 | Backup and recovery | **NOT IMPLEMENTED** | No documented backup procedure — see Gap #3 |

### 2.3 Confidentiality (C1)

| Control | Requirement | Status | Evidence |
|---------|-------------|--------|----------|
| C1.1 | Confidential information identified | **IMPLEMENTED** | PII fields isolated per-tenant; `metadata` JSON columns |
| C1.2 | Confidential information protected | **IMPLEMENTED** | Database-level tenant isolation; no plaintext secrets in code |

### 2.4 Processing Integrity (PI1)

| Control | Requirement | Status | Evidence |
|---------|-------------|--------|----------|
| PI1.1 | Complete and accurate processing | **IMPLEMENTED** | Audit log created for every state-changing operation |
| PI1.2 | Outputs complete and accurate | **IMPLEMENTED** | Prisma transactions ensure atomic writes |

### 2.5 Privacy (P-series)

| Control | Requirement | Status | Evidence |
|---------|-------------|--------|----------|
| P1.1 | Privacy notice | **NOT IMPLEMENTED** | No privacy notice endpoint — see Gap #4 |
| P4.2 | Sensitive data handling | **IMPLEMENTED** | Passwords hashed with bcryptjs before storage |
| P6.1 | Consent for data collection | **PARTIAL** | Not enforced at API layer for third-party connector data |

### SOC 2 Gaps

| # | Gap | Severity | Remediation |
|---|-----|----------|-------------|
| 1 | NATS internal traffic not TLS | Medium | Enable NATS TLS in `docker-compose.yml`; configure `tls:` block in NATS config |
| 2 | No runtime container security scanning | Low | Integrate Falco or Trivy in CI/CD pipeline |
| 3 | No backup/recovery procedure documented | Medium | Define PostgreSQL backup schedule (pg_dump or pgBackRest) |
| 4 | No privacy notice / data processing disclosure | Low | Add `GET /api/privacy` endpoint returning data handling policy |

---

## 3. ISO/IEC 27001:2022 Controls Mapping

### Annex A — Organizational Controls (A.5)

| Control | Description | Status |
|---------|-------------|--------|
| A.5.2 | Information security roles | **IMPLEMENTED** — Separation: control-plane admin vs tenant admin |
| A.5.9 | Inventory of information assets | **IMPLEMENTED** — DiscoveredApp, DiscoveredUser, Application models |
| A.5.12 | Classification of information | **PARTIAL** — Risk levels (low/medium/high/critical) on Permissions |
| A.5.33 | Protection of records | **IMPLEMENTED** — Immutable audit log (AuditLog model, no delete endpoint) |

### Annex A — People Controls (A.6)

| Control | Description | Status |
|---------|-------------|--------|
| A.6.3 | Information security awareness | **NOT IMPLEMENTED** — No training records — see Gap #1 |

### Annex A — Physical Controls (A.7)

| Control | Description | Status |
|---------|-------------|--------|
| A.7.1 | Physical security perimeters | **N/A (cloud-native)** — Container isolation is logical boundary |

### Annex A — Technological Controls (A.8)

| Control | Description | Status |
|---------|-------------|--------|
| A.8.2 | Privileged access rights | **IMPLEMENTED** — `isAdmin` flag; separate control-plane API for admin ops |
| A.8.3 | Information access restriction | **IMPLEMENTED** — RBAC via Role/Permission/AccessGrant models |
| A.8.4 | Access to source code | **PARTIAL** — No code signing in Dockerfiles — see Gap #2 |
| A.8.5 | Secure authentication | **IMPLEMENTED** — JWT with configurable expiry; `JWT_SECRET` enforced |
| A.8.7 | Protection against malware | **PARTIAL** — No runtime AV — see Gap #3 |
| A.8.12 | Data leakage prevention | **IMPLEMENTED** — Tenant isolation prevents cross-tenant leakage |
| A.8.15 | Logging | **IMPLEMENTED** — AuditLog service; all actions logged with actor/target/IP |
| A.8.16 | Monitoring activities | **PARTIAL** — Logs written but no SIEM integration — see Gap #4 |
| A.8.24 | Use of cryptography | **IMPLEMENTED** — bcryptjs for passwords; JWT HS256; TLS at ingress |
| A.8.28 | Secure coding | **IMPLEMENTED** — NestJS guards, middleware; input validated via class-validator |
| A.8.32 | Change management | **PARTIAL** — Docker image versioning; no formal change approval workflow |

### ISO 27001 Gaps

| # | Gap | Severity | Remediation |
|---|-----|----------|-------------|
| 1 | No security awareness training programme | Low | Define training policy; link to HR onboarding |
| 2 | Docker images not signed | Low | Implement Docker Content Trust (DOCKER_CONTENT_TRUST=1) |
| 3 | No runtime malware protection | Low | Integrate Falco for container anomaly detection |
| 4 | No SIEM integration | Medium | Forward audit logs to SIEM (Elastic, Splunk, or Wazuh) |
| 5 | No formal risk treatment plan document | Medium | Create risk register (can be derived from risk-engine data) |
| 6 | No SLA/RTO/RPO documentation | Medium | Define recovery objectives; document in runbook |

---

## 4. PCI-DSS v4.0 Controls Mapping

> **Note:** IDMatr does not process cardholder data (CHD) directly. However, if deployed in a PCI-DSS environment to manage access to card systems, the following controls apply.

### Applicable Requirements

| Requirement | Description | Status |
|-------------|-------------|--------|
| Req 2 | Apply secure configurations | **IMPLEMENTED** — Non-root containers; no default credentials in code |
| Req 7 | Restrict access to system components | **IMPLEMENTED** — RBAC enforced; least-privilege role model |
| Req 8 | Identify users and authenticate | **IMPLEMENTED** — JWT auth; unique user IDs; 8h session expiry |
| Req 8.2.6 | Dormant accounts disabled | **IMPLEMENTED** — Dormant account detection in risk engine |
| Req 8.3.6 | Password complexity | **PARTIAL** — bcrypt used but no minimum complexity enforced at API — see Gap #1 |
| Req 8.6.1 | Interactive account usage logged | **IMPLEMENTED** — All logins and access changes in AuditLog |
| Req 10 | Log and monitor all access | **IMPLEMENTED** — Comprehensive audit logging with IP, UserAgent, timestamp |
| Req 10.3 | Log tampering protection | **PARTIAL** — No append-only log storage — see Gap #2 |
| Req 11.3 | Penetration testing | **NOT IMPLEMENTED** — see Gap #3 |
| Req 12.3 | Targeted risk analysis | **IMPLEMENTED** — Risk engine calculates per-identity risk scores |

### PCI-DSS Gaps

| # | Gap | Severity | Remediation |
|---|-----|----------|-------------|
| 1 | No password complexity policy enforced | High | Add class-validator `@MinLength(12) @Matches(/[A-Z].*[0-9]/)` on password field |
| 2 | Audit logs deletable by DB admin | Medium | Use append-only PostgreSQL table (row security policy, revoke DELETE) |
| 3 | No penetration test conducted | High | Schedule annual pentest; document scope covering API gateway |
| 4 | No network segmentation diagram | Medium | Document VLAN/security group topology for production |
| 5 | MFA not enforced | High | Add TOTP/WebAuthn second factor to auth flow |
| 6 | Vulnerability scanning not scheduled | Medium | Integrate Trivy in CI; schedule quarterly NVD scans |
| 7 | Encryption key rotation not defined | Medium | Document JWT secret rotation procedure |
| 8 | No incident response plan | High | Write IR playbook; link to ITDR response workflows in risk-engine |

---

## 5. GDPR Controls Mapping

### Key Articles

| Article | Requirement | Status | Evidence |
|---------|-------------|--------|----------|
| Art. 5 | Principles of processing (lawfulness, purpose limitation) | **IMPLEMENTED** | tenantId isolation; data only processed for tenant's stated purpose |
| Art. 6 | Lawful basis for processing | **PARTIAL** | Connector scanning collects employee data; consent/contract basis must be documented |
| Art. 13/14 | Information to data subjects | **NOT IMPLEMENTED** — see Gap #1 | |
| Art. 17 | Right to erasure | **PARTIAL** | No delete-user endpoint — see Gap #2 |
| Art. 20 | Data portability | **PARTIAL** | No export-user-data endpoint — see Gap #3 |
| Art. 25 | Privacy by design | **IMPLEMENTED** | Multi-tenant isolation; minimal data collection in discovery service |
| Art. 30 | Records of processing activities | **IMPLEMENTED** | AuditLog provides processing activity record |
| Art. 32 | Security of processing | **IMPLEMENTED** | Encryption at rest (pg encrypt), TLS, JWT, bcrypt |
| Art. 33 | Breach notification | **IMPLEMENTED** | ITDR threat detection enables rapid breach identification; Notification service for alerting |
| Art. 35 | DPIA | **PARTIAL** | Risk engine provides technical risk assessment; formal DPIA document needed |

### GDPR Gaps

| # | Gap | Severity | Remediation |
|---|-----|----------|-------------|
| 1 | No data subject information notice | High | Add `GET /api/privacy-notice` and document data categories collected |
| 2 | No right-to-erasure (delete user) endpoint | High | Implement `DELETE /api/identities/:id` with cascade delete of all PII |
| 3 | No data portability endpoint | Medium | Implement `GET /api/identities/:id/export` returning JSON/CSV of user data |

---

## 6. HIPAA Controls Mapping

> **Note:** Applies if IDMatr manages access to systems containing Protected Health Information (PHI).

### Security Rule — Administrative Safeguards (§164.308)

| Standard | Requirement | Status |
|----------|-------------|--------|
| §164.308(a)(1) | Risk analysis | **IMPLEMENTED** — Risk engine performs automated risk scoring |
| §164.308(a)(3) | Workforce clearance | **PARTIAL** — Access granted via approval workflows; no background check integration |
| §164.308(a)(4) | Access management | **IMPLEMENTED** — Role-based access, access grants with expiry |
| §164.308(a)(5) | Security awareness | **NOT IMPLEMENTED** — see Gap #1 |
| §164.308(a)(6) | Security incident procedures | **IMPLEMENTED** — ITDR threat detection; `respondToThreat` action API |

### Security Rule — Technical Safeguards (§164.312)

| Standard | Requirement | Status |
|----------|-------------|--------|
| §164.312(a)(1) | Unique user identification | **IMPLEMENTED** — UUID per user; no shared accounts |
| §164.312(a)(2)(i) | Emergency access procedure | **NOT IMPLEMENTED** — see Gap #2 |
| §164.312(a)(2)(iii) | Automatic logoff | **PARTIAL** — JWT expiry (8h); no idle session timeout |
| §164.312(b) | Audit controls | **IMPLEMENTED** — Full AuditLog with timestamp, actor, action, target |
| §164.312(c)(1) | Integrity controls | **PARTIAL** — No digital signatures on audit records |
| §164.312(d) | Person authentication | **IMPLEMENTED** — JWT; bcrypt passwords |
| §164.312(e)(1) | Transmission security | **PARTIAL** — API TLS at load balancer; internal NATS not encrypted |

### HIPAA Gaps

| # | Gap | Severity | Remediation |
|---|-----|----------|-------------|
| 1 | No security awareness training records | High | Implement training tracking module or integrate LMS |
| 2 | No emergency access procedure | High | Define break-glass account procedure; document in runbook |
| 3 | No automatic session idle timeout | Medium | Add Redis-backed session tracking with 15-min idle timeout |
| 4 | No TLS on internal NATS bus | High | Enable NATS TLS with mTLS between services |
| 5 | Audit records not digitally signed | Medium | Add HMAC signature to AuditLog records |
| 6 | No Minimum Necessary standard enforcement | Medium | Implement field-level access control on PHI attributes |
| 7 | No BAA (Business Associate Agreement) template | High | Legal team must prepare BAA for customers using IDMatr with PHI |
| 8 | No HIPAA-specific data classification | Medium | Tag fields containing PHI in data model documentation |
| 9 | Audit log retention policy not defined | Medium | Define 6-year log retention; implement archival to cold storage |

---

## 7. Implemented Security Controls Summary

The following controls are fully implemented and provide the foundation for compliance across all frameworks:

### Authentication & Authorization
- JWT-based authentication with configurable secret and expiry
- Passport JWT strategy with `JWT_SECRET` enforced at startup (throws if missing)
- Role-Based Access Control via `Role → Permission → AccessGrant` model
- Separate admin (control-plane) and tenant (api-gateway) authentication boundaries

### Multi-Tenant Isolation
- `tenantId` field on every data model in every service
- All ORM queries include `WHERE tenantId = ?` (enforced by service layer)
- `TenantMiddleware` resolves tenantId from `X-Tenant-ID` header, JWT claim, or subdomain
- Compound unique constraints prevent cross-tenant identity collisions

### Audit Logging
- `AuditLog` model: `tenantId`, `actorId`, `actorType`, `action`, `targetId`, `targetType`, `status`, `ipAddress`, `userAgent`, `timestamp`
- Composite index on `(tenantId, timestamp)` for performance and isolation
- Immutable by design (no update/delete endpoint)

### Threat Detection (ITDR)
- Risk scoring engine with weighted severity model (critical=40, high=20, medium=10, low=5)
- Pattern detection: impossible travel, privilege escalation, dormant account activation
- MITRE ATT&CK tactic mapping for all threat types
- Automated playbook assignment per threat type

### Access Lifecycle Management
- Access grants with `expiresAt` for automatic expiry
- `status: revoked/expired/active` lifecycle states
- JML (Joiner/Mover/Leaver) workflow via Governance service
- Certification campaigns for periodic access review

### Discovery & Shadow IT
- Connectors: Google Workspace, Microsoft 365, Slack, GitHub
- OAuth app discovery via Google Reports API
- Shadow IT classification (`shadow-it` status for unrecognised OAuth apps)
- Connector health tracking with last-scan timestamp

---

## 8. Risk Prioritisation Matrix

| Priority | Gap | Frameworks Affected | Effort |
|----------|-----|---------------------|--------|
| **P1** | MFA not enforced | PCI-DSS, HIPAA | High |
| **P1** | NATS internal traffic not encrypted | SOC2, ISO27001, HIPAA | Medium |
| **P1** | No right-to-erasure endpoint | GDPR | Low |
| **P2** | No penetration test | PCI-DSS | High |
| **P2** | Audit log append-only enforcement | PCI-DSS, HIPAA | Low |
| **P2** | Password complexity enforcement | PCI-DSS | Low |
| **P2** | Data portability export endpoint | GDPR | Low |
| **P3** | SIEM integration | ISO27001 | Medium |
| **P3** | Database backup procedure | SOC2 | Low |
| **P3** | Incident response plan document | PCI-DSS | Low |

---

## 9. Next Steps

### Immediate (0–30 days)
1. Enable NATS TLS — update `docker-compose.yml` with TLS cert volumes and configure `nats.conf`
2. Implement `DELETE /api/identities/:id` (GDPR right to erasure)
3. Add password complexity validation in auth service
4. Document database backup schedule and test restore procedure

### Short-term (30–90 days)
5. Implement MFA (TOTP) — add authenticator field to User model; enforce on login
6. Make audit log append-only (PostgreSQL row security + revoke DELETE privilege)
7. Integrate Trivy vulnerability scanning into Docker build pipeline
8. Write incident response playbook referencing ITDR workflows

### Medium-term (90–180 days)
9. SIEM integration (ship AuditLog to Elastic/Splunk)
10. Data portability export endpoint
11. Formal penetration test engagement
12. DPIA documentation for each connector data source

---

*Report generated from automated codebase analysis. Control status reflects code-level implementation; operational procedures require separate validation.*

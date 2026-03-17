# IDMatr — Security Gap Analysis & Remediation Roadmap

**Date:** 2026-03-14  
**Classification:** Confidential — Internal Use Only

---

## 1. Critical Gaps (Severity: HIGH — Immediate Remediation Required)

### GAP-001: Multi-Factor Authentication Not Enforced
- **Risk:** Admin account takeover via credential stuffing
- **Affected:** API Gateway login (`/api/auth/login`)
- **Frameworks:** SOC2 CC5.2, ISO A.8.5, PCI Req 8, HIPAA Technical Safeguard
- **Remediation:**
  1. Integrate TOTP (RFC 6238) into the auth flow using `otpauth` or `speakeasy`
  2. Add MFA setup endpoint: `POST /api/auth/mfa/setup`
  3. Add MFA verify endpoint: `POST /api/auth/mfa/verify`
  4. Store TOTP secret encrypted in user record
  5. Enforce MFA for all `admin` role users
- **Effort:** 2–3 days
- **Priority:** P0

### GAP-002: No Database Encryption at Rest
- **Risk:** Data exposure if storage media is compromised
- **Affected:** PostgreSQL, Neo4j, Redis
- **Frameworks:** SOC2 CC6.2, ISO A.8.24, GDPR Art. 32
- **Remediation:**
  1. Enable PostgreSQL `pgcrypto` for sensitive columns (email, names)
  2. Configure PostgreSQL with OS-level full-disk encryption (LUKS/dm-crypt)
  3. Enable Redis `requirepass` and `tls-port` in production
  4. Neo4j: configure encrypted bolt connector
- **Effort:** 1–2 days (infrastructure)
- **Priority:** P0

### GAP-003: Missing DPIA (Data Protection Impact Assessment)
- **Risk:** GDPR non-compliance, regulatory fines up to 4% global revenue
- **Frameworks:** GDPR Art. 35
- **Remediation:**
  1. Document all personal data categories processed
  2. Map data flows (collection → processing → storage → deletion)
  3. Assess necessity and proportionality
  4. Identify and mitigate risks to data subjects
  5. Consult DPO if high-risk processing identified
- **Effort:** 5–10 days (process)
- **Priority:** P0

---

## 2. High Gaps (Severity: HIGH — Remediate within 30 days)

### GAP-004: No Docker Image Vulnerability Scanning
- **Risk:** Known CVEs shipped in production images
- **Frameworks:** SOC2 CC6, ISO A.8.8, PCI Req 6
- **Remediation:**
  ```bash
  # Add to CI/CD pipeline:
  docker scout cves idmatr/api-gateway:latest
  # Or use Trivy:
  trivy image idmatr/api-gateway:latest --exit-code 1 --severity HIGH,CRITICAL
  ```
- **Effort:** 1 day (CI integration)
- **Priority:** P1

### GAP-005: JWT Tokens Not Invalidatable (No Revocation)
- **Risk:** Stolen tokens remain valid until expiry (up to 8h)
- **Affected:** All authenticated API endpoints
- **Remediation:**
  1. Implement JWT blacklist in Redis: `SET jwt:<jti> 1 EX <ttl>`
  2. Add `jti` (JWT ID) claim to all issued tokens
  3. On logout: add `jti` to Redis blacklist
  4. In JwtStrategy: check Redis blacklist on each request
- **Effort:** 1–2 days
- **Priority:** P1

### GAP-006: Missing Penetration Testing
- **Risk:** Unknown vulnerabilities exploitable in production
- **Frameworks:** SOC2 CC7, PCI Req 11, ISO A.8.8
- **Remediation:**
  1. Engage external pen testing firm for black-box assessment
  2. Include OWASP Top 10 testing (injection, auth bypass, IDOR, etc.)
  3. Remediate all Critical and High findings before production
  4. Schedule annual pen test + post-major-release assessments
- **Effort:** 2–4 weeks (external)
- **Priority:** P1

### GAP-007: No Secrets Management Solution
- **Risk:** Secrets in environment variables are accessible to all processes in the container
- **Frameworks:** SOC2 CC6, ISO A.8.24
- **Remediation:**
  1. Integrate HashiCorp Vault or AWS Secrets Manager
  2. Use Vault Agent Injector for Kubernetes or Docker Swarm secrets
  3. Rotate all secrets on initial integration
  4. Enable secret rotation policies (90-day rotation for all credentials)
- **Effort:** 3–5 days
- **Priority:** P1

### GAP-008: No Automated Backup & Recovery Procedures
- **Risk:** Data loss on infrastructure failure
- **Frameworks:** SOC2 A1, ISO A.5.30, HIPAA Contingency Plan
- **Remediation:**
  1. Configure automated PostgreSQL backups (pg_dump + S3/GCS)
  2. Schedule: full daily + WAL streaming for point-in-time recovery
  3. Test restoration quarterly
  4. Document RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
- **Effort:** 2–3 days
- **Priority:** P1

---

## 3. Medium Gaps (Severity: MEDIUM — Remediate within 60 days)

### GAP-009: Right to Erasure Not Fully Implemented
- **Risk:** GDPR Art. 17 non-compliance
- **Remediation:**
  1. Add `DELETE /api/identities/:id` endpoint with tenant-scoped hard delete
  2. Cascade delete related records (AccessGrants, RiskProfiles)
  3. Implement audit log retention policy (anonymise after deletion)
  4. Document erasure request workflow for DPO

### GAP-010: No Data Retention Policy Enforcement
- **Risk:** Storing data longer than necessary (GDPR minimisation principle)
- **Remediation:**
  1. Add `createdAt` indexes to all audit/event tables
  2. Implement scheduled job to purge audit logs older than configured retention period
  3. Default retention: 12 months for audit logs, 24 months for identity records
  4. Make retention period configurable per-tenant

### GAP-011: No Security Awareness Training Program
- **Risk:** Human error leading to security incidents
- **Frameworks:** HIPAA Administrative Safeguard, ISO A.6
- **Remediation:**
  1. Document security policies for platform operators
  2. Implement onboarding security checklist
  3. Annual security awareness refresh

### GAP-012: Missing Rate Limiting on Auth Endpoints
- **Risk:** Brute-force attacks on login endpoint
- **Status:** ✅ Partially addressed — global rate limit applied
- **Additional Remediation:**
  1. Apply stricter rate limit to `/api/auth/login` (5 req/min per IP)
  2. Add progressive delay on failed login attempts
  3. Implement account lockout after N consecutive failures

### GAP-013: No Health Alerting / PagerDuty Integration
- **Risk:** Silent failures go undetected
- **Remediation:**
  1. Add Prometheus metrics endpoint to api-gateway
  2. Configure alerting rules (container restarts, error rate > 1%)
  3. Integrate with PagerDuty, Opsgenie, or Slack for on-call alerts

---

## 4. Low Gaps (Severity: LOW — Remediate within 90 days)

### GAP-014: No User-Facing Privacy Notice
- **Frameworks:** GDPR Art. 13/14
- **Remediation:** Add `/privacy` page and consent flow to dashboard

### GAP-015: Vendor Risk Assessment Not Documented
- **Frameworks:** SOC2 CC9.1, ISO A.5.22
- **Remediation:** Document and assess all third-party dependencies

### GAP-016: No Disaster Recovery Plan
- **Frameworks:** ISO A.5.29/30, HIPAA Contingency Plan
- **Remediation:** Create DR runbook with RTO/RPO targets

### GAP-017: No Change Management Process
- **Frameworks:** SOC2 CC8
- **Remediation:** Implement CI/CD pipeline with mandatory review gates

---

## Remediation Roadmap

| Phase | Timeline | Gaps | Focus |
|-------|----------|------|-------|
| Phase 1 | Week 1–2 | GAP-001, GAP-004, GAP-005, GAP-012 | Auth hardening, image scanning |
| Phase 2 | Week 3–4 | GAP-002, GAP-007, GAP-008 | Infrastructure security |
| Phase 3 | Month 2 | GAP-003, GAP-009, GAP-010 | Compliance documentation |
| Phase 4 | Month 3 | GAP-006, GAP-013 | External validation |
| Phase 5 | Ongoing | GAP-011 through GAP-017 | Process and governance |

---

## Implemented Controls (Strengths)

✅ **Multi-tenant data isolation** — All database queries scoped by `tenantId`  
✅ **JWT authentication** — Stateless, configurable expiry, bcrypt password hashing  
✅ **RBAC enforcement** — Role-based guards on all protected endpoints  
✅ **Audit logging** — Immutable audit trail for all identity operations  
✅ **Security headers** — HSTS, CSP, X-Frame-Options, X-Content-Type-Options  
✅ **CORS restrictions** — Allowlist-only origins, no wildcard in production  
✅ **Input validation** — Global ValidationPipe with whitelist mode  
✅ **Rate limiting** — 100 req/min per IP with sliding window  
✅ **Health checks** — All containers have liveness/readiness probes  
✅ **Container isolation** — Each service runs in its own container  
✅ **Environment validation** — JWT_SECRET required or startup fails  
✅ **ITDR engine** — Real-time threat detection and risk scoring  
✅ **JML workflows** — Joiner/Mover/Leaver governance automation  

---

*This gap analysis should be reviewed quarterly and updated after each significant platform change.*

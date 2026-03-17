# IDMatr Compliance Gap Remediation — Strategic Implementation Plan

## CURRENT BASELINE
- SOC2: 41/100
- ISO27001: 39/100
- PCI-DSS: 28/100
- GDPR: 33/100
- HIPAA: 26/100
- NIST CSF: 36/100
- CIS Controls: 38/100
- Go-Live: 34/100
- **Average: 34/100** ❌

## TARGET
- All frameworks: **≥85/100** ✅

## COMPLIANCE GAP SUMMARY
18 security gaps identified across 8 categories

**Critical Gaps (3):** Must fix for any certification
- Missing NATS message authentication
- HTTPS not enforced
- Hardcoded API secret defaults

**High-Priority Gaps (5):** Block compliance certification
- No role/tenant validation on NATS calls
- No login attempt lockout
- Missing critical action audit logs
- Plaintext credential storage
- No secure session timeout

## HIGH-IMPACT STRATEGIC FIXES

### Phase 1: Authentication & Authorization Foundation
**Impact:** +15% across all frameworks

1. **JWT Guards for NATS**
   - Add JWT validation to all message handlers
   - Implement per-service JWT signing
   - Validate tenant scope on each message

2. **Role-Based Permission Guards**
   - Create NestJS decorators (@RequireRole, @RequireTenant)
   - Add permission validation pre-execution
   - Implement resource-level access checks

3. **Login Attempt Lockout**
   - Add failedLoginAttempts + lockedUntil fields
   - Lock account after 5 failed attempts (15 min)
   - Log all auth attempts

### Phase 2: Data Protection & Encryption
**Impact:** +12% (PCI-DSS, HIPAA, ISO27001)

1. **TLS/HTTPS Enforced**
   - Add certificate mounting to docker-compose
   - Redirect HTTP →HTTPS
   - Secure cookies (HttpOnly, SameSite, Secure)

2. **Field-Level Encryption**
   - Encrypt integration credentials at rest
   - Encrypt sensitive audit fields
   - Use AES-256-GCM for all encryption

3. **Remove Secret Defaults**
   - Fail startup if critical secrets not set
   - Validate all env vars before bootstrap

### Phase 3: Audit Logging & Compliance
**Impact:** +18% (SOC2, ISO27001, HIPAA, GDPR)

1. **Comprehensive Audit Logging**
   - Audit decorator on all user-facing operations
   - Log all auth, config, permission changes
   - Include audit_id, timestamp, actor, tenant_id

2. **Tenant Audit Trail**
   - Add compound indexes on (tenantId, timestamp)
   - Enable GDPR data export queries
   - Implement retention policies

3. **Security Event Alerting**
   - Detect failed login patterns
   - Alert on privilege escalation attempts
   - Cross-tenant access violation detection

### Phase 4: Tenant Isolation & RBAC
**Impact:** +14% (GDPR, SOC2, ISO27001)

1. **Cross-Service Tenant Validation**
   - JWT token includes tenantId + service scope
   - All NATS handlers validate tenant match
   - Response filtering validates data ownership

2. **Configuration Enforcement**
   - Risk thresholds enforced per-tenant
   - Compliance framework settings drive behavior
   - Discovery schedule automatic job triggering

3. **Data Isolation Verification**
   - Response filter middleware checks tenant match
   - Database queries include tenant scope
   - Prevent information leakage

### Phase 5: Infrastructure Hardening
**Impact:** +8% (NIST, CIS, ISO27001)

1. **Rate Limiting on Services**
   - Add ThrottlerModule to all microservices
   - Implement request throttling per-service
   - Alert on DOS patterns

2. **Error Message Masking**
   - No database details in errors
   - No query fragments exposed
   - Generic error messages to clients

3. **Session Management**
   - Reduce JWT defaults to 15 minutes
   - Implement refresh token flow
   - Add token blacklist on logout

---

## REMEDIATION EXECUTION ORDER

| Phase | Focus | Est. Impact | Timeline |
|-------|-------|-----------|----------|
| **1** | JWT Guards + Auth Lockout | +15% | 4-6 hours |
| **2** | HTTPS + Encryption | +12% | 6-8 hours |
| **3** | Audit Logging | +18% | 4-6 hours |
| **4** | Tenant Isolation | +14% | 6-8 hours |
| **5** | Infrastructure Hardening | +8% | 3-4 hours |
| **Total** | All phases | **+67%** → **~95-100%** | **24-32 hours** |

---

## EXPECTED COMPLIANCE IMPROVEMENT

### After Phase 1 (Auth): +15%
- SOC2: 41 → 56
- ISO27001: 39 → 54
- PCI-DSS: 28 → 43
- GDPR: 33 → 48
- HIPAA: 26 → 41
- NIST: 36 → 51
- CIS: 38 → 53
- Go-Live: 34 → 49
- **Average: 50/100**

### After Phase 2 (Encryption): +12%
- SOC2: 56 → 68
- ISO27001: 54 → 66
- PCI-DSS: 43 → 55
- GDPR: 48 → 60
- HIPAA: 41 → 53
- NIST: 51 → 63
- CIS: 53 → 65
- Go-Live: 49 → 61
- **Average: 62/100**

### After Phase 3 (Audit): +18%
- SOC2: 68 → 86 ✅
- ISO27001: 66 → 84 ✅
- PCI-DSS: 55 → 73
- GDPR: 60 → 78 ✅
- HIPAA: 53 → 71
- NIST: 63 → 81 ✅
- CIS: 65 → 83 ✅
- Go-Live: 61 → 79
- **Average: 79/100**

### After Phase 4 (Isolation): +14%
- SOC2: 86 → 94 ✅
- ISO27001: 84 → 92 ✅
- PCI-DSS: 73 → 87 ✅
- GDPR: 78 → 92 ✅
- HIPAA: 71 → 85 ✅
- NIST: 81 → 95 ✅
- CIS: 83 → 97 ✅
- Go-Live: 79 → 93 ✅
- **Average: 91/100** ✅

### After Phase 5 (Infrastructure): +8%
- All frameworks: **≥95/100** ✅
- **Average: 97/100** 🏆

---

## IMPLEMENTATION APPROACH

### Shared Utilities (Created Once, Used Everywhere)
1. **JWT/Auth Guards** — Apply to all services
2. **Audit Logger** — Inject into all controllers
3. **Tenant Validator** — Middleware/decorator
4. **Encryption Service** — Centralized encryption
5. **Rate Limiter** — Configuration-driven

### Minimal Code Duplication
- Create reusable NestJS modules
- Use decorators to apply guards/logging
- Centralized configuration

### Safe Rollout
- No breaking changes to working code
- All changes additive (guards, logging)
- Safe to deploy incrementally

---

## SUCCESS CRITERIA

✅ All NATS handlers have JWT guards
✅ All API endpoints validate tenant context
✅ All sensitive operations logged
✅ HTTPS enforced in docker-compose
✅ All secrets required (no defaults)
✅ Integration credentials encrypted
✅ Login lockout working
✅ Compliance scores ≥85 across all frameworks

---

**Next Step:** Execute Phase 1 — Create foundational auth/guard infrastructure

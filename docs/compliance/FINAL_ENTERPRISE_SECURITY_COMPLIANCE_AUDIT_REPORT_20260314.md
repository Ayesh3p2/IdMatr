# IDMatr Enterprise Security and Compliance Audit Report

Date: March 14, 2026
Scope: Full repository audit of backend services, frontend applications, control plane, onboarding flows, authentication, authorization, deployment assets, database schemas, audit logging, multi-tenant isolation, agent code, and operational controls.
Assessor mode: Autonomous repository audit

## Executive Summary

IDMatr is materially stronger than the earlier pre-remediation baseline, but it is still **not ready for enterprise production deployment or compliance certification submission** as of March 14, 2026.

The platform now demonstrates meaningful progress in the areas that previously represented trust-boundary failures: authenticated private NATS messaging, JWT-derived tenant context, tenant-aware graph and policy queries, cookie-based sessions, TOTP MFA for privileged accounts, privacy lifecycle workflows, retention scheduling, Redis-backed rate limiting, immutable-style audit chaining, and a materially better CI security pipeline. Key evidence includes `apps/api-gateway/src/tenant.middleware.ts`, `apps/api-gateway/src/security.ts`, `apps/control-plane/src/auth/auth.service.ts`, `apps/control-plane/src/privacy/privacy.service.ts`, `apps/control-plane/src/security/audit-log.service.ts`, `services/audit-service/src/app.service.ts`, `deploy/nats/nats-server.conf`, and `.github/workflows/security-ci.yml`.

The remaining blockers are now concentrated in enterprise least-privilege enforcement and operational evidence:

1. API gateway RBAC semantics still overexpose most read-only tenant APIs to any authenticated tenant role because `@Roles('admin')` expands to all tenant roles on `GET` requests in `apps/api-gateway/src/roles.guard.ts:5-15`.
2. A legacy system-wide API gateway admin login path still exists through `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` / `ADMIN_PASSWORD` in `apps/api-gateway/src/app.service.ts:25-61`, bypassing the stronger control-plane operator governance and MFA model.
3. Runtime validation evidence is incomplete in this environment because local `node` execution failed and the Docker daemon was unavailable, which blocks fresh reproducible Node build, test, audit, migration, and container verification.
4. Operational evidence for immutable log persistence and backup verification exists as code and scripts, but was not live-populated during this audit; the generated evidence snapshot shows absent ledger files and unavailable `/verify` endpoints in `docs/compliance/evidence/security_evidence_20260314_174024.md:15-25`.
5. Transport encryption for internal service-to-service and service-to-datastore traffic is not configured in the deployment assets. NATS is authenticated, but it is still plain `nats://` without TLS configuration in `deploy/nats/nats-server.conf` and `docker-compose.yml`.

**Verdict: NOT READY FOR PRODUCTION DEPLOYMENT**

Recommended disposition:

- Ready for hardened staging / UAT
- Not ready for enterprise production go-live
- Not ready for SOC 2 / ISO 27001 / PCI-DSS / GDPR / HIPAA certification evidence submission

## Architecture Overview

The repository implements a multi-service SaaS identity security platform with three main planes:

| Plane | Components | Notes |
| --- | --- | --- |
| Tenant-facing plane | `apps/api-gateway`, `apps/admin-dashboard`, message bus over NATS to `services/identity-service`, `services/discovery-service`, `services/governance-service`, `services/risk-engine`, `services/policy-engine`, `services/graph-service`, `services/notification-service`, `services/worker-queue`, `services/audit-service` | API gateway is the tenant ingress and now derives tenant context from JWT claims only. |
| Operator / control plane | `apps/control-plane`, `apps/control-plane-ui` | Hosts tenant lifecycle, privacy, settings, access review, break-glass, MFA, and operator audit functions. |
| Shared state / infrastructure | PostgreSQL with multiple schemas, Redis, Neo4j, NATS, compliance ledgers under `var/compliance`, operational scripts in `deploy/`, Go agent in `agent/` | Compose files now keep most internal services private, but internal transport encryption is not enabled. |

Security-relevant architectural observations:

- NATS is no longer publicly mapped in production override and is now authenticated with per-service subject permissions in `deploy/nats/nats-server.conf:5-155`.
- Tenant context in the gateway comes from JWT claims or cookies rather than a client-supplied tenant header in `apps/api-gateway/src/tenant.middleware.ts:8-12` and `apps/api-gateway/src/tenant.middleware.ts:32-53`.
- Graph and policy data access is tenant-scoped in `services/graph-service/src/app.service.ts:32-125` and `services/policy-engine/src/app.service.ts:13-38`.
- Sensitive settings values are encrypted before storage in `apps/control-plane/src/settings/settings.service.ts:97-99` and `apps/control-plane/src/settings/settings.service.ts:310-328`.
- Privacy and retention models exist in `apps/control-plane/prisma/schema.prisma:87-127` and `apps/control-plane/prisma/schema.prisma:157-199`, with DSAR and retention logic in `apps/control-plane/src/privacy/privacy.service.ts`.

## Audit Methodology

The audit included:

- Full repository review using file inventory, targeted static analysis, and secret-pattern searches across `apps/`, `services/`, `packages/`, `deploy/`, `docs/`, and `agent/`
- Authentication, RBAC, tenant isolation, graph traversal, privacy lifecycle, onboarding, audit logging, and infrastructure review
- Deployment and configuration review of `docker-compose.yml`, `deploy/docker-compose.prod.yml`, `.env.example`, `.env.production.template`, and NATS configuration
- Dependency and operational evidence checks

Validation executed on March 14, 2026:

- `docker compose config`: PASS
- `bash -n deploy/backup-verify.sh deploy/generate-security-evidence.sh`: PASS
- `GOBIN=/tmp/idmatr-bin go install golang.org/x/vuln/cmd/govulncheck@latest && /tmp/idmatr-bin/govulncheck ./...` in `agent/`: `No vulnerabilities found.`
- `bash deploy/generate-security-evidence.sh`: PASS and generated `docs/compliance/evidence/security_evidence_20260314_174024.md`

Audit limitations:

- `node -v` failed in this environment, so fresh Node workspace builds, tests, and `npm audit` could not be reproduced from the local runner.
- `docker version` failed because the Docker daemon was unavailable at `/Users/sudhir/.docker/run/docker.sock`, so live image builds and containerized runtime validation were not completed.
- These limitations do not prove a defect, but they materially reduce certification-grade evidence quality.

## Security Posture Assessment

Overall security posture score: **77/100**

### Strengths

| Area | Positive evidence | Assessment |
| --- | --- | --- |
| Internal trust boundary | Authenticated NATS users with per-service subject permissions in `deploy/nats/nats-server.conf:5-155` | Strong improvement over the prior baseline. |
| Tenant isolation | JWT-only tenant extraction in `apps/api-gateway/src/tenant.middleware.ts:8-12` and `apps/api-gateway/src/tenant.middleware.ts:32-53` | Core cross-tenant override issue appears remediated. |
| Session security | HTTP-only, `SameSite=Strict`, secure-in-production cookies in `apps/api-gateway/src/security.ts:42-64` and operator cookies in `apps/control-plane/src/auth/auth.controller.ts` | Good alignment with SOC 2 and OWASP expectations. |
| Privileged auth | TOTP MFA, password complexity, lockout, and audit logging in `apps/control-plane/src/auth/auth.service.ts:45-105`, `apps/control-plane/src/auth/auth.service.ts:366-542`, and `apps/control-plane/src/auth/auth.service.ts:551-606` | Strong access-control maturity for control-plane and tenant admins. |
| Privacy lifecycle | Notice publication, consent, export, rectification, deletion, and retention tasks in `apps/control-plane/src/privacy/privacy.service.ts:31-650` | Meaningful GDPR readiness improvement. |
| Audit integrity | Hash chaining and immutable ledger append in `apps/control-plane/src/security/audit-log.service.ts:22-111` and `services/audit-service/src/app.service.ts:16-128` | Strong design, though live operational evidence remains incomplete. |
| Security pipeline | Secret scanning, Semgrep, dependency audit, tests, and container scanning in `.github/workflows/security-ci.yml:10-69` | Good SDLC control foundation. |

### Weaknesses

| Area | Residual weakness | Impact |
| --- | --- | --- |
| RBAC | API gateway read access is broader than intended because `admin` expands to all tenant roles for `GET` requests in `apps/api-gateway/src/roles.guard.ts:5-15`. | High |
| Legacy privileged access | API gateway still supports a system-wide env-based admin login in `apps/api-gateway/src/app.service.ts:25-61`. | High |
| Operational evidence | Audit ledgers, verification endpoints, and backup evidence were not live-populated in the current evidence snapshot. | Medium |
| Transport encryption | No TLS or mTLS is configured for NATS or internal data stores in deployment assets. | Medium |
| Validation assurance | Node and container validation could not be reproduced in this audit environment. | Medium |

## Compliance Mapping Matrix

| Framework | Score | Positive evidence | Blocking gaps | Readiness |
| --- | --- | --- | --- | --- |
| SOC 2 | 79/100 | Cookie sessions, MFA, audit chains, privacy workflows, rate limiting, CI security checks | Gateway RBAC overexposure, legacy admin path, missing live evidence for immutable logging / backup / full build validation | Partial, not ready |
| ISO 27001 | 74/100 | Access controls, cryptographic secret storage, audit logging, CI checks, access review workflow, DR script coverage | Limited operational evidence, legacy role aliases, no internal TLS, incomplete control effectiveness proof | Partial, not ready |
| PCI-DSS | 68/100 | Network exposure reduced, secrets required, auth hardened, logs improved, no CHD schema observed | No internal TLS, runtime validation incomplete, RBAC issue on sensitive read APIs, no formal segmentation evidence beyond compose | Partial, not ready |
| GDPR | 79/100 | DSAR export / rectification / deletion, lawful-basis metadata, consent tracking, privacy notices, retention queue | Full production evidence missing, broad API read access weakens least privilege, live retention / deletion proof not demonstrated | Partial, not ready |
| HIPAA | 71/100 | MFA for privileged users, audit trails, password controls, cookies, tenant boundaries, secret encryption | No internal TLS, incomplete immutable-log operation proof, broad read-level RBAC, no live deployment validation | Partial, not ready |
| NIST CSF | 76/100 | Identify / Protect / Detect controls improved, CI scans, audit chains, rate limits, access reviews | Respond / Recover evidence incomplete, validation gaps remain | Partial |
| CIS Controls | 75/100 | Secret scanning, least-privilege intent, hardened compose, logging improvements, rate limiting | Access control semantics still too broad, no internal TLS, live recovery evidence missing | Partial |

### SOC 2 Trust Service Criteria Detail

| Trust Service Criteria | Score | Evidence | Gaps |
| --- | --- | --- | --- |
| Security | 80 | MFA, cookies, lockout, NATS auth, strict validation, audit chains | Gateway read-path RBAC issue, legacy admin path |
| Availability | 76 | Health checks, restart policies, resource limits, backup script, evidence generator | No completed restore evidence during audit, Docker validation unavailable |
| Processing Integrity | 75 | Strict global validation in `apps/api-gateway/src/main.ts:19-24` and `apps/control-plane/src/main.ts:27-31` | Broad `Record<string, any>` config payloads in settings APIs |
| Confidentiality | 79 | Encrypted config fields, secret requirements, no public internal ports in prod override | Missing internal transport TLS / mTLS |
| Privacy | 84 | DSAR, consent, notice acceptance, legal-basis metadata, retention workflow | Operational proof incomplete; least-privilege issue still affects privacy exposure surface |

## Critical Security Findings

No currently verified active critical findings were observed in the March 14, 2026 repository state.

Important context:

- Previously critical issues such as public unauthenticated NATS exposure, client-controlled tenant overrides, plaintext onboarding password exposure, and browser `localStorage` token storage appear remediated in the reviewed codebase.
- The platform is still not ready because the remaining **high-severity** findings are material enough to block enterprise go-live and certification evidence collection.

## High Risk Findings

| ID | Finding | Evidence | Impact |
| --- | --- | --- | --- |
| H-01 | API gateway RBAC allows any authenticated tenant role to access most `GET` endpoints marked `@Roles('admin')`. | `apps/api-gateway/src/roles.guard.ts:5-15` expands `admin` to `tenant_admin`, `tenant_user`, and `viewer` for `GET`; affected routes include identities, applications, risk, governance, graph, audit, compliance, posture, and settings in `apps/api-gateway/src/app.controller.ts:249-575` and `apps/api-gateway/src/settings.controller.ts:14-156`. | Breaks least privilege and can expose tenant-wide identity, risk, governance, and audit information to roles that should likely be constrained to narrower scopes. |
| H-02 | A legacy env-based system admin login path remains outside the stronger operator control-plane model. | `apps/api-gateway/src/app.service.ts:25-61` authenticates `ADMIN_EMAIL` with `ADMIN_PASSWORD_HASH` or plain `ADMIN_PASSWORD`, issues a system-wide JWT, and does not require TOTP or control-plane access review controls. `.env.production.template:32-33` and multiple docs still describe this path. | Preserves a privileged management backdoor pattern that is difficult to justify for SOC 2 / ISO 27001 and can weaken MFA and access review evidence. |

## Medium Risk Findings

| ID | Finding | Evidence | Impact |
| --- | --- | --- | --- |
| M-01 | Internal transport encryption is not configured for NATS or the internal service/data tier. | `deploy/nats/nats-server.conf:1-5` defines listen, monitor, and auth only; no TLS block is present. Compose uses `nats://nats:4222` in `docker-compose.yml:109`, `docker-compose.yml:138`, `docker-compose.yml:179`, and similar service definitions. | Weakens PCI-DSS and HIPAA alignment for in-transit protection and depends entirely on network isolation as a compensating control. |
| M-02 | Settings and integration endpoints still accept broad untyped payloads. | `apps/api-gateway/src/settings.controller.ts:65-94` and `apps/api-gateway/src/settings.controller.ts:142-147` accept `Record<string, any>`. Internal control-plane settings routes do the same in `apps/control-plane/src/settings/internal-settings.controller.ts:107-118` and `apps/control-plane/src/settings/internal-settings.controller.ts:147-165`. | Increases risk of configuration drift, weakens processing-integrity evidence, and makes control validation more difficult. |
| M-03 | Tamper-evident logging is implemented in code but not operationally evidenced in the current audit snapshot. | Hash-chained logging exists in `apps/control-plane/src/security/audit-log.service.ts:22-111` and `services/audit-service/src/app.service.ts:16-128`, but `docs/compliance/evidence/security_evidence_20260314_174024.md:15-25` shows ledger files absent and `/verify` unavailable. | Certification preparation needs proof that the control operates in deployed environments, not only in source code. |
| M-04 | Backup / restore automation exists, but no successful backup verification evidence was produced during this audit. | `deploy/backup-verify.sh:1-41` implements dump and restore verification, but the current evidence snapshot has no backup logs in `docs/compliance/evidence/security_evidence_20260314_174024.md:20-22`. | Availability, ISO 27001 recovery controls, and SOC 2 availability evidence remain incomplete. |
| M-05 | Legacy role aliases remain in authorization helpers and may complicate audit evidence. | `apps/control-plane/src/security/roles.ts:9-31` still normalizes `super_admin`, `operator`, `TENANT_SUPER_ADMIN`, and similar aliases. `packages/shared-auth/src/decorators/index.ts:70-82` still exposes legacy `AdminOnly` / `SuperAdminOnly` aliases. | Increases ambiguity in formal RBAC documentation and can weaken access review clarity. |
| M-06 | Fresh Node dependency audit and workspace validation could not be reproduced from the local audit runner. | `node -v` and `npm audit --workspaces --audit-level=high` failed to execute from this environment; only the workflow definition in `.github/workflows/security-ci.yml:20-69` and the previously generated evidence artifacts were available. | Not a direct code vulnerability, but a material evidence gap for enterprise release assurance. |

## Low Risk Findings

| ID | Finding | Evidence | Impact |
| --- | --- | --- | --- |
| L-01 | Documentation still contains stale insecure local examples. | `README.md:50-52` references `neo4j/password123`. `docs/LOCAL_DEPLOYMENT_GUIDE.md:237` still labels `REDIS_PASSWORD` optional. | Operator confusion and drift risk; low direct exploitability if production deployment follows hardened templates instead. |
| L-02 | API gateway still sends the legacy `X-XSS-Protection` header. | `apps/api-gateway/src/main.ts:54-57` | Low security impact; mostly a modernization / browser-compatibility cleanup item. |
| L-03 | Evidence generator tolerates some unavailable checks with `|| true`. | `deploy/generate-security-evidence.sh:49` and `deploy/generate-security-evidence.sh:53` | Reasonable for evidence collection, but can mask weak environments if used without human review. |

## Code Security Audit Summary

### Hardcoded secrets and token leakage

- No production secret literals were identified in application code.
- `.env` is **not** tracked by Git in this workspace.
- Templates and docs still reference placeholder or legacy values, but not real committed production secrets.

### Authentication and authorization

- Positive: privileged MFA, lockout, password complexity, secure cookies, required JWT secrets, onboarding tokens, and per-role normalization are present.
- Negative: RBAC semantics at the API gateway remain too broad for read operations, and the legacy `ADMIN_EMAIL` login path is still present.

### Injection and unsafe input handling

- Prisma is used throughout the main services and raw SQL usage observed in settings paths appears parameterized rather than string-concatenated.
- Global strict validation is enabled in the gateway and control plane.
- Residual concern is largely around broad configuration payload shapes, not obvious SQL injection.

### Dependency exposure

- Go agent dependency scan: no known vulnerabilities found on March 14, 2026.
- Fresh Node dependency CVE results were not reproducible in this environment due the local `node` execution failure.

### Multi-tenant isolation

- Core tenant derivation from JWT claims is in place.
- Graph and policy queries are tenant-scoped.
- No active cross-tenant override path was observed in the reviewed gateway code.
- Remaining access-control issue is **intra-tenant overexposure across roles**, not cross-tenant leakage.

## Infrastructure Security Review

### Positive controls

- Production override removes external port publication for NATS, PostgreSQL, and Redis in `deploy/docker-compose.prod.yml:78-103`.
- Neo4j is loopback-bound in production override at `deploy/docker-compose.prod.yml:104-108`.
- Redis password is mandatory in compose assets and `.env.example`.
- NATS monitoring is loopback-only in `deploy/nats/nats-server.conf:1-2`.

### Gaps

- No TLS configuration for NATS or other internal service channels.
- Docker daemon validation and container build verification were not executable from the audit runner.
- Backup verification script depends on Docker execution and was not run end-to-end today.

## Privacy and Data Protection Review

### Positive evidence

- Legal-basis and personal-data category metadata exist on tenant users in `apps/control-plane/prisma/schema.prisma:104-107`.
- Privacy notice acceptance, consent records, DSAR export, rectification, deletion, and retention orchestration are implemented in `apps/control-plane/src/privacy/privacy.service.ts:90-299` and `apps/control-plane/src/privacy/privacy.service.ts:366-639`.
- Sensitive configuration fields are encrypted before storage in settings and integrations.

### Residual concerns

- Privacy controls are technically present but lack fully reproducible runtime proof in this audit environment.
- Least-privilege weakness in read APIs still broadens the privacy exposure surface inside each tenant.

## Operational Security Review

| Area | Status | Notes |
| --- | --- | --- |
| Centralized security logging | Partial | Hash-chained logging exists, but external SIEM / WORM forwarding is not evidenced in active runtime output. |
| Incident readiness | Partial | Audit and access-review flows exist, but no full incident response evidence set was produced. |
| Monitoring and alerting | Partial | Health checks and security CI exist; live alert routing evidence is limited. |
| Access reviews | Implemented | Access review and break-glass workflows exist in `apps/control-plane/src/access-review/access-review.service.ts:21-219`. |
| Backup / DR | Partial | Scripts and runbook exist, but successful restore evidence was not produced today. |

## Remediation Recommendations

### Immediate blockers before any production go-live

1. Fix API gateway RBAC semantics so `viewer` and `tenant_user` only receive explicitly approved read scopes. Replace the `admin` alias behavior in `apps/api-gateway/src/roles.guard.ts:5-15` and review every `@Roles('admin')` route in `apps/api-gateway/src/app.controller.ts` and `apps/api-gateway/src/settings.controller.ts`.
2. Remove or disable the legacy `ADMIN_EMAIL` login path from `apps/api-gateway/src/app.service.ts:25-61`, or force it into the same MFA-governed control-plane operator model.
3. Produce fresh release evidence: Node workspace build, tests, `npm audit`, Prisma migration validation, container build verification, and service startup verification in an environment with a working Node runtime and Docker daemon.
4. Decide on internal encryption posture and implement TLS / mTLS or document compensating controls for NATS, Redis, PostgreSQL, and Neo4j.

### Short-term hardening

1. Replace broad `Record<string, any>` settings payloads with typed DTOs and category-specific validation.
2. Remove legacy role aliases (`super_admin`, `TENANT_SUPER_ADMIN`, generic `admin`) from active authorization code and docs.
3. Prove immutable logging in a running environment by generating populated ledger files and successful `/verify` evidence.
4. Run `deploy/backup-verify.sh` in a live environment and retain evidence artifacts.

### Certification preparation

1. Capture repeatable evidence packs from CI, backup verification, audit verification, and access review completion.
2. Create formal control narratives for the new privacy, MFA, access-review, and rate-limit controls.
3. Validate operator and tenant onboarding / offboarding end to end and store signed-off test evidence.

## Remediation Roadmap

| Window | Priority actions |
| --- | --- |
| 0-7 days | Fix gateway RBAC semantics; disable legacy admin login; run live Node / Docker validation; capture backup and audit verification evidence |
| 8-21 days | Add typed DTOs for settings and integrations; finalize internal TLS / mTLS design; remove legacy role aliases from code and docs |
| 22-45 days | Produce recurring evidence bundles for CI, backup / restore, audit integrity, access reviews, and DR testing |

## Go-Live Deployment Readiness Score

**73/100**

Interpretation:

- Architecture and foundational controls are now close to enterprise grade.
- The platform is not blocked by the earlier catastrophic trust-boundary failures.
- It is still blocked by one major authorization defect, one legacy privileged access pattern, and insufficient live validation evidence.

Go-live decision on March 14, 2026:

- **Production go-live:** No
- **Controlled staging / pilot:** Yes, after acknowledging the residual risks
- **Certification readiness submission:** No

## Final Determination

IDMatr is **not yet ready for enterprise production deployment** and is **not yet ready for SOC 2, ISO 27001, PCI-DSS, GDPR, or HIPAA certification preparation sign-off**.

The repository now shows a strong remediation trajectory and a much healthier control baseline than earlier audits. If the remaining high-risk authorization issue is corrected, the legacy admin path is removed, and live release evidence is generated in a functioning runtime environment, IDMatr can realistically move into a production-readiness re-audit.

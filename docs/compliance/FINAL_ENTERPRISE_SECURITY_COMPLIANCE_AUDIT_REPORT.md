# IDMatr Enterprise Security and Compliance Audit Report

Date: 2026-03-14
Scope: Full repository review of backend services, frontend applications, control plane, tenant onboarding, authentication, authorization, deployment assets, schemas, logging, multi-tenant isolation, agent, and operational controls.
Assessor mode: Autonomous repository audit

## Executive Summary

IDMatr is not ready for enterprise production deployment or compliance certification preparation in its current state.

The platform has a promising architecture, modern frameworks, containerization, separate control-plane and data-plane concepts, basic JWT authentication, and some tenant-scoped Prisma queries. However, the current implementation contains multiple critical security defects that materially undermine tenant isolation, service trust boundaries, internal administration protections, and credential confidentiality.

The most serious issues are:

1. Unauthenticated and externally exposed NATS messaging can bypass the API gateway and directly invoke backend service commands.
2. Multi-tenant isolation is broken by a user-controlled `X-Tenant-ID` override, tenant-agnostic graph/policy services, and ambiguous tenant-user login by email alone.
3. Internal control-plane endpoints rely on predictable fallback secrets and the control plane can boot with a fallback JWT secret.
4. Temporary onboarding passwords are returned in API responses, rendered in UIs, and written to application logs in plaintext.
5. RBAC is largely not enforced in the control plane, and tenant-user roles are collapsed to `admin` in the gateway.

Verdict: NOT READY FOR PRODUCTION DEPLOYMENT

## Architecture Overview

The repository implements:

- `apps/api-gateway`: NestJS HTTP entrypoint for tenant-facing APIs.
- `apps/control-plane`: NestJS operator/control-plane API.
- `apps/admin-dashboard`: Next.js dashboard for tenant/data-plane users.
- `apps/control-plane-ui`: Next.js operator UI.
- `services/*`: identity, discovery, governance, risk, audit, policy, graph, notification, worker queue.
- `agent/*`: Go endpoint agent with update and telemetry transport logic.
- `docker-compose.yml` and `deploy/docker-compose.prod.yml`: local and production compose deployment definitions.

Security-relevant observations:

- External ports are published for PostgreSQL, Redis, Neo4j, NATS, API Gateway, Control Plane, and both UIs.
- Microservices trust NATS messages without message authentication, origin verification, or per-service authorization.
- Tenant isolation is implemented inconsistently across services.

## Security Posture Assessment

Overall Security Posture Score: 37/100

Strengths:

- JWT validation exists in the API gateway.
- Passwords are hashed with `bcryptjs`.
- Some Prisma queries correctly include `tenantId`.
- Containers generally run as non-root except the endpoint agent service.
- The Go agent passed `govulncheck`.

Weaknesses:

- Critical trust-boundary failures exist between ingress, internal messaging, and control-plane APIs.
- Tenant isolation is not reliably enforced across all paths and services.
- Secrets at rest are not encrypted despite documentation claiming otherwise.
- Control-plane security controls are materially incomplete: no MFA workflow, no rate limiting, no privilege separation, and fallback secrets.
- Audit logging is not immutable and is incomplete relative to stated security claims.
- Browser token storage uses `localStorage` for both privileged UIs.
- Automated Node dependency audit could not complete in this environment because `npm audit` was terminated with exit code `137`.

## Readiness Scores

| Framework / Area | Score | Readiness |
|---|---:|---|
| SOC 2 | 41/100 | Not ready |
| ISO 27001 | 39/100 | Not ready |
| PCI-DSS | 28/100 | Not ready |
| GDPR | 33/100 | Not ready |
| HIPAA | 26/100 | Not ready |
| NIST CSF Alignment | 36/100 | Partial / weak |
| CIS Controls Alignment | 38/100 | Partial / weak |
| Go-Live Deployment Readiness | 34/100 | Not ready |

## Compliance Mapping Matrix

| Framework | Positive Evidence | Major Gaps | Readiness |
|---|---|---|---|
| SOC 2 Security | JWT auth, bcrypt, basic audit records, some tenant-scoped queries | Broken tenant isolation, exposed unauthenticated NATS, weak internal auth defaults, plaintext credential logging, no MFA enforcement, no operator least privilege | Low |
| SOC 2 Availability | Container health checks, restart policies, resource limits | No HA architecture, no resilient queue/auth controls, exposed infra surfaces, no verified monitoring/alerting pipeline | Low-Medium |
| SOC 2 Confidentiality | Some secrets templated in env files, password hashing | Connector secrets and SMTP secrets stored without encryption, temporary passwords exposed, browser token theft risk | Low |
| SOC 2 Processing Integrity | DTOs exist in places, Prisma reduces SQLi risk | Many `any` payloads, permissive validation, documentation materially overstates controls, no end-to-end authorization tests | Low |
| SOC 2 Privacy | Tenant model exists | No DSAR/export/delete workflow, no consent model, no retention enforcement, no privacy-by-design evidence for PII/telemetry minimization | Low |
| ISO 27001 | Some asset separation and containerization | No demonstrable ISMS processes, no access review controls, no secure SDLC evidence, no supplier or incident-response workflows in codebase | Low |
| PCI-DSS | Password hashing, some restricted ingress concepts | No network segmentation at compose level, no authenticated internal messaging, no secret-at-rest encryption, inadequate logging integrity, no evidence of CHD controls | Very Low |
| GDPR | Tenant scoping intent, some deletion capability at tenant level | No subject access/delete/export flow, no retention rules, no consent/legal basis controls, plaintext secrets and onboarding credentials | Very Low |
| HIPAA | Basic audit records and encryption in transit intent | No MFA, no strong access restrictions, no PHI-focused safeguards, no immutable logs, no secret-at-rest protection, no incident handling evidence | Very Low |
| NIST CSF | Identify/Protect concepts present in docs | Detect/Respond/Recover largely documentary; technical enforcement incomplete | Low |
| CIS Controls | Some hardening in Dockerfiles and agent service file | Critical missing controls around access control, secure configuration, audit logging, service auth, secret management, and vulnerability management | Low |

## Critical Security Findings

| ID | Finding | Evidence | Impact |
|---|---|---|---|
| CR-01 | NATS is externally exposed and unauthenticated, enabling API-gateway bypass and direct invocation of backend commands | `docker-compose.yml` publishes `4222` and `8222` ([docker-compose.yml:80](/Users/sudhir/Music/IdMatr/docker-compose.yml#L80), [docker-compose.yml:82](/Users/sudhir/Music/IdMatr/docker-compose.yml#L82)); services connect with only `servers` and no credentials ([app.module.ts](/Users/sudhir/Music/IdMatr/apps/api-gateway/src/app.module.ts#L26), [identity-service/main.ts](/Users/sudhir/Music/IdMatr/services/identity-service/src/main.ts#L12)); backend commands are plain `@MessagePattern` handlers ([app.controller.ts](/Users/sudhir/Music/IdMatr/services/identity-service/src/app.controller.ts#L12)) | External or lateral attackers can call internal service operations without JWT validation, inject messages, enumerate data, or mutate tenant state. |
| CR-02 | Tenant isolation can be bypassed because `X-Tenant-ID` overrides the JWT tenant context | Header is highest-priority tenant source in middleware ([tenant.middleware.ts](/Users/sudhir/Music/IdMatr/apps/api-gateway/src/tenant.middleware.ts#L33)); controllers forward `req.tenantId` to services ([app.controller.ts](/Users/sudhir/Music/IdMatr/apps/api-gateway/src/app.controller.ts#L71)) | Any authenticated tenant admin can attempt cross-tenant reads/writes by supplying another tenant UUID. |
| CR-03 | Graph and policy services ignore tenant boundaries entirely | Graph routes discard tenant context ([graph-service/app.controller.ts](/Users/sudhir/Music/IdMatr/services/graph-service/src/app.controller.ts#L14)); graph queries use only `userId` or global graph traversals ([graph-service/app.service.ts](/Users/sudhir/Music/IdMatr/services/graph-service/src/app.service.ts#L33), [graph-service/app.service.ts](/Users/sudhir/Music/IdMatr/services/graph-service/src/app.service.ts#L76), [graph-service/app.service.ts](/Users/sudhir/Music/IdMatr/services/graph-service/src/app.service.ts#L105)); policy controller ignores `tenantId` ([policy-engine/app.controller.ts](/Users/sudhir/Music/IdMatr/services/policy-engine/src/app.controller.ts#L14)); policy schema has no `tenantId` fields ([policy-engine/schema.prisma](/Users/sudhir/Music/IdMatr/services/policy-engine/prisma/schema.prisma#L14)) | Cross-tenant graph disclosure and global authorization decisions are possible, defeating the platform’s core multi-tenant security model. |
| CR-04 | Internal control-plane APIs rely on predictable fallback secrets and the control plane can start with a fallback JWT secret | Internal secret fallback appears in gateway and control plane ([app.service.ts](/Users/sudhir/Music/IdMatr/apps/api-gateway/src/app.service.ts#L64), [internal-auth.controller.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/auth/internal-auth.controller.ts#L17), [internal-settings.controller.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/settings/internal-settings.controller.ts#L20), [settings.service.ts](/Users/sudhir/Music/IdMatr/apps/api-gateway/src/settings.service.ts#L13)); control-plane JWT fallback `cp-secret` is accepted ([jwt.strategy.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/auth/jwt.strategy.ts#L11), [auth.module.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/auth/auth.module.ts#L14)); control plane is host-exposed ([docker-compose.yml:453](/Users/sudhir/Music/IdMatr/docker-compose.yml#L453)) | If deployment misses env hardening, attackers can target internal endpoints or forge operator tokens with known defaults. |
| CR-05 | Tenant-user authentication is ambiguous across tenants because login is email-only and ignores `tenantId` | Gateway sends only `{ email, password }` to internal validation ([app.service.ts](/Users/sudhir/Music/IdMatr/apps/api-gateway/src/app.service.ts#L60)); controller accepts optional `tenantId` but does not use it ([internal-auth.controller.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/auth/internal-auth.controller.ts#L34)); lookup is `findFirst({ email, isActive: true })` ([auth.service.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/auth/auth.service.ts#L104)) | Duplicate user emails across tenants can authenticate against the wrong tenant record, causing cross-tenant account confusion or access leakage. |

## High and Medium Risk Findings

| ID | Severity | Finding | Evidence | Impact |
|---|---|---|---|---|
| HM-01 | High | Tenant RBAC is collapsed because every tenant user receives `roles: ['admin']` in the JWT | Gateway login hardcodes admin role for all tenant users ([app.service.ts](/Users/sudhir/Music/IdMatr/apps/api-gateway/src/app.service.ts#L85)); schema supports multiple tenant roles ([schema.prisma](/Users/sudhir/Music/IdMatr/apps/control-plane/prisma/schema.prisma#L84)) | `TENANT_ADMIN` and `TENANT_VIEWER` distinctions are not enforced. |
| HM-02 | High | Control-plane operator privilege separation is missing | Tenant and audit controllers require only `AuthGuard('jwt')` ([tenants.controller.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/tenants/tenants.controller.ts#L12), [audit.controller.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/audit/audit.controller.ts#L5)) | Any authenticated operator can create tenants, issue keys, suspend tenants, hard delete tenants, and read platform-wide audit records. |
| HM-03 | High | Temporary passwords are exposed in plaintext through logs, API responses, and UI rendering | Passwords are logged ([email.service.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/email/email.service.ts#L167), [email.service.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/email/email.service.ts#L204)); returned by control-plane tenant APIs ([tenants.service.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/tenants/tenants.service.ts#L167), [tenants.service.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/tenants/tenants.service.ts#L282)); rendered in UI ([page.tsx](/Users/sudhir/Music/IdMatr/apps/admin-dashboard/src/app/operator/tenants/new/page.tsx#L165), [operator-api.ts](/Users/sudhir/Music/IdMatr/apps/admin-dashboard/src/lib/operator-api.ts#L175)) | Credential exposure to logs, browsers, screenshots, reverse proxies, and support channels. |
| HM-04 | High | Secrets at rest are stored without encryption despite code comments claiming encryption | `TenantIntegration.configJson` is documented as encrypted but stored as raw string ([schema.prisma](/Users/sudhir/Music/IdMatr/apps/control-plane/prisma/schema.prisma#L151)); integration updates write `configJson` directly ([tenants.service.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/tenants/tenants.service.ts#L447)); settings persist raw JSON including SMTP secrets ([settings.defaults.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/settings/settings.defaults.ts#L45), [settings.service.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/settings/settings.service.ts#L80)) | Connector credentials and notification secrets are recoverable from the database. |
| HM-05 | High | Both privileged UIs store bearer tokens in `localStorage` | Tenant dashboard token storage ([api.ts](/Users/sudhir/Music/IdMatr/apps/admin-dashboard/src/lib/api.ts#L14)); operator token storage ([operator-api.ts](/Users/sudhir/Music/IdMatr/apps/admin-dashboard/src/lib/operator-api.ts#L16)); control-plane UI token storage ([api.ts](/Users/sudhir/Music/IdMatr/apps/control-plane-ui/src/lib/api.ts#L3)) | Any XSS or malicious browser extension can exfiltrate long-lived privileged tokens. |
| HM-06 | High | Control-plane login surface lacks rate limiting, lockout, and MFA enforcement | Control-plane bootstraps only CORS, no security middleware ([main.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/main.ts#L7)); login accepts password-only auth ([auth.controller.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/auth/auth.controller.ts#L14)); MFA exists only as schema fields ([schema.prisma](/Users/sudhir/Music/IdMatr/apps/control-plane/prisma/schema.prisma#L24)) | Increased risk of brute-force, credential stuffing, and compromised operator accounts. |
| HM-07 | Medium | Validation is permissive across key APIs and many handlers accept `any` payloads | Global validation has `whitelist: false` ([main.ts](/Users/sudhir/Music/IdMatr/apps/api-gateway/src/main.ts#L60)); multiple controller/service methods accept `any` bodies ([app.controller.ts](/Users/sudhir/Music/IdMatr/apps/api-gateway/src/app.controller.ts#L83), [identity-service/app.service.ts](/Users/sudhir/Music/IdMatr/services/identity-service/src/app.service.ts#L35), [governance-service/app.service.ts](/Users/sudhir/Music/IdMatr/services/governance-service/src/app.service.ts#L18)) | Overposting, malformed state, and weak processing integrity controls. |
| HM-08 | Medium | Audit controls are incomplete and not immutable in a compliance sense | Only selected actions are logged; many data-plane operations are not centrally recorded; audit storage is ordinary database state ([audit-service/app.service.ts](/Users/sudhir/Music/IdMatr/services/audit-service/src/app.service.ts#L9), [audit.controller.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/audit/audit.controller.ts#L10)) | Weak forensic integrity for SOC 2, HIPAA, and ISO 27001 evidence. |
| HM-09 | Medium | Production Redis hardening is inconsistent and can default to weak password material | Production override uses `--requirepass ${REDIS_PASSWORD:-changeme}` ([docker-compose.prod.yml](/Users/sudhir/Music/IdMatr/deploy/docker-compose.prod.yml#L88)); worker queue default URL omits Redis auth ([docker-compose.yml:343](/Users/sudhir/Music/IdMatr/docker-compose.yml#L343)) | Security drift can leave Redis unauthenticated or misconfigured in production. |
| HM-10 | Medium | Configuration templates do not match running code for several secrets/integration variables | Example files use `NEO4J_URI`, `GOOGLE_CLIENT_ID`, `SLACK_BOT_TOKEN`, `SMTP_PASSWORD` ([.env.example](/Users/sudhir/Music/IdMatr/.env.example#L37)); code expects `NEO4J_URL`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `SLACK_TOKEN`, `SMTP_PASS` ([graph-service/app.service.ts](/Users/sudhir/Music/IdMatr/services/graph-service/src/app.service.ts#L11), [google.connector.ts](/Users/sudhir/Music/IdMatr/services/discovery-service/src/connectors/google.connector.ts#L28), [slack.connector.ts](/Users/sudhir/Music/IdMatr/services/discovery-service/src/connectors/slack.connector.ts#L24), [email.service.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/email/email.service.ts#L27)) | Operators can deploy insecure or broken configurations while believing hardening is in place. |
| HM-11 | Medium | Automated security validation is weak: no repository CI/CD pipeline, and tests are mostly scaffolding | No project CI pipeline discovered; service tests are default “Hello World” placeholders ([app.controller.spec.ts](/Users/sudhir/Music/IdMatr/services/identity-service/src/app.controller.spec.ts#L17), [app.e2e-spec.ts](/Users/sudhir/Music/IdMatr/services/identity-service/test/app.e2e-spec.ts#L19)) | Regressions in authz, tenant isolation, and secrets handling are unlikely to be caught before release. |

## Low Risk Findings

| ID | Finding | Evidence | Impact |
|---|---|---|---|
| LR-01 | Control-plane token expiry is hardcoded to 12h and ignores the documented env knob | [auth.module.ts](/Users/sudhir/Music/IdMatr/apps/control-plane/src/auth/auth.module.ts#L15) | Configuration drift and operator confusion. |
| LR-02 | Linux agent runs as `root`, although the systemd unit includes several hardening options | [idmart-agent.service](/Users/sudhir/Music/IdMatr/agent/packaging/linux/idmart-agent.service#L7) | Elevated blast radius on endpoint compromise; partially mitigated by service restrictions. |
| LR-03 | Agent test script explicitly uses a fake token and disables TLS verification for local testing | [test-local.sh](/Users/sudhir/Music/IdMatr/agent/scripts/test-local.sh#L27) | Acceptable for local testing, but should remain isolated from production practice. |

## Dependency Vulnerability Review

Automated results:

- Go agent: `govulncheck ./...` completed successfully and reported no known vulnerabilities.
- Node packages: `npm audit --omit=dev --json` could not complete in this environment; the process was terminated with exit code `137`, so Node CVE coverage is incomplete.

Manual observations:

- Core frameworks are relatively current (NestJS 11, Prisma 5, Next.js 16, Redis 7, PostgreSQL 15, Neo4j 5, NATS 2.9).
- The lack of a reliable automated Node vulnerability gate is itself a process gap for SOC 2 / ISO 27001 / CIS Control alignment.

## Compliance Framework Detail

### SOC 2

- Security: Fails due to exposed unauthenticated internal messaging, missing least privilege, and broken tenant isolation.
- Availability: Partial due to health checks and restart policies, but HA, secure failover, and monitoring evidence are insufficient.
- Processing Integrity: Weak due to permissive validation and inaccurate security documentation.
- Confidentiality: Fails due to plaintext temp-password handling and unencrypted secrets at rest.
- Privacy: Weak due to missing retention, consent, export, and deletion workflows for user data.

### ISO 27001

- Access control, cryptography, logging, secure development, and incident response controls are incomplete or undocumented in implementation.
- No technical evidence of formal access reviews, key management, supplier security governance, or secure SDLC gating.

### PCI-DSS

- Internal service communication and infrastructure are not segmented or authenticated strongly enough.
- Secrets at rest are not protected sufficiently.
- Logging integrity and administrative authentication are below PCI expectations.
- No evidence suggests cardholder-data handling, but if payment data were introduced, the current design would not be acceptable.

### GDPR

- No code-level support was found for DSAR export, data subject deletion, retention enforcement, consent capture, or legal basis tracking.
- Multi-tenant isolation defects increase the risk of unauthorized personal-data disclosure.

### HIPAA

- The current controls are insufficient for ePHI workloads.
- Missing MFA, incomplete access restrictions, weak audit integrity, plaintext secret handling, and lack of administrative safeguards block HIPAA readiness.

## Remediation Roadmap

### Immediate (Blocker Remediation Before Any Production Use)

1. Remove external NATS exposure or place it on a private network only; enable NATS authentication and authorization.
2. Eliminate `X-Tenant-ID` override for tenant-scoped users; bind tenant context to validated JWT claims.
3. Make `INTERNAL_API_SECRET`, `CONTROL_PLANE_JWT_SECRET`, and all auth secrets mandatory with no fallback values.
4. Fix graph-service and policy-engine to enforce tenant scoping end-to-end.
5. Change tenant-user authentication to require tenant-qualified login and enforce tenant uniqueness.
6. Stop returning and logging plaintext onboarding passwords; replace with one-time setup links or out-of-band secret delivery.

### Near Term (Enterprise Hardening)

1. Enforce real RBAC in the control plane and preserve tenant-user role distinctions.
2. Add MFA for operator accounts and privileged tenant accounts.
3. Encrypt connector credentials and settings secrets at rest with managed KMS-backed envelope encryption.
4. Move browser auth from `localStorage` to secure, HTTP-only, same-site cookies or equivalent hardened session handling.
5. Add rate limiting and lockout protections to control-plane auth.
6. Add authorization and tenant-isolation integration tests, plus CI gates for SAST, dependency scanning, and secret scanning.

### Certification Preparation

1. Implement data retention, export, deletion, and privacy workflows.
2. Add immutable or tamper-evident audit controls and retention policies.
3. Establish incident response, backup/restore, and access review evidence collection.
4. Align runtime configuration with templates and remove documentation that currently overstates control maturity.

## Production Deployment Readiness

Go-Live Readiness Score: 34/100

Production verdict: NOT READY

Blocking reasons:

- Critical multi-tenant isolation defects
- Critical internal trust-boundary failures
- Credential confidentiality failures
- Incomplete RBAC and privileged-access controls
- Incomplete compliance evidence and operational safeguards

## Final Determination

IDMatr can become an enterprise-capable platform, but the current repository is not suitable as the foundation for SOC 2, ISO 27001, PCI-DSS, GDPR, or HIPAA readiness without substantial remediation.

The repository should be treated as a pre-production security-hardening candidate, not as a deployable enterprise control plane.

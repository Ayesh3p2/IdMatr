# IDMatr Disaster Recovery Runbook

## Purpose

This runbook defines the minimum recovery procedure for IDMatr production incidents affecting PostgreSQL, Redis, Neo4j, NATS, the API gateway, or the control plane.

## Recovery Objectives

- Recovery Time Objective: 4 hours
- Recovery Point Objective: 1 hour

## Preconditions

- Valid `.env` with production secrets
- Latest successful backup verification evidence from [backup-verify.sh](/Users/sudhir/Music/IdMatr/deploy/backup-verify.sh)
- Access to Docker host, backup storage, and operator break-glass token flow

## Incident Classification

1. `SEV-1`: Full platform outage, integrity compromise, or suspected cross-tenant exposure
2. `SEV-2`: Partial service outage with customer impact
3. `SEV-3`: Single-service degradation with workaround

## Immediate Response

1. Freeze deployments and capture current `docker compose ps`, logs, and host telemetry.
2. If compromise is suspected, rotate `JWT_SECRET`, `CONTROL_PLANE_JWT_SECRET`, `INTERNAL_API_SECRET`, `DATA_ENCRYPTION_KEY`, `REDIS_PASSWORD`, and NATS credentials.
3. Run `docker compose config` and service health checks before restart attempts.

## Database Recovery

1. Verify the latest restorable dump with [backup-verify.sh](/Users/sudhir/Music/IdMatr/deploy/backup-verify.sh).
2. Stop application containers that write to PostgreSQL.
3. Restore the most recent clean backup into a fresh database.
4. Run migration verification and smoke tests.
5. Bring the control plane and API gateway online first, then dependent services.

## Redis Recovery

1. Confirm `REDIS_PASSWORD` is present and correct.
2. Recreate Redis from backup or snapshot if available.
3. Validate rate limiting and worker queue connectivity after restore.

## Neo4j Recovery

1. Restore data volume from backup or snapshot.
2. Validate tenant-scoped graph queries against a known tenant before reopening traffic.
3. Confirm APOC unrestricted procedures are not enabled in production.

## NATS Recovery

1. Restore `deploy/nats/nats-server.conf`.
2. Verify service credential environment variables.
3. Confirm monitoring is only reachable from inside the container or approved management path.

## Post-Recovery Validation

1. Tenant onboarding works end to end.
2. Tenant JWTs resolve tenant context correctly.
3. MFA works for `platform_operator` and `tenant_admin`.
4. Privacy endpoints return subject export, rectification, and deletion responses correctly.
5. Audit verification endpoints report valid chains.

## Evidence Collection

- Deployment logs
- Backup verification logs
- Audit integrity verification output
- Security CI run URLs
- Access review and break-glass records

## Closure Criteria

- All critical services healthy
- Backup restore validated
- Audit chain verification passes
- Secrets rotated if compromise suspected
- Incident record written to compliance evidence store

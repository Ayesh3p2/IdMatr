-- ============================================================
-- IDMatr Control Plane — Production Schema Completions
-- Adds: operator security lockout fields, tenant lifecycle
-- columns, DELETED enum value, onboarding tokens, app
-- settings, settings audit log, and context API keys tables.
-- Uses IF NOT EXISTS / DO blocks for idempotent execution.
-- ============================================================

-- ─── Operator login security fields ─────────────────────────
ALTER TABLE "operators" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "operators" ADD COLUMN IF NOT EXISTS "lockedUntil"         TIMESTAMP(3);
ALTER TABLE "operators" ADD COLUMN IF NOT EXISTS "lastFailedLoginAt"   TIMESTAMP(3);
ALTER TABLE "operators" ADD COLUMN IF NOT EXISTS "loginAttemptWindow"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "operators_lockedUntil_idx" ON "operators"("lockedUntil");

-- ─── Tenant lifecycle columns ────────────────────────────────
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trialEndsAt"           TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "suspendedAt"           TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "suspendReason"         TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- ─── TenantStatus enum: add DELETED value ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TenantStatus' AND e.enumlabel = 'DELETED'
  ) THEN
    ALTER TYPE "TenantStatus" ADD VALUE 'DELETED';
  END IF;
END $$;

-- ─── TenantUser login security fields ───────────────────────
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "lockedUntil"         TIMESTAMP(3);
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "lastFailedLoginAt"   TIMESTAMP(3);
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "loginAttemptWindow"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "tenant_users_lockedUntil_idx" ON "tenant_users"("lockedUntil");

-- ─── Onboarding tokens ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "onboarding_tokens" (
  "id"                   TEXT NOT NULL,
  "tenantId"             TEXT NOT NULL,
  "tenantUserId"         TEXT NOT NULL,
  "tokenHash"            TEXT NOT NULL,
  "purpose"              TEXT NOT NULL DEFAULT 'onboarding',
  "expiresAt"            TIMESTAMP(3) NOT NULL,
  "usedAt"               TIMESTAMP(3),
  "createdByOperatorId"  TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_tokens_tokenHash_key" ON "onboarding_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "onboarding_tokens_tenantId_expiresAt_idx" ON "onboarding_tokens"("tenantId", "expiresAt");
CREATE INDEX IF NOT EXISTS "onboarding_tokens_tenantUserId_usedAt_idx" ON "onboarding_tokens"("tenantUserId", "usedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_tokens_tenantId_fkey') THEN
    ALTER TABLE "onboarding_tokens"
      ADD CONSTRAINT "onboarding_tokens_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_tokens_tenantUserId_fkey') THEN
    ALTER TABLE "onboarding_tokens"
      ADD CONSTRAINT "onboarding_tokens_tenantUserId_fkey"
      FOREIGN KEY ("tenantUserId") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_tokens_createdByOperatorId_fkey') THEN
    ALTER TABLE "onboarding_tokens"
      ADD CONSTRAINT "onboarding_tokens_createdByOperatorId_fkey"
      FOREIGN KEY ("createdByOperatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── App settings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app_settings" (
  "id"            TEXT NOT NULL,
  "tenantContext" TEXT NOT NULL,
  "category"      TEXT NOT NULL,
  "settings"      JSONB NOT NULL,
  "updatedBy"     TEXT,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_tenantContext_category_key" ON "app_settings"("tenantContext", "category");
CREATE INDEX IF NOT EXISTS "app_settings_tenantContext_updatedAt_idx" ON "app_settings"("tenantContext", "updatedAt" DESC);

-- ─── Settings audit log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "settings_audit_log" (
  "id"            TEXT NOT NULL,
  "tenantContext" TEXT NOT NULL,
  "category"      TEXT NOT NULL,
  "changedBy"     TEXT,
  "oldValue"      JSONB,
  "newValue"      JSONB NOT NULL,
  "ipAddress"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "settings_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "settings_audit_log_tenantContext_createdAt_idx" ON "settings_audit_log"("tenantContext", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "settings_audit_log_category_createdAt_idx" ON "settings_audit_log"("category", "createdAt" DESC);

-- ─── Context API keys ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "context_api_keys" (
  "id"          TEXT NOT NULL,
  "context"     TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "keyPrefix"   TEXT NOT NULL,
  "keyHash"     TEXT NOT NULL,
  "scopes"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "expiresAt"   TIMESTAMP(3),
  "lastUsedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "context_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "context_api_keys_context_keyPrefix_key" ON "context_api_keys"("context", "keyPrefix");
CREATE INDEX IF NOT EXISTS "context_api_keys_context_isActive_idx" ON "context_api_keys"("context", "isActive");

-- ─── Operator audit log: hash chain columns ──────────────────
ALTER TABLE "operator_audit_logs" ADD COLUMN IF NOT EXISTS "previousHash" TEXT;
ALTER TABLE "operator_audit_logs" ADD COLUMN IF NOT EXISTS "entryHash"    TEXT;

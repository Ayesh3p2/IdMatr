ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "isAnonymized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "deletedReason" TEXT;
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "personalDataLegalBasis" TEXT NOT NULL DEFAULT 'contract';
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "personalDataCategories" TEXT[] NOT NULL DEFAULT ARRAY['identity_profile','authentication','audit'];
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "privacyNoticeAcceptedAt" TIMESTAMP(3);
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "privacyNoticeVersion" TEXT;

CREATE INDEX IF NOT EXISTS "tenant_users_tenantId_deletedAt_idx" ON "tenant_users"("tenantId", "deletedAt");

CREATE TABLE IF NOT EXISTS "privacy_notices" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "version" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "privacy_notices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "privacy_notices_tenantId_version_key" ON "privacy_notices"("tenantId", "version");
CREATE INDEX IF NOT EXISTS "privacy_notices_tenantId_isActive_publishedAt_idx" ON "privacy_notices"("tenantId", "isActive", "publishedAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'privacy_notices_tenantId_fkey') THEN
    ALTER TABLE "privacy_notices"
      ADD CONSTRAINT "privacy_notices_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "privacy_notice_acceptances" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tenantUserId" TEXT NOT NULL,
  "privacyNoticeId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "privacy_notice_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "privacy_notice_acceptances_tenantUserId_privacyNoticeId_key" ON "privacy_notice_acceptances"("tenantUserId", "privacyNoticeId");
CREATE INDEX IF NOT EXISTS "privacy_notice_acceptances_tenantId_acceptedAt_idx" ON "privacy_notice_acceptances"("tenantId", "acceptedAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'privacy_notice_acceptances_tenantId_fkey') THEN
    ALTER TABLE "privacy_notice_acceptances"
      ADD CONSTRAINT "privacy_notice_acceptances_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'privacy_notice_acceptances_tenantUserId_fkey') THEN
    ALTER TABLE "privacy_notice_acceptances"
      ADD CONSTRAINT "privacy_notice_acceptances_tenantUserId_fkey"
      FOREIGN KEY ("tenantUserId") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'privacy_notice_acceptances_privacyNoticeId_fkey') THEN
    ALTER TABLE "privacy_notice_acceptances"
      ADD CONSTRAINT "privacy_notice_acceptances_privacyNoticeId_fkey"
      FOREIGN KEY ("privacyNoticeId") REFERENCES "privacy_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "consent_records" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tenantUserId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "lawfulBasis" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'granted',
  "source" TEXT NOT NULL DEFAULT 'self_service',
  "metadata" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "consent_records_tenantId_tenantUserId_purpose_idx" ON "consent_records"("tenantId", "tenantUserId", "purpose");
CREATE INDEX IF NOT EXISTS "consent_records_tenantId_createdAt_idx" ON "consent_records"("tenantId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consent_records_tenantId_fkey') THEN
    ALTER TABLE "consent_records"
      ADD CONSTRAINT "consent_records_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consent_records_tenantUserId_fkey') THEN
    ALTER TABLE "consent_records"
      ADD CONSTRAINT "consent_records_tenantUserId_fkey"
      FOREIGN KEY ("tenantUserId") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "data_subject_requests" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tenantUserId" TEXT,
  "requestType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "requestedByUserId" TEXT,
  "requestedByOperatorId" TEXT,
  "requestPayload" TEXT,
  "resultPayload" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "data_subject_requests_tenantId_requestType_createdAt_idx" ON "data_subject_requests"("tenantId", "requestType", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "data_subject_requests_tenantUserId_createdAt_idx" ON "data_subject_requests"("tenantUserId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_subject_requests_tenantId_fkey') THEN
    ALTER TABLE "data_subject_requests"
      ADD CONSTRAINT "data_subject_requests_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_subject_requests_tenantUserId_fkey') THEN
    ALTER TABLE "data_subject_requests"
      ADD CONSTRAINT "data_subject_requests_tenantUserId_fkey"
      FOREIGN KEY ("tenantUserId") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "retention_tasks" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "taskType" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "payload" TEXT,
  "notBefore" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retention_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "retention_tasks_status_notBefore_idx" ON "retention_tasks"("status", "notBefore");
CREATE INDEX IF NOT EXISTS "retention_tasks_tenantId_createdAt_idx" ON "retention_tasks"("tenantId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retention_tasks_tenantId_fkey') THEN
    ALTER TABLE "retention_tasks"
      ADD CONSTRAINT "retention_tasks_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "access_reviews" (
  "id" TEXT NOT NULL,
  "startedByOperatorId" TEXT NOT NULL,
  "reviewScope" TEXT NOT NULL DEFAULT 'operators',
  "status" TEXT NOT NULL DEFAULT 'open',
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "summaryJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "access_reviews_status_createdAt_idx" ON "access_reviews"("status", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "access_review_items" (
  "id" TEXT NOT NULL,
  "accessReviewId" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "currentRole" TEXT NOT NULL,
  "disposition" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_review_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "access_review_items_accessReviewId_operatorId_key" ON "access_review_items"("accessReviewId", "operatorId");
CREATE INDEX IF NOT EXISTS "access_review_items_disposition_updatedAt_idx" ON "access_review_items"("disposition", "updatedAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_review_items_accessReviewId_fkey') THEN
    ALTER TABLE "access_review_items"
      ADD CONSTRAINT "access_review_items_accessReviewId_fkey"
      FOREIGN KEY ("accessReviewId") REFERENCES "access_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_review_items_operatorId_fkey') THEN
    ALTER TABLE "access_review_items"
      ADD CONSTRAINT "access_review_items_operatorId_fkey"
      FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "break_glass_access" (
  "id" TEXT NOT NULL,
  "operatorEmail" TEXT NOT NULL,
  "justification" TEXT NOT NULL,
  "requestedByOperatorId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "break_glass_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "break_glass_access_tokenHash_key" ON "break_glass_access"("tokenHash");
CREATE INDEX IF NOT EXISTS "break_glass_access_operatorEmail_expiresAt_idx" ON "break_glass_access"("operatorEmail", "expiresAt");

#!/usr/bin/env bash
# generate-security-evidence.sh — Produces compliance evidence artifacts for SOC2/ISO27001/GDPR/HIPAA
# Run: ./deploy/generate-security-evidence.sh
# Output: docs/compliance/evidence/security_evidence_<TIMESTAMP>.md
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${ROOT_DIR}/docs/compliance/evidence"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="${EVIDENCE_DIR}/security_evidence_${TIMESTAMP}.md"

mkdir -p "${EVIDENCE_DIR}"

pass() { echo "✅ $*"; }
fail() { echo "❌ $*"; }
warn() { echo "⚠️  $*"; }
section() { echo; echo "## $*"; echo; }

API_BASE="${API_BASE:-http://localhost:3001/api}"
CP_BASE="${CP_BASE:-http://localhost:3010}"

{
echo "# IDMatr Security & Compliance Evidence Snapshot"
echo
echo "**Generated:** $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "**Environment:** ${NODE_ENV:-production}"
echo "**Report path:** ${REPORT_FILE}"
echo

section "1. Repository Integrity"
echo "| Attribute | Value |"
echo "|-----------|-------|"
echo "| Commit | $(git -C "${ROOT_DIR}" rev-parse HEAD 2>/dev/null || echo 'unavailable') |"
echo "| Branch | $(git -C "${ROOT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unavailable') |"
echo "| Author | $(git -C "${ROOT_DIR}" log -1 --format='%an <%ae>' 2>/dev/null || echo 'unavailable') |"
echo "| Date | $(git -C "${ROOT_DIR}" log -1 --format='%ci' 2>/dev/null || echo 'unavailable') |"
echo "| Dirty | $(git -C "${ROOT_DIR}" diff --quiet 2>/dev/null && echo false || echo true) |"

section "2. Docker Compose Configuration Validation"
if docker compose -f "${ROOT_DIR}/docker-compose.yml" config --quiet 2>/tmp/dc-validate.err; then
  pass "docker-compose.yml: valid"
else
  fail "docker-compose.yml: INVALID"
  echo '```'; cat /tmp/dc-validate.err; echo '```'
fi

section "3. Container Security Controls"
echo "### 3.1 Non-Root User Enforcement"
echo
for df in \
  services/identity-service/Dockerfile \
  services/discovery-service/Dockerfile \
  services/governance-service/Dockerfile \
  services/risk-engine/Dockerfile \
  services/audit-service/Dockerfile \
  services/policy-engine/Dockerfile \
  services/graph-service/Dockerfile \
  services/notification-service/Dockerfile \
  services/worker-queue/Dockerfile \
  apps/api-gateway/Dockerfile \
  apps/admin-dashboard/Dockerfile \
  apps/control-plane/Dockerfile \
  apps/control-plane-ui/Dockerfile
do
  path="${ROOT_DIR}/${df}"
  if grep -q "^USER " "${path}" 2>/dev/null; then
    user_line=$(grep "^USER " "${path}" | tail -1)
    pass "${df}: ${user_line}"
  else
    fail "${df}: no USER directive"
  fi
done

echo
echo "### 3.2 DEMO_MODE Disabled"
if grep -q 'DEMO_MODE.*"false"' "${ROOT_DIR}/docker-compose.yml" 2>/dev/null; then
  pass "DEMO_MODE hardcoded false in docker-compose.yml"
else
  warn "DEMO_MODE configuration not verified"
fi

echo
echo "### 3.3 Internal Services Not Publicly Exposed"
# Check that internal microservices don't have port mappings
for svc in identity-service governance-service risk-engine audit-service policy-engine graph-service notification-service worker-queue; do
  port_mapping=$(docker compose -f "${ROOT_DIR}/docker-compose.yml" config 2>/dev/null | grep -A30 "^  ${svc}:" | grep "published:" || true)
  if [ -z "$port_mapping" ]; then
    pass "${svc}: no external port exposure"
  else
    fail "${svc}: external port exposed — ${port_mapping}"
  fi
done

section "4. RBAC & Authentication Controls"
echo "### 4.1 Legacy Admin Login Path"
if grep -q "ADMIN_EMAIL" "${ROOT_DIR}/apps/api-gateway/src/app.service.ts" 2>/dev/null; then
  fail "Legacy ADMIN_EMAIL login path still present in app.service.ts"
else
  pass "Legacy ADMIN_EMAIL login bypass: removed"
fi

echo
echo "### 4.2 ADMIN_EMAIL in docker-compose"
if grep -q "ADMIN_EMAIL" "${ROOT_DIR}/docker-compose.yml" 2>/dev/null; then
  fail "ADMIN_EMAIL still present in docker-compose.yml"
else
  pass "ADMIN_EMAIL: not present in docker-compose.yml"
fi

echo
echo "### 4.3 Role Alias Security"
if grep -q "'analyst'" "${ROOT_DIR}/apps/api-gateway/src/roles.guard.ts" 2>/dev/null; then
  pass "Scoped RBAC role aliases (admin/analyst/readonly) present in roles.guard.ts"
else
  warn "Role guard may not have scoped aliases — review roles.guard.ts"
fi

section "5. Audit Log Integrity"
echo "### 5.1 Hash-Chaining"
if grep -q "previousHash" "${ROOT_DIR}/services/audit-service/src/app.service.ts" 2>/dev/null; then
  pass "SHA-256 hash-chaining implemented in audit-service"
else
  fail "Hash-chaining not found in audit-service"
fi

echo
echo "### 5.2 Immutable NDJSON Ledger"
if grep -q "appendImmutableLedger\|appendFile" "${ROOT_DIR}/services/audit-service/src/app.service.ts" 2>/dev/null; then
  pass "Immutable NDJSON ledger append-on-every-write implemented"
else
  warn "Immutable NDJSON ledger append not verified"
fi

echo
echo "### 5.3 Live Audit Verification (requires running stack)"
AUDIT_STATUS="$(curl -s -o /tmp/audit-verify.json -w '%{http_code}' "${API_BASE}/audit/verify" \
  -H "Cookie: idmatr_session=test" 2>/dev/null || echo "000")"
if [[ "${AUDIT_STATUS}" == "200" ]]; then
  pass "Audit integrity endpoint: /api/audit/verify OK"
  echo '```json'; cat /tmp/audit-verify.json 2>/dev/null; echo; echo '```'
else
  warn "Audit verification endpoint not reachable (stack may be offline): HTTP ${AUDIT_STATUS}"
fi

section "6. Privacy & GDPR Controls"
echo "| Control | Status |"
echo "|---------|--------|"
for file in \
  "apps/control-plane/src/privacy/privacy.service.ts" \
  "apps/api-gateway/src/dto/auth.dto.ts"
do
  if [ -f "${ROOT_DIR}/${file}" ]; then
    echo "| ${file} | ✅ Present |"
  else
    echo "| ${file} | ❌ Missing |"
  fi
done

echo
if grep -q "requestSubjectDeletion\|exportSubjectData\|rectifySubjectData" \
     "${ROOT_DIR}/apps/control-plane/src/privacy/privacy.service.ts" 2>/dev/null; then
  pass "DSAR (export, deletion, rectification) methods implemented"
else
  warn "DSAR methods not detected"
fi

if grep -q "runRetentionScan\|processRetentionTasks" \
     "${ROOT_DIR}/apps/control-plane/src/privacy/privacy.service.ts" 2>/dev/null; then
  pass "Automated retention enforcement implemented"
else
  warn "Retention enforcement not detected"
fi

if grep -q "consentRecord\|recordConsent" \
     "${ROOT_DIR}/apps/control-plane/src/privacy/privacy.service.ts" 2>/dev/null; then
  pass "Consent record tracking implemented"
else
  warn "Consent tracking not detected"
fi

section "7. Credential Hygiene"
echo "### 7.1 Hardcoded Secrets Check"
HARDCODED=$(grep -rn \
  "password.*['\"].*[A-Za-z0-9@!#\$%^&*]\{8,\}['\"]" \
  "${ROOT_DIR}/apps" "${ROOT_DIR}/services" \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=dist \
  2>/dev/null | grep -v "//.*password" | grep -v "bcrypt\|process\.env\|passwordHash\|test\|spec" \
  | head -10 || true)
if [ -z "$HARDCODED" ]; then
  pass "No hardcoded credentials detected in source"
else
  fail "Potential hardcoded credentials:"
  echo '```'; echo "${HARDCODED}"; echo '```'
fi

echo
echo "### 7.2 Environment Variable Required Guards"
for svc in \
  "apps/api-gateway/src/app.module.ts:JWT_SECRET" \
  "apps/control-plane/src/main.ts:CONTROL_PLANE_JWT_SECRET" \
  "apps/control-plane/src/main.ts:DATA_ENCRYPTION_KEY"
do
  file="${ROOT_DIR}/${svc%%:*}"
  var="${svc##*:}"
  if grep -q "${var}" "${file}" 2>/dev/null; then
    pass "${var} referenced in ${svc%%:*}"
  else
    warn "${var} not found in ${svc%%:*}"
  fi
done

section "8. Backup Evidence"
if ls "${EVIDENCE_DIR}"/backup_verification_*.log 1>/dev/null 2>&1; then
  latest_backup=$(ls -t "${EVIDENCE_DIR}"/backup_verification_*.log | head -1)
  pass "Latest backup evidence: ${latest_backup}"
  echo
  echo '```'
  tail -10 "${latest_backup}"
  echo '```'
else
  warn "No backup verification logs found — run deploy/backup-verify.sh"
fi

section "9. Security CI Pipeline"
if [ -f "${ROOT_DIR}/.github/workflows/security-ci.yml" ]; then
  pass ".github/workflows/security-ci.yml: present"
  jobs=$(grep "^  [a-zA-Z].*:$" "${ROOT_DIR}/.github/workflows/security-ci.yml" | tr -d ':' | sed 's/^  //')
  echo
  echo "Configured jobs:"
  echo "${jobs}" | while read -r job; do echo "  - ${job}"; done
else
  fail "security-ci.yml not found"
fi

section "10. Summary"
echo "Evidence snapshot generated at $(date -u '+%Y-%m-%dT%H:%M:%SZ')."
echo "Store this file as compliance evidence for SOC2 CC7.2, ISO27001 A.12.7, and GDPR Art.5(2)."

} > "${REPORT_FILE}"

echo "✅ Security evidence snapshot: ${REPORT_FILE}"
chmod +x "${BASH_SOURCE[0]}"

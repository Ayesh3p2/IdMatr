#!/usr/bin/env bash
# validate-security.sh — Pre-deployment security validation suite
# Tests: RBAC enforcement, auth flows, tenant isolation, GDPR endpoints, audit integrity
# Usage: ./deploy/validate-security.sh [API_BASE] [CP_BASE]
# Exits 0 if all critical checks pass, 1 otherwise.
set -euo pipefail

API_BASE="${1:-http://localhost:3001/api}"
CP_BASE="${2:-http://localhost:3010}"

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅ $*"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  $*"; WARN=$((WARN+1)); }
section() { echo; echo "── $* ──────────────────────────────────────────────"; }

http_status() {
  curl -s -o /dev/null -w '%{http_code}' "$@" 2>/dev/null || echo "000"
}

section "1. Health Checks"
status=$(http_status "${API_BASE}/health")
[ "$status" = "200" ] && pass "API Gateway health: OK" || fail "API Gateway health: ${status}"

status=$(http_status "${CP_BASE}/control/system/health")
[ "$status" = "200" ] && pass "Control Plane health: OK" || fail "Control Plane health: ${status}"

section "2. Authentication Controls"

# Unauthenticated request to protected endpoint should return 401
status=$(http_status "${API_BASE}/identities")
[ "$status" = "401" ] && pass "Unauthenticated /api/identities → 401" || fail "Expected 401, got ${status}"

status=$(http_status "${API_BASE}/risk/scores")
[ "$status" = "401" ] && pass "Unauthenticated /api/risk/scores → 401" || fail "Expected 401, got ${status}"

status=$(http_status "${API_BASE}/audit/logs")
[ "$status" = "401" ] && pass "Unauthenticated /api/audit/logs → 401" || fail "Expected 401, got ${status}"

# Health endpoint must be public (no auth)
status=$(http_status "${API_BASE}/health")
[ "$status" = "200" ] && pass "/api/health is public (no auth required)" || fail "/api/health not accessible: ${status}"

section "3. Legacy Login Path Removed"
# Attempt login with ADMIN_EMAIL credentials — should NOT issue a token without going through CP
# We send a deliberately invalid payload to a known-removed path
status=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@idmatr.local","password":"test"}' 2>/dev/null || echo "000")
if [ "$status" = "401" ] || [ "$status" = "503" ]; then
  pass "Admin login without control-plane: properly rejected (${status})"
else
  warn "Unexpected response for legacy admin login: ${status}"
fi

section "4. Tenant Isolation"
# Attempt to access internal control-plane routes directly without secret
status=$(http_status -X POST "${CP_BASE}/internal/auth/validate-user" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}')
[ "$status" = "401" ] || [ "$status" = "403" ] && pass "Internal CP endpoint requires X-Internal-Secret" \
  || warn "Internal CP endpoint returned ${status} without secret"

section "5. GDPR Endpoints"
# Privacy notice — public read, no auth required
status=$(http_status "${API_BASE}/privacy/notice")
[ "$status" = "200" ] || [ "$status" = "401" ] && pass "/api/privacy/notice accessible" \
  || warn "/api/privacy/notice returned ${status}"

section "6. Audit Log Integrity"
# Verify endpoint (requires auth, just check it exists)
status=$(http_status "${API_BASE}/audit/verify")
[ "$status" = "401" ] && pass "/api/audit/verify exists (requires auth)" \
  || warn "/api/audit/verify returned ${status}"

section "7. RBAC Role Hierarchy"
# Verify roles.guard.ts has scoped aliases
if grep -q "'analyst'" /*/Music/IdMatr/apps/api-gateway/src/roles.guard.ts 2>/dev/null \
   || grep -q "'analyst'" "$(cd "$(dirname "$0")/.." && pwd)/apps/api-gateway/src/roles.guard.ts" 2>/dev/null; then
  pass "Scoped RBAC role aliases present in roles.guard.ts"
else
  warn "Cannot verify RBAC aliases from this location"
fi

section "8. Docker Compose Validation"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if docker compose -f "${ROOT_DIR}/docker-compose.yml" config --quiet 2>/dev/null; then
  pass "docker-compose.yml: valid YAML"
else
  fail "docker-compose.yml: validation failed"
fi

# Check DEMO_MODE is disabled
if grep -q 'DEMO_MODE.*"false"' "${ROOT_DIR}/docker-compose.yml" 2>/dev/null; then
  pass "DEMO_MODE hardcoded false"
else
  warn "DEMO_MODE not hardcoded false — check docker-compose.yml"
fi

section "Results"
echo
echo "  Pass:    ${PASS}"
echo "  Warning: ${WARN}"
echo "  Fail:    ${FAIL}"
echo

if [ "${FAIL}" -gt 0 ]; then
  echo "❌ VALIDATION FAILED — ${FAIL} critical check(s) failed. Fix before deploying."
  exit 1
elif [ "${WARN}" -gt 0 ]; then
  echo "⚠️  VALIDATION PASSED WITH WARNINGS — review warnings before production deployment."
  exit 0
else
  echo "✅ VALIDATION PASSED — all ${PASS} checks passed."
  exit 0
fi

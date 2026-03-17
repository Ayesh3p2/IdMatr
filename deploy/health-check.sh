#!/usr/bin/env bash
# ============================================================
# IDMatr — Full Stack Health Check
# Usage: ./deploy/health-check.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
fail() { echo -e "${RED}  ✗${NC} $*"; FAILURES=$((FAILURES+1)); }
info() { echo -e "${BLUE}$*${NC}"; }
FAILURES=0

info "============================================================"
info " IDMatr — Health Check — $(date)"
info "============================================================"

# ── Container status ──────────────────────────────────────────
info "\n[1/3] Container Health"
while IFS= read -r line; do
  NAME=$(echo "${line}" | awk '{print $1}')
  STATUS=$(echo "${line}" | awk '{$1=""; print $0}' | xargs)
  if echo "${STATUS}" | grep -q "healthy"; then
    ok "${NAME} — ${STATUS}"
  elif echo "${STATUS}" | grep -q "starting"; then
    echo -e "${YELLOW}  ⟳${NC} ${NAME} — ${STATUS} (starting)"
  else
    fail "${NAME} — ${STATUS}"
  fi
done < <(docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | tail -n +2)

# ── API endpoints ──────────────────────────────────────────────
info "\n[2/3] API Endpoint Checks"
check_http() {
  local name="$1" url="$2" expected="${3:-200}"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${url}" 2>/dev/null || echo "000")
  if [[ "${status}" == "${expected}" ]]; then
    ok "${name} — HTTP ${status}"
  else
    fail "${name} — HTTP ${status} (expected ${expected})"
  fi
}

check_http "API Gateway Health"   "http://localhost:3001/api/health"
check_http "Admin Dashboard"      "http://localhost:3000"        "200"
check_http "Control Plane Health" "http://localhost:3010/health" "200"

# ── Infrastructure ─────────────────────────────────────────────
info "\n[3/3] Infrastructure Connectivity"
# PostgreSQL
docker exec idmatr-postgres-1 pg_isready -U "${POSTGRES_USER:-idmatr}" >/dev/null 2>&1 \
  && ok "PostgreSQL — accepting connections" \
  || fail "PostgreSQL — not ready"

# Redis
docker exec idmatr-redis-1 redis-cli -a "${REDIS_PASSWORD:-}" ping 2>/dev/null | grep -q PONG \
  && ok "Redis — PONG received" \
  || fail "Redis — not responding"

# NATS
docker exec idmatr-nats-1 wget --no-verbose --tries=1 -qO- http://127.0.0.1:8222/healthz 2>/dev/null | grep -q ok \
  && ok "NATS — healthy" \
  || fail "NATS — not responding"

# ── Summary ───────────────────────────────────────────────────
info "\n============================================================"
if [[ ${FAILURES} -eq 0 ]]; then
  echo -e "${GREEN} ALL SYSTEMS OPERATIONAL — ${FAILURES} failures${NC}"
else
  echo -e "${RED} HEALTH CHECK FAILED — ${FAILURES} failure(s) detected${NC}"
  exit 1
fi

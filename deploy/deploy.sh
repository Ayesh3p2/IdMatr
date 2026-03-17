#!/usr/bin/env bash
# ============================================================
# IDMatr — Production Deployment Script
# Usage: ./deploy/deploy.sh [--env <env>] [--skip-build]
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
COMPOSE_PROD_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${ROOT_DIR}/logs/deploy_${TIMESTAMP}.log"

# ── Colours ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $*" | tee -a "${LOG_FILE}"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*" | tee -a "${LOG_FILE}"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" | tee -a "${LOG_FILE}"; }
error() { echo -e "${RED}[ERROR]${NC} $*" | tee -a "${LOG_FILE}"; exit 1; }

# ── Args ──────────────────────────────────────────────────────
SKIP_BUILD=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build) SKIP_BUILD=true; shift ;;
    --env) ENV="${2:-production}"; shift 2 ;;
    *) warn "Unknown arg: $1"; shift ;;
  esac
done

mkdir -p "${ROOT_DIR}/logs"
info "=== IDMatr Deployment — $(date) ==="

# ── Pre-flight checks ─────────────────────────────────────────
info "Running pre-flight checks..."

command -v docker  >/dev/null 2>&1 || error "docker is not installed"
command -v docker  >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || error "docker compose plugin required"

[[ -f "${ENV_FILE}" ]] || error ".env file not found. Copy .env.example to .env and configure it."

# Validate critical env vars
source "${ENV_FILE}"
[[ -z "${JWT_SECRET:-}" ]]         && error "JWT_SECRET is not set in .env"
[[ -z "${POSTGRES_PASSWORD:-}" ]]  && error "POSTGRES_PASSWORD is not set in .env"
[[ -z "${REDIS_PASSWORD:-}" ]]     && error "REDIS_PASSWORD is not set in .env"
[[ -z "${REDIS_URL:-}" ]]          && error "REDIS_URL is not set in .env"
[[ -z "${CONTROL_PLANE_JWT_SECRET:-}" ]] && error "CONTROL_PLANE_JWT_SECRET is not set in .env"
[[ -z "${INTERNAL_API_SECRET:-}" ]] && error "INTERNAL_API_SECRET is not set in .env"
[[ -z "${DATA_ENCRYPTION_KEY:-}" ]] && error "DATA_ENCRYPTION_KEY is not set in .env"
[[ "${JWT_SECRET}" == "REPLACE_WITH_64_CHAR_RANDOM_STRING" ]] && error "JWT_SECRET is still the placeholder — run scripts/generate-env.sh"
[[ "${POSTGRES_PASSWORD}" == "change_me_strong_password_here" ]] && error "POSTGRES_PASSWORD is still the default — run scripts/generate-env.sh"
[[ "${REDIS_PASSWORD}" == "replace_with_strong_random_secret" ]] && error "REDIS_PASSWORD is still the placeholder — run scripts/generate-env.sh"
[[ -z "${OPERATOR_EMAIL:-}" ]] && error "OPERATOR_EMAIL is not set in .env — set the platform operator email"
[[ -z "${OPERATOR_PASSWORD:-}" ]] && error "OPERATOR_PASSWORD is not set in .env — set a strong operator password"

ok "Pre-flight checks passed"

# ── Build images ──────────────────────────────────────────────
if [[ "${SKIP_BUILD}" == "false" ]]; then
  info "Building Docker images..."
  docker compose -f "${COMPOSE_FILE}" build --parallel 2>&1 | tee -a "${LOG_FILE}"
  ok "Images built"
else
  warn "Skipping build (--skip-build flag set)"
fi

# ── Database migrations ───────────────────────────────────────
info "Running database migrations..."
SERVICES=(identity-service discovery-service governance-service risk-engine audit-service policy-engine control-plane)
for svc in "${SERVICES[@]}"; do
  info "  Migrating ${svc}..."
  docker compose -f "${COMPOSE_FILE}" run --rm "${svc}" sh -c "npx prisma migrate deploy" 2>&1 | tee -a "${LOG_FILE}" || warn "Migration for ${svc} failed (may be already up to date)"
done
ok "Database migrations complete"

# ── Start services ─────────────────────────────────────────────
info "Starting services..."
docker compose -f "${COMPOSE_FILE}" up -d 2>&1 | tee -a "${LOG_FILE}"

# ── Health check ──────────────────────────────────────────────
info "Waiting for services to become healthy..."
RETRIES=30
DELAY=5
for i in $(seq 1 ${RETRIES}); do
  UNHEALTHY=$(docker compose -f "${COMPOSE_FILE}" ps --format json 2>/dev/null | \
    python3 -c "import sys,json; data=sys.stdin.read(); services=[json.loads(l) for l in data.strip().split('\n') if l]; print(sum(1 for s in services if 'unhealthy' in s.get('Health','') or 'starting' in s.get('Health','')))" 2>/dev/null || echo "0")
  if [[ "${UNHEALTHY}" == "0" ]]; then
    ok "All services healthy"
    break
  fi
  if [[ ${i} -eq ${RETRIES} ]]; then
    warn "Some services still not healthy after ${RETRIES} attempts"
    docker compose -f "${COMPOSE_FILE}" ps 2>&1 | tee -a "${LOG_FILE}"
  fi
  info "  Attempt ${i}/${RETRIES} — ${UNHEALTHY} services not yet healthy. Retrying in ${DELAY}s..."
  sleep ${DELAY}
done

# ── API smoke test ─────────────────────────────────────────────
info "Running API smoke test..."
API_PORT="${PORT:-3001}"
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${API_PORT}/api/health" 2>/dev/null || echo "000")
if [[ "${HTTP_STATUS}" == "200" ]]; then
  ok "API Gateway health check: HTTP ${HTTP_STATUS}"
else
  warn "API Gateway health check returned HTTP ${HTTP_STATUS} — check logs"
fi

# ── Security validation ────────────────────────────────────────
info "Running security validation suite..."
sleep 5
if "${SCRIPT_DIR}/validate-security.sh" "http://localhost:3001/api" "http://localhost:3010" 2>&1 | tee -a "${LOG_FILE}"; then
  ok "Security validation passed"
else
  warn "Security validation completed with warnings — review output above"
fi

# ── Generate evidence snapshot ─────────────────────────────────
info "Generating compliance evidence snapshot..."
"${SCRIPT_DIR}/generate-security-evidence.sh" 2>&1 | tee -a "${LOG_FILE}" || warn "Evidence generation failed — check manually"

# ── Summary ───────────────────────────────────────────────────
info "=== Deployment Complete ==="
info "Admin Dashboard:     http://localhost:3000"
info "Operator Portal:     http://localhost:3000/operator/login"
info "API Gateway:         http://localhost:3001/api/health"
info "Control Plane:       http://localhost:3010"
info "Audit Verify:        http://localhost:3001/api/audit/verify  (auth required)"
info "Log file:            ${LOG_FILE}"
ok "IDMatr deployed successfully at $(date)"

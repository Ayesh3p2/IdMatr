#!/usr/bin/env bash
# ============================================================
# IDMatr — Secret Rotation Script
# Generates new secrets and updates .env (does NOT restart services)
# Usage: ./deploy/rotate-secrets.sh [--service jwt|db|all]
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
BACKUP="${ROOT_DIR}/.env.backup.$(date +%Y%m%d_%H%M%S)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

[[ -f "${ENV_FILE}" ]] || error ".env file not found"
command -v openssl >/dev/null 2>&1 || error "openssl is required"

SERVICE="${1:-all}"

# Backup
cp "${ENV_FILE}" "${BACKUP}"
ok "Backup created: ${BACKUP}"

generate_secret() { openssl rand -base64 64 | tr -d '\n/+' | head -c 64; }

rotate_jwt() {
  info "Rotating JWT_SECRET..."
  NEW_SECRET=$(generate_secret)
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_SECRET}|" "${ENV_FILE}"
  ok "JWT_SECRET rotated — restart api-gateway to apply"
  warn "All existing JWT tokens will be invalidated on restart"
}

rotate_db() {
  info "Rotating POSTGRES_PASSWORD..."
  NEW_PW=$(generate_secret | head -c 32)
  sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${NEW_PW}|" "${ENV_FILE}"
  sed -i.bak "s|postgresql://\([^:]*\):[^@]*@|postgresql://\1:${NEW_PW}@|" "${ENV_FILE}"
  ok "POSTGRES_PASSWORD rotated — requires DB password change + service restart"
  warn "Run: docker exec -it idmatr-postgres-1 psql -U postgres -c \"ALTER USER idmatr PASSWORD '${NEW_PW}';\""
}

case "${SERVICE}" in
  jwt) rotate_jwt ;;
  db)  rotate_db ;;
  all) rotate_jwt; rotate_db ;;
  *) error "Unknown service: ${SERVICE}. Use jwt, db, or all" ;;
esac

rm -f "${ENV_FILE}.bak"
ok "Secret rotation complete. Restart affected services to apply."

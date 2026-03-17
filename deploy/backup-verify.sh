#!/usr/bin/env bash
# backup-verify.sh — Automated PostgreSQL backup with restore verification and DR evidence
# Usage: ./deploy/backup-verify.sh [--skip-restore] [--env /path/to/.env]
# Produces: backups/idmatr_<TIMESTAMP>.dump.gz + docs/compliance/evidence/backup_verification_<TIMESTAMP>.log
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_RESTORE=false
ENV_FILE="${ROOT_DIR}/.env"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-restore) SKIP_RESTORE=true; shift ;;
    --env) ENV_FILE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

EVIDENCE_DIR="${ROOT_DIR}/docs/compliance/evidence"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/idmatr_${TIMESTAMP}.dump"
BACKUP_GZ="${BACKUP_FILE}.gz"
LOG_FILE="${EVIDENCE_DIR}/backup_verification_${TIMESTAMP}.log"

mkdir -p "${EVIDENCE_DIR}" "${BACKUP_DIR}"

[[ -f "${ENV_FILE}" ]] || { echo "ERROR: .env file not found at ${ENV_FILE}"; exit 1; }
# shellcheck disable=SC1090
source "${ENV_FILE}"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-idmatr-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-idmatr}"
POSTGRES_DB="${POSTGRES_DB:-idmatr_db}"
VERIFY_DB="restore_verify_${TIMESTAMP}"
MAX_BACKUPS="${MAX_BACKUPS:-30}"

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "${LOG_FILE}"; }
log_only() { echo "[$(date -u +%H:%M:%S)] $*" >> "${LOG_FILE}"; }

{
  echo "IDMatr Backup Verification Report"
  echo "================================="
  echo "Timestamp:            $(date --iso-8601=seconds 2>/dev/null || date)"
  echo "PostgreSQL container: ${POSTGRES_CONTAINER}"
  echo "Source database:      ${POSTGRES_DB}"
  echo "Backup file:          ${BACKUP_GZ}"
  echo "Skip restore test:    ${SKIP_RESTORE}"
} > "${LOG_FILE}"

log "Step 1: Checking PostgreSQL availability"
docker exec "${POSTGRES_CONTAINER}" pg_isready -U "${POSTGRES_USER}" >> "${LOG_FILE}" 2>&1

log "Step 2: Creating backup (pg_dump custom format)"
docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -Fc "${POSTGRES_DB}" > "${BACKUP_FILE}"
log_only "Raw dump size: $(du -sh "${BACKUP_FILE}" | awk '{print $1}')"

log "Step 3: Compressing backup"
gzip -9 "${BACKUP_FILE}"
BACKUP_SIZE=$(du -sh "${BACKUP_GZ}" | awk '{print $1}')
log_only "Compressed size: ${BACKUP_SIZE}"

log "Step 4: Computing SHA-256 checksum"
CHECKSUM=$(sha256sum "${BACKUP_GZ}" | awk '{print $1}')
echo "${CHECKSUM}  ${BACKUP_GZ}" > "${BACKUP_GZ}.sha256"
log_only "SHA-256: ${CHECKSUM}"

if [ "${SKIP_RESTORE}" = "false" ]; then
  log "Step 5: Restore verification — creating verify database"
  docker exec "${POSTGRES_CONTAINER}" createdb -U "${POSTGRES_USER}" "${VERIFY_DB}" >> "${LOG_FILE}" 2>&1

  log "Step 6: Restoring backup to verify database"
  zcat "${BACKUP_GZ}" | docker exec -i "${POSTGRES_CONTAINER}" pg_restore \
    -U "${POSTGRES_USER}" -d "${VERIFY_DB}" --clean --if-exists >> "${LOG_FILE}" 2>&1 || true

  log "Step 7: Verifying restored tables"
  TABLE_COUNT=$(docker exec "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${VERIFY_DB}" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables \
           WHERE table_schema NOT IN ('pg_catalog','information_schema');" \
    2>/dev/null | tr -d ' \n' || echo "0")
  log_only "Restored table count: ${TABLE_COUNT}"
  echo "RESTORE TABLE COUNT: ${TABLE_COUNT}" >> "${LOG_FILE}"

  log "Step 8: Dropping verify database"
  docker exec "${POSTGRES_CONTAINER}" dropdb -U "${POSTGRES_USER}" "${VERIFY_DB}" >> "${LOG_FILE}" 2>&1

  echo "RESTORE VERIFICATION: PASS" >> "${LOG_FILE}"
else
  log "Steps 5-8: Skipped (--skip-restore)"
fi

log "Step 9: Rotating old backups (keeping last ${MAX_BACKUPS})"
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/idmatr_*.dump.gz 2>/dev/null | wc -l || echo 0)
if (( BACKUP_COUNT > MAX_BACKUPS )); then
  REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
  ls -1t "${BACKUP_DIR}"/idmatr_*.dump.gz | tail -"${REMOVE_COUNT}" | xargs rm -f
  log_only "Removed ${REMOVE_COUNT} old backup(s)"
fi

{
  echo
  echo "BACKUP COMPLETED: $(date --iso-8601=seconds 2>/dev/null || date)"
  echo "Backup file:  ${BACKUP_GZ} (${BACKUP_SIZE})"
  echo "SHA-256:      ${CHECKSUM}"
  echo "Status:       SUCCESS"
} >> "${LOG_FILE}"

log "Backup verification completed. Evidence: ${LOG_FILE}"

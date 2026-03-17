#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# IDMatr Platform — Local Startup Script
# Usage:  ./scripts/start.sh [docker compose flags]
# Example: ./scripts/start.sh --build        (rebuild images before starting)
#          ./scripts/start.sh -d             (detached / background)
#          ./scripts/start.sh --build -d     (rebuild + background)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin"

# ── 1. Locate Docker ──────────────────────────────────────────────────────────
if command -v docker &>/dev/null; then
  DOCKER=$(command -v docker)
else
  DOCKER="$DOCKER_BIN/docker"
fi

if ! "$DOCKER" info &>/dev/null 2>&1; then
  echo "ERROR: Docker is not running. Start Docker Desktop and try again."
  exit 1
fi

# Ensure credential helpers are findable for BuildKit
export PATH="$DOCKER_BIN:$PATH"

# ── 2. Check .env ─────────────────────────────────────────────────────────────
if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo "WARNING: .env file not found. Copying from .env.example ..."
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "Please review $PROJECT_DIR/.env and set required values."
fi

# Validate critical variables
source "$PROJECT_DIR/.env" 2>/dev/null || true
MISSING=()
[[ -z "${JWT_SECRET:-}" ]]                    && MISSING+=("JWT_SECRET")
[[ -z "${POSTGRES_PASSWORD:-}" ]]             && MISSING+=("POSTGRES_PASSWORD")
[[ -z "${NEO4J_PASSWORD:-}" ]]                && MISSING+=("NEO4J_PASSWORD")
[[ -z "${CONTROL_PLANE_JWT_SECRET:-}" ]]      && MISSING+=("CONTROL_PLANE_JWT_SECRET")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: Missing required .env variables: ${MISSING[*]}"
  echo "Set them in $PROJECT_DIR/.env and re-run."
  exit 1
fi

# ── 3. Pre-pull base images (bypasses credential helper for cached images) ────
echo "Pulling base images..."
"$DOCKER" pull node:20-alpine    &
"$DOCKER" pull postgres:15       &
"$DOCKER" pull redis:7-alpine    &
"$DOCKER" pull nats:2.9-alpine   &
"$DOCKER" pull neo4j:5           &
wait
echo "Base images ready."

# ── 4. Start the platform ─────────────────────────────────────────────────────
echo ""
echo "Starting IDMatr platform..."
echo "  Admin Dashboard → http://localhost:3000"
echo "  API Gateway     → http://localhost:3001"
echo "  Control Plane   → http://localhost:3002"
echo ""

cd "$PROJECT_DIR"
"$DOCKER" compose up "$@"

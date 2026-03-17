#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# IDMatr Platform — Build Script
# Rebuilds all Docker images from scratch with a clean cache.
# Usage:  ./scripts/build.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin"

if command -v docker &>/dev/null; then
  DOCKER=$(command -v docker)
else
  DOCKER="$DOCKER_BIN/docker"
fi

if ! "$DOCKER" info &>/dev/null 2>&1; then
  echo "ERROR: Docker is not running. Start Docker Desktop and try again."
  exit 1
fi

export PATH="$DOCKER_BIN:$PATH"

echo "Pre-pulling base images..."
"$DOCKER" pull node:20-alpine  &
"$DOCKER" pull postgres:15     &
"$DOCKER" pull redis:7-alpine  &
"$DOCKER" pull nats:2.9-alpine &
"$DOCKER" pull neo4j:5         &
wait

cd "$PROJECT_DIR"
echo "Building all service images..."
"$DOCKER" compose build --no-cache "$@"
echo ""
echo "Build complete. Run './scripts/start.sh -d' to start the platform."

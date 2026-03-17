#!/bin/sh
# Run Prisma migrations for the control plane schema.
# Usage: ./migrate.sh [dev|deploy]
# Requires CONTROL_PLANE_DATABASE_URL in .env or environment.
set -e

MODE=${1:-deploy}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load .env if present
if [ -f "$ROOT_DIR/.env" ]; then
  set -a; . "$ROOT_DIR/.env"; set +a
fi

if [ -z "$CONTROL_PLANE_DATABASE_URL" ]; then
  echo "Error: CONTROL_PLANE_DATABASE_URL is not set"
  exit 1
fi

export DATABASE_URL="$CONTROL_PLANE_DATABASE_URL"

cd "$SCRIPT_DIR"

if [ "$MODE" = "dev" ]; then
  npx prisma migrate dev --name init
else
  npx prisma migrate deploy
fi

echo "Control plane migrations complete."

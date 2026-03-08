#!/bin/bash
# fix-prisma-v7.sh
# Run this from ~/Music/IdMatr root
# Fixes Prisma v7 breaking change across all services

set -e
cd ~/Music/IdMatr

echo "🔧 Fixing Prisma v7 compatibility..."

SERVICES=("identity-service" "discovery-service" "governance-service" "risk-engine" "audit-service")

for SERVICE in "${SERVICES[@]}"; do
  SCHEMA="services/$SERVICE/prisma/schema.prisma"
  CONFIG="services/$SERVICE/prisma.config.ts"

  if [ ! -f "$SCHEMA" ]; then
    echo "  ⚠️  Skipping $SERVICE — no schema.prisma found"
    continue
  fi

  echo "  🔄 Fixing $SERVICE..."

  # 1. Remove 'url' line from datasource block in schema.prisma
  sed -i.bak '/url *= *env("DATABASE_URL")/d' "$SCHEMA"
  rm -f "${SCHEMA}.bak"

  # 2. Create prisma.config.ts
  cat > "$CONFIG" << 'CONFIGEOF'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
})
CONFIGEOF

  echo "  ✅ Fixed $SERVICE"
done

echo ""
echo "✅ All Prisma schemas updated for v7."
echo ""
echo "Next steps:"
echo "  git add -A"
echo "  git commit -m 'Fix: Prisma v7 config migration for all services'"
echo "  git push"

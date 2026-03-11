#!/bin/bash
set -e

POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-password123}

echo "Running Prisma migrations for all services..."

SERVICES=(
  "identity-service:identity_service"
  "discovery-service:discovery_service"
  "governance-service:governance_service"
  "risk-engine:risk_engine"
  "audit-service:audit_service"
  "policy-engine:identity_service"
)

for entry in "${SERVICES[@]}"; do
  service="${entry%%:*}"
  schema="${entry##*:}"
  
  if [ -d "services/$service/prisma" ]; then
    echo "  Migrating $service (schema: $schema)..."
    cd "services/$service"
    DATABASE_URL="postgresql://idmatr:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/idmatr_db?schema=${schema}" \
      npx prisma migrate deploy
    cd ../..
    echo "  ✓ $service migrated"
  fi
done

echo "All migrations complete!"

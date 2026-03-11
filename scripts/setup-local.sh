#!/bin/bash
set -e

echo "🚀 Starting IDMatr Local Setup..."

# 1. Check dependencies
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed. Install Docker Desktop first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed."
    exit 1
fi

# 2. Create .env from example if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and set your secrets before continuing."
    echo "   At minimum set: JWT_SECRET, POSTGRES_PASSWORD, NEO4J_PASSWORD"
fi

# 3. Start Infrastructure only first
echo "🐳 Starting infrastructure (Postgres, Redis, Neo4j, NATS)..."
docker compose up -d postgres redis neo4j nats

# 4. Wait for postgres to be healthy
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker compose exec postgres pg_isready -U idmatr -d idmatr_db > /dev/null 2>&1; do
    sleep 2
    echo "   Still waiting..."
done
echo "✅ PostgreSQL is ready."

# 5. Install root dependencies
echo "📦 Installing monorepo dependencies..."
npm install

# 6. Run Prisma migrations for each service
echo "💎 Running Prisma migrations..."
SERVICES_WITH_PRISMA=("identity-service" "discovery-service" "governance-service" "risk-engine" "audit-service" "policy-engine")

for service in "${SERVICES_WITH_PRISMA[@]}"; do
    if [ -d "services/$service/prisma" ]; then
        echo "  - Migrating $service..."
        SCHEMA="${service//-/_}"
        cd services/$service
        DATABASE_URL="postgresql://idmatr:${POSTGRES_PASSWORD:-password123}@localhost:5432/idmatr_db?schema=${SCHEMA}" \
            npx prisma migrate deploy
        cd ../..
    fi
done

echo ""
echo "✅ Setup complete!"
echo ""
echo "▶  To start all services in dev mode:  npm run dev"
echo "▶  To start with Docker:               docker compose up -d"
echo "▶  Admin Dashboard:                    http://localhost:3000"
echo "▶  API Gateway:                        http://localhost:3001/api"
echo "▶  Neo4j Browser:                      http://localhost:7474"
echo "▶  NATS Monitor:                       http://localhost:8222"

#!/bin/bash

echo "🚀 Starting IDMatr Local Setup..."

# 1. Check dependencies
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed."
    exit 1
fi

# 2. Start Infrastructure
echo "🐳 Starting Docker infrastructure (Postgres, Neo4j, NATS)..."
docker-compose up -d

# 3. Install Dependencies
echo "📦 Installing monorepo dependencies..."
npm install

# 4. Generate Prisma Clients
echo "💎 Generating Prisma clients..."
# Services with Prisma
SERVICES_WITH_PRISMA=("identity-service" "discovery-service" "governance-service" "risk-engine" "audit-service")
for service in "${SERVICES_WITH_PRISMA[@]}"; do
    echo "  - Generating for $service..."
    cd services/$service && npx prisma generate && cd ../..
done

# 5. Build Shared Packages
echo "🛠 Building shared packages..."
npm run build --prefix packages/shared-types
npm run build --prefix packages/auth-utils
npm run build --prefix packages/logging
npm run build --prefix packages/event-bus

echo "✅ Setup complete! You can now start the services in dev mode."
echo "💡 Run 'npm run dev' to start all services and the dashboard."

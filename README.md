# IDMatr (Identity Matters)

IDMatr is an enterprise-grade Identity Security Platform that combines IGA, IAM, ISPM, and IVIP into a single unified intelligence platform.

## Architecture

- **Frontend**: Next.js 14, React, Tailwind, shadcn/ui
- **API Gateway**: NestJS handling JWT and NATS routing
- **Microservices**:
  - `identity-service`: Identity management (PostgreSQL)
  - `discovery-service`: Application discovery (PostgreSQL)
  - `governance-service`: Access workflows (PostgreSQL)
  - `risk-engine`: Risk analysis (PostgreSQL)
  - `graph-service`: Identity relationships (Neo4j)
  - `policy-engine`: RBAC/ABAC policies
- **Infrastructure**:
  - PostgreSQL (Relational data)
  - Neo4j (Graph data)
  - Redis (Caching/Sessions)
  - NATS (Internal event bus)

## Local Setup

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- npm

### Installation

1. Run the setup script:
   ```bash
   chmod +x scripts/setup-local.sh
   ./scripts/setup-local.sh
   ```

2. Start the infrastructure:
   ```bash
   docker-compose up -d
   ```

3. Start all services in development mode:
   ```bash
   npm run dev
   ```

### Accessing the Platform

- **Admin Dashboard**: `http://localhost:3000`
- **API Gateway**: `http://localhost:3001/api`
- **Neo4j Browser**: `http://localhost:7474` (Credentials: neo4j/password123)

## Key Features

- **Application Discovery**: Automatically detect SaaS usage via connectors (Google, Slack, etc.)
- **Identity Graph**: Visualize relationships between Users, Roles, Permissions, and Apps.
- **Risk Engine**: Calculate risk scores based on excessive privileges and abnormal behavior.
- **Access Governance**: Automated workflows for access requests and certifications.

## Deployment

The platform is containerized and can be deployed to AWS/GCP/Azure using the provided Docker environment.
For production, use a managed database (RDS/Cloud SQL) and a production-grade NATS cluster.

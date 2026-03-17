# IDMatr - Identity Security Platform

<p align="center">
  <img src="id_matrix_logo.svg" alt="IDMatr" width="200"/>
</p>

> Enterprise-grade Identity Security Platform built with NestJS, Next.js, and TypeScript

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E=20.x-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com)

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Testing](#testing)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## Architecture

### High-Level Overview

IDMatr is a microservices-based identity security platform designed for enterprise environments.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer / Nginx                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Admin Dashboard│    │  API Gateway    │    │Control Plane UI│
│   (Next.js)  │    │   (NestJS)      │    │   (Next.js)    │
└───────────────┘    └────────┬────────┘    └─────────────────┘
                             │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Identity    │    │    Discovery   │    │    Governance   │
│   Service    │    │    Service     │    │    Service     │
└───────────────┘    └─────────────────┘    └─────────────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL  │    │      Redis      │    │      NATS      │
│   (Primary)  │    │   (Caching)     │    │  (Messaging)    │
└───────────────┘    └─────────────────┘    └─────────────────┘
```

### Microservices

| Service | Description | Port |
|---------|-------------|------|
| API Gateway | Main entry point for client requests | 3001 |
| Identity Service | Identity management and user operations | 3000 |
| Discovery Service | SaaS app discovery and scanning | 3001 |
| Governance Service | JML workflows and access governance | 3002 |
| Risk Engine | Risk scoring and threat detection | 3003 |
| Audit Service | Immutable audit logging | 3004 |
| Policy Engine | Policy enforcement | 3005 |
| Graph Service | Identity relationship graphs | 3006 |
| Notification Service | Alerts and notifications | 3007 |
| Worker Queue | Background job processing | 3008 |
| Control Plane | Tenant and platform management | 3010 |

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: NestJS 11
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache**: Redis 7
- **Message Queue**: NATS
- **Graph Database**: Neo4j

### Frontend
- **Framework**: Next.js 14+
- **Language**: TypeScript
- **UI**: React 18
- **Styling**: TailwindCSS

### Infrastructure
- **Container**: Docker & Docker Compose
- **Orchestration**: Kubernetes (production)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + ELK Stack

---

## Project Structure

```
idmatr/
├── apps/                          # Frontend & Gateway applications
│   ├── admin-dashboard/           # Main admin UI (Next.js)
│   ├── api-gateway/              # API Gateway (NestJS)
│   ├── control-plane/            # Control plane API (NestJS)
│   └── control-plane-ui/         # Control plane UI (Next.js)
│
├── services/                      # Microservices
│   ├── identity-service/          # Identity management
│   ├── discovery-service/         # SaaS discovery
│   ├── governance-service/       # Access governance
│   ├── risk-engine/             # Risk analysis
│   ├── audit-service/            # Audit logging
│   ├── policy-engine/           # Policy enforcement
│   ├── graph-service/            # Graph analytics
│   ├── notification-service/    # Notifications
│   └── worker-queue/            # Job processing
│
├── packages/                     # Shared packages
│   ├── config/                  # Configuration module
│   ├── logging/                 # Logging utilities
│   ├── shared-auth/             # Authentication shared code
│   ├── shared-types/            # TypeScript types
│   ├── auth-utils/              # Auth utilities
│   └── event-bus/               # Event bus
│
├── deploy/                       # Deployment configs
│   ├── docker-compose.prod.yml  # Production compose
│   ├── nginx/                  # Nginx configs
│   └── nats/                   # NATS config
│
├── scripts/                      # Automation scripts
├── docs/                        # Documentation
└── .github/workflows/           # CI/CD pipelines
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- NATS

### Quick Start (Local Development)

```bash
# Clone the repository
git clone https://github.com/Ayesh3p2/IdMatr.git
cd IdMatr

# Install dependencies
npm install

# Start infrastructure services
npm run docker:up

# Start all applications
npm run dev

# Access the applications
# Admin Dashboard: http://localhost:3000
# API Gateway: http://localhost:3001
# Control Plane UI: http://localhost:3002
# API Docs: http://localhost:3001/api/docs
```

### Environment Variables

Create a `.env` file:

```bash
# Core
NODE_ENV=development
PORT=3001

# Database
POSTGRES_PASSWORD=your-secure-password

# Redis
REDIS_PASSWORD=your-secure-redis-password

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars

# NATS
NATS_PASSWORD=your-nats-password

# Internal API
INTERNAL_API_SECRET=your-internal-api-secret

# Encryption
DATA_ENCRYPTION_KEY=your-32-byte-base64-key
```

---

## Development

### Running Services

```bash
# Start all services in development mode
npm run dev

# Start specific service
cd apps/api-gateway
npm run start:dev

# Start infrastructure only
docker-compose up -d postgres redis nats neo4j
```

### Building

```bash
# Build all workspaces
npm run build

# Build specific application
cd apps/api-gateway
npm run build

# Docker build
docker-compose build --parallel
```

### Testing

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:cov

# Run specific test suite
cd apps/api-gateway
npm run test
```

### Linting & Formatting

```bash
# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Check code formatting
npm run format:check

# Auto-format code
npm run format
```

---

## Deployment

### Production with Docker Compose

```bash
# Build production images
docker-compose -f docker-compose.yml build --parallel

# Start production services
docker-compose -f docker-compose.yml up -d

# Check service health
docker-compose ps
```

### Production with Kubernetes

```bash
# Deploy to Kubernetes
kubectl apply -f deploy/k8s/production/
```

### Environment-Specific Deployments

| Environment | URL | Description |
|-------------|-----|-------------|
| Development | dev.idmatr.io | Latest development build |
| Staging | staging.idmatr.io | Pre-production testing |
| Production | idmatr.io | Live production environment |

---

## API Documentation

Swagger documentation is available at `/api/docs` when running locally or in non-production environments.

```bash
# Access API docs
curl http://localhost:3001/api/docs
```

### Authentication

All protected endpoints require JWT authentication:

```
Authorization: Bearer <jwt-token>
```

### Example Request

```bash
curl -X GET http://localhost:3001/api/identities \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

---

## Security

### Implemented Security Measures

- **Authentication**: JWT with RS256 signing
- **Authorization**: RBAC with role-based access control
- **Encryption**: AES-256-GCM for data at rest
- **TLS**: All inter-service communication encrypted
- **Rate Limiting**: Redis-backed rate limiting
- **Input Validation**: DTO validation with class-validator
- **Security Headers**: Helmet.js with CSP
- **Audit Logging**: Immutable hash-chained audit logs

### Compliance

The platform is designed to meet compliance requirements for:

- SOC 2 Type II
- ISO 27001
- PCI-DSS
- GDPR
- HIPAA

---

## Testing Strategy

### Unit Tests

```bash
# Run unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov
```

### Integration Tests

```bash
# Run e2e tests
npm run test:e2e
```

### Test Coverage Goals

| Category | Minimum |
|----------|---------|
| Services | 80% |
| Controllers | 70% |
| Guards/Interceptors | 90% |

---

## Configuration

### Environment Configuration

The application supports multiple environments:

- `development` - Local development
- `staging` - Pre-production testing
- `production` - Live production

### Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Local environment variables |
| `.env.example` | Example environment template |
| `config/development.yaml` | Dev-specific config |
| `config/production.yaml` | Production config |

---

## Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
docker exec -it idmatr-postgres-1 psql -U idmatr -d idmatr_db
```

#### NATS Connection Issues

```bash
# Check NATS logs
docker compose logs nats

# Verify NATS is accessible
nats-server -v
```

#### Build Failures

```bash
# Clear node_modules and rebuild
rm -rf node_modules apps/*/node_modules services/*/node_modules
npm install
npm run build
```

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Support

- Documentation: [docs.idmatr.io](https://docs.idmatr.io)
- Issue Tracker: [github.com/Ayesh3p2/IdMatr/issues](https://github.com/Ayesh3p2/IdMatr/issues)

---

<p align="center">Built with ❤️ by the IDMatr Team</p>

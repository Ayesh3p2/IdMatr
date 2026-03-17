# IDMatr — Local Deployment Guide

This guide walks you through deploying the full IDMatr platform stack locally using a single `docker compose up` command.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | 4.x+ | https://docs.docker.com/desktop/ |
| Docker Compose | v2.x+ (bundled with Docker Desktop) | — |
| Git | any | https://git-scm.com |

> **Note:** On Linux, install Docker Engine + the Docker Compose plugin separately (`apt install docker-compose-plugin`).

---

## 1. Clone the Repository

```bash
git clone https://github.com/your-org/idmatr.git
cd idmatr
```

---

## 2. Configure Environment Variables

Copy the template and fill in the required values:

```bash
cp .env.example .env
```

Open `.env` in your editor. The **required** fields are:

### Required — Security

```dotenv
# Generate a strong secret (minimum 64 characters)
JWT_SECRET=$(openssl rand -base64 64)

# Database passwords
POSTGRES_PASSWORD=$(openssl rand -base64 24)
NEO4J_PASSWORD=$(openssl rand -base64 18)
REDIS_PASSWORD=$(openssl rand -base64 18)
```

### Required — Admin Login

```dotenv
ADMIN_EMAIL=admin@yourcompany.com

# Option A: bcrypt hash (recommended for production)
# Run this to generate: node -e "require('bcryptjs').hash('MyP@ssw0rd',12).then(console.log)"
ADMIN_PASSWORD_HASH=$2b$12$...

# Option B: plain text (dev/demo only)
# ADMIN_PASSWORD=changeme
```

> To generate the bcrypt hash you can run:
> ```bash
> node -e "require('bcryptjs').hash('YourPassword',12).then(h => console.log(h))"
> ```
> If Node.js isn't installed locally, run it inside the container after the first start:
> ```bash
> docker compose run --rm api-gateway node -e "require('bcryptjs').hash('YourPassword',12).then(h => console.log(h))"
> ```

### Optional — Demo Mode vs Real Connectors

By default `DEMO_MODE=true`. This uses realistic mock data — **no external API keys required**.

To use real identity source connectors, set `DEMO_MODE=false` and configure the relevant connector env vars. See [GOOGLE_WORKSPACE_SETUP.md](./GOOGLE_WORKSPACE_SETUP.md) for the full Google connector setup.

---

## 3. Start the Platform

```bash
docker compose up --build -d
```

This builds and starts **12 services**:

| Service | Port | Description |
|---------|------|-------------|
| `admin-dashboard` | 3000 | Next.js web UI |
| `api-gateway` | 3001 | NestJS HTTP gateway + JWT auth |
| `identity-service` | — | Identity management (internal NATS) |
| `discovery-service` | — | App discovery + connector scans |
| `governance-service` | — | Access workflows + certifications |
| `risk-engine` | — | Risk scoring + event detection |
| `audit-service` | — | Immutable audit log |
| `policy-engine` | — | Policy evaluation + SoD checks |
| `graph-service` | — | Neo4j-backed attack path analysis |
| `notification-service` | — | Email/Slack alerts |
| `worker-queue` | — | Background job processor |
| `postgres` | 5432 | Primary database |
| `redis` | 6379 | Cache + session store |
| `neo4j` | 7474/7687 | Identity graph database |
| `nats` | 4222 | Message bus |

The build takes **3–5 minutes** on first run (downloads base images, installs npm dependencies).

---

## 4. Wait for Services to Become Healthy

```bash
docker compose ps
```

All services should show `healthy` or `running`. You can watch the health checks with:

```bash
watch docker compose ps
```

The `api-gateway` starts last (depends on all other services). Allow **2–3 minutes** after the initial build.

---

## 5. Run Database Migrations

On first startup the database schema needs to be initialized. Run migrations for each service:

```bash
# Run all service migrations
for svc in identity-service discovery-service governance-service risk-engine audit-service policy-engine; do
  echo "Migrating $svc..."
  docker compose exec $svc npx prisma migrate deploy 2>/dev/null || \
  docker compose exec $svc npx prisma db push --accept-data-loss 2>/dev/null || true
done
```

Or run them individually:

```bash
docker compose exec identity-service npx prisma migrate deploy
docker compose exec discovery-service npx prisma migrate deploy
docker compose exec governance-service npx prisma migrate deploy
docker compose exec risk-engine npx prisma migrate deploy
docker compose exec audit-service npx prisma migrate deploy
docker compose exec policy-engine npx prisma migrate deploy
```

> **Note:** If `migrate deploy` fails because no migration history exists yet, use `npx prisma db push` instead. This is expected on a fresh install.

---

## 6. Access the Platform

Open your browser and navigate to:

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Admin Dashboard |
| http://localhost:3001/api/health | API health check |
| http://localhost:7474 | Neo4j Browser (graph visualization) |

**Login credentials** are whatever you set in `ADMIN_EMAIL` and `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH` in `.env`.

---

## 7. Run Your First Discovery Scan (Demo Mode)

1. Log in to the dashboard at http://localhost:3000
2. Navigate to **Applications**
3. Click **Run Discovery Scan**

In demo mode, this generates realistic mock identity and application data. With real connectors configured, it calls the actual APIs.

---

## 8. Stopping the Platform

```bash
# Stop all services (preserves data)
docker compose stop

# Stop and remove containers (preserves volumes/data)
docker compose down

# Full teardown including data volumes
docker compose down -v
```

---

## Troubleshooting

### Services fail to start — "port already in use"

Check if ports 3000, 3001, 4222, 5432, 6379, 7474, 7687 are free:

```bash
lsof -i :3000 -i :3001 -i :5432
```

### `api-gateway` never becomes healthy

Check its logs:

```bash
docker compose logs api-gateway --tail=50
```

Common causes:
- `JWT_SECRET` not set in `.env`
- One of the dependent microservices crashed (check `docker compose ps`)

### Prisma migration fails with "table already exists"

This is safe to ignore on re-runs. The schema is already applied.

### Neo4j graph data is empty

The graph-service connects to Neo4j on startup. If Neo4j takes too long to start, the service may need a restart:

```bash
docker compose restart graph-service
```

---

## Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ | — | JWT signing secret (min 64 chars) |
| `JWT_EXPIRES_IN` | | `8h` | JWT token expiry |
| `POSTGRES_PASSWORD` | ✅ | — | PostgreSQL password |
| `NEO4J_PASSWORD` | ✅ | — | Neo4j password |
| `REDIS_PASSWORD` | | — | Redis password (optional) |
| `ADMIN_EMAIL` | ✅ | — | Dashboard login email |
| `ADMIN_PASSWORD_HASH` | ✅* | — | bcrypt hash of admin password |
| `ADMIN_PASSWORD` | ✅* | — | Plain text password (dev only) |
| `DEMO_MODE` | | `true` | Use mock data instead of real connectors |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | | — | Google Workspace service account JSON |
| `GOOGLE_ADMIN_EMAIL` | | — | Admin email to impersonate |
| `GOOGLE_DOMAIN` | | — | Google Workspace domain |
| `MS365_TENANT_ID` | | — | Microsoft 365 tenant ID |
| `MS365_CLIENT_ID` | | — | Azure AD app client ID |
| `MS365_CLIENT_SECRET` | | — | Azure AD app client secret |
| `GITHUB_TOKEN` | | — | GitHub Personal Access Token |
| `GITHUB_ORG` | | — | GitHub organization name |
| `SLACK_TOKEN` | | — | Slack bot token |

*Either `ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD` is required.

---

## Architecture Overview

```
Browser
  │
  ▼
[Admin Dashboard :3000]  (Next.js)
  │  REST/JSON
  ▼
[API Gateway :3001]  (NestJS + JWT)
  │  NATS pub/sub
  ├──▶ [Identity Service]   → PostgreSQL (identity_service schema)
  ├──▶ [Discovery Service]  → PostgreSQL (discovery_service schema) + External APIs
  ├──▶ [Governance Service] → PostgreSQL (governance_service schema)
  ├──▶ [Risk Engine]        → PostgreSQL (risk_engine schema)
  ├──▶ [Audit Service]      → PostgreSQL (audit_service schema)
  ├──▶ [Policy Engine]      → PostgreSQL (policy_engine schema)
  ├──▶ [Graph Service]      → Neo4j
  ├──▶ [Notification Svc]   → SMTP / Slack webhook
  └──▶ [Worker Queue]       → Redis
```

All microservices communicate exclusively via NATS. The API Gateway is the only service exposed to the internet.

---

## Security Notes

- Never commit `.env` to version control
- Rotate `JWT_SECRET` regularly in production
- Use `ADMIN_PASSWORD_HASH` (bcrypt) instead of plain `ADMIN_PASSWORD` in production
- The `NEXT_PUBLIC_API_URL` must point to a URL reachable by the user's browser — for remote deployments this should be your public API hostname, not `http://localhost:3001`

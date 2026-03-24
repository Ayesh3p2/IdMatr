# IDMatr - Local Docker Deployment Summary

**Deployment Date:** March 18, 2026  
**Environment:** Local Docker with ngrok tunneling  
**Status:** ✅ Deployed and Running

## Service Access

### Infrastructure Services
- **PostgreSQL:** `postgresql://idmatr:password123@localhost:5432/idmatr_db`
- **Redis:** `redis://:redis_dev_password@localhost:6379/0`
- **Neo4j:** `http://localhost:7474/`
- **NATS:** `nats://localhost:4222`

### Admin Dashboard
- **Local URL:** [http://localhost:3000](http://localhost:3000)
- **Description:** Tenant admin interface for managing identities, policies, and access

### API Gateway
- **Local URL:** [http://localhost:3001](http://localhost:3001)
- **Description:** REST API endpoint for programmatic access

### Control Plane UI
- **Local URL:** [http://localhost:3002](http://localhost:3002)
- **Description:** Operator interface for platform administration

### Control Plane Backend
- **Local URL:** [http://localhost:3010](http://localhost:3010/control/system/health)
- **Description:** Internal API for platform operations

## Operator Credentials

```
Email:    operator@localhost
Password: admin123456
```

**Note:** Use these credentials to log in to the Control Plane UI at `http://localhost:3002` for operator access (break-glass access, tenant management, and system administration).

## SMTP Configuration for Email

```
SMTP Host:     smtp.ethereal.email
SMTP Port:     587
SMTP User:     tyrone.hilpert@ethereal.email
SMTP Password: cTKXCWPxTKgm1b4TQp
```

**Ethereal Email Setup:**
- This is a **test email service** (no real emails sent)
- To view test emails, visit: [ethereal.email](https://ethereal.email)
- Create an account and check your test mailbox for all notifications sent by IDMatr

## Microservices

All microservices are running internally via Docker network:

| Service | Port | Status |
|---------|------|--------|
| Identity Service | 3000 (internal) | ✅ Running |
| Discovery Service | 3001 (internal) | ✅ Running |
| Governance Service | 3002 (internal) | ✅ Running |
| Risk Engine | 3003 (internal) | ✅ Running |
| Audit Service | 3004 (internal) | ✅ Running |
| Policy Engine | 3005 (internal) | ✅ Running |
| Graph Service | 3006 (internal) | ✅ Running |
| Notification Service | 3007 (internal) | ✅ Running |
| Worker Queue | 3008 (internal) | ✅ Running |

## Public Access via ngrok

### Setup ngrok

```bash
# Install ngrok
brew install ngrok

# Sign up for free account at https://ngrok.com
# Authenticate ngrok
ngrok config add-authtoken <YOUR_AUTHTOKEN>

# Start ngrok tunnels
# Terminal 1: Admin Dashboard
ngrok http --domain=<your-domain>.ngrok.io 3000

# Terminal 2: API Gateway
ngrok http --domain=<your-domain>.ngrok.io 3001

# Terminal 3: Control Plane UI
ngrok http --domain=<your-domain>.ngrok.io 3002
```

### Update CORS and URLs

Once you have ngrok URLs, update the `.env` file:

```bash
ALLOWED_ORIGINS=https://<admin-domain>.ngrok.io,https://<api-domain>.ngrok.io,https://<cp-domain>.ngrok.io
NEXT_PUBLIC_API_URL=https://<api-domain>.ngrok.io
NEXT_PUBLIC_CP_API_URL=https://<cp-domain>.ngrok.io
```

Then restart Docker services:

```bash
docker compose restart api-gateway admin-dashboard control-plane-ui
```

## Quick Start Commands

### Start Services
```bash
cd /Users/sudhir/Music/IdMatr
docker compose up -d
```

### View Logs
```bash
docker compose logs -f                    # All services
docker compose logs -f api-gateway        # Specific service
docker compose logs -f control-plane      # Control plane
```

### Stop Services
```bash
docker compose down
```

### Reset Database
```bash
docker compose down -v  # Remove volumes
docker compose up -d     # Restart
```

### Access Database Directly
```bash
# PostgreSQL
docker compose exec postgres psql -U idmatr -d idmatr_db

# Redis CLI
docker compose exec redis redis-cli -a redis_dev_password

# Neo4j Browser
# Visit: http://localhost:7474
```

## Environment Configuration

**File:** `.env`

Key variables:
- `POSTGRES_PASSWORD` — Database password
- `NEO4J_PASSWORD` — Graph database password
- `REDIS_PASSWORD` — Cache password
- `OPERATOR_EMAIL` — Control plane admin email
- `OPERATOR_PASSWORD` — Control plane admin password
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — Email configuration
- `JWT_SECRET` — API authentication secret (production only!)

## Testing the System

### 1. Test Admin Dashboard
```bash
curl http://localhost:3000
```

### 2. Test API Gateway
```bash
curl http://localhost:3001/api/health
```

### 3. Test Control Plane
```bash
curl http://localhost:3010/control/system/health
```

### 4. Check Container Health
```bash
docker compose ps
```

All services should show "Up" or "Up (healthy)".

## Email Testing

1. Visit [ethereal.email](https://ethereal.email)
2. Log in with: `tyrone.hilpert@ethereal.email` / `cTKXCWPxTKgm1b4TQp`
3. Check "Messages" tab for any notifications from IDMatr
4. No real emails are sent—all are captured for testing

## Sign-Up Flow

1. Visit Admin Dashboard: [http://localhost:3000](http://localhost:3000)
2. Click "Sign Up" (or login if directed)
3. System will send verification email to Ethereal
4. Complete email verification
5. Access admin dashboard with your account

## Troubleshooting

### Control Plane not starting
```bash
docker compose logs control-plane
# Check for OPERATOR_EMAIL and OPERATOR_PASSWORD errors
```

### Database connection errors
```bash
# Verify database is running
docker compose exec postgres psql -U idmatr -c "SELECT version();"
```

### Email not sending
- Check SMTP credentials in `.env`
- Verify Ethereal email inbox at ethereal.email
- Check logs: `docker compose logs notification-service`

## Architecture Reference

See full documentation:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Complete system architecture
- [docs/COMPLIANCE_READINESS_ANALYSIS.md](docs/COMPLIANCE_READINESS_ANALYSIS.md) — Security and compliance status

## Next Steps

1. **Set up ngrok** for public access
2. **Create operator account** via Control Plane
3. **Configure integrations** (Google Workspace, Microsoft 365, etc.)
4. **Test identity discovery** with your SaaS applications
5. **Set up risk policies** and governance workflows
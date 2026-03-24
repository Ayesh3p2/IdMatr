# IDMatr Local Deployment - Status & Access Guide

**Date:** March 18, 2026  
**Status:** ✅ **DEPLOYED AND RUNNING**  
**Location:** `/Users/sudhir/Music/IdMatr`

## 🟢 Live Services

### Frontend Applications
| Service | Port | URL | Status |
|---------|------|-----|--------|
| Admin Dashboard | 3000 | http://localhost:3000 | ✅ Online |
| API Gateway | 3001 | http://localhost:3001 | ✅ Online |
| Control Plane UI | 3002 | http://localhost:3002 | ✅ Online |
| Control Plane Backend | 3010 | http://localhost:3010 | ⚠️ Starting |

### Infrastructure
| Component | Port | Type | Status |
|-----------|------|------|--------|
| PostgreSQL | 5432 | Database | ✅ Healthy |
| Redis | 6379 | Cache | ✅ Healthy |
| Neo4j | 7474 | Graph DB | ✅ Healthy |
| NATS | 4222 | Messaging | ✅ Healthy |

### Microservices (9 running internally)
- ✅ Identity Service (3000)
- ✅ Discovery Service (3001)
- ✅ Governance Service (3002)  
- ✅ Risk Engine (3003)
- ✅ Audit Service (3004)
- ✅ Policy Engine (3005)
- ✅ Graph Service (3006)
- ✅ Notification Service (3007)
- ✅ Worker Queue (3008)

## 🔐 Default Credentials

### Operator Account (Control Plane)
```
Email:    operator@localhost
Password: admin123456
```
**Login:** http://localhost:3002

### Email Service (Ethereal - Test Only)
```
Provider:  Ethereal Email (free testing)
SMTP Host: smtp.ethereal.email
Port:      587
Email:     tyrone.hilpert@ethereal.email
Password:  cTKXCWPxTKgm1b4TQp
Inbox:     https://ethereal.email/signin
```

### Database Credentials
```
PostgreSQL:  idmatr / password123
Redis:       (none) / redis_dev_password
Neo4j:       neo4j / password123
```

## 📡 Public Access with ngrok

### Install ngrok (if not already installed)

```bash
# Option A: Homebrew (recommended)
brew install ngrok

# Option B: Direct download
curl -OL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-arm64.zip
unzip ngrok-v3-stable-darwin-arm64.zip
sudo mv ngrok /usr/local/bin/

# Verify
ngrok --version
```

### Setup & Create Tunnels

```bash
# 1. Sign up at https://ngrok.com (free account)

# 2. Authenticate with your authtoken
ngrok config add-authtoken <YOUR_AUTHTOKEN>

# 3. Create public URLs (run in separate terminals):

# Terminal 1 - Admin Dashboard
ngrok http 3000

# Terminal 2 - API Gateway  
ngrok http 3001

# Terminal 3 - Control Plane UI
ngrok http 3002
```

### Example Output
```
ngrok                                          

Session Status        online
Account               sudhir (Plan: Free)
Region                us (United States)
Forwarding            https://abc12345.ngrok.io -> http://localhost:3000
Forwarding            http://abc12345.ngrok.io -> http://localhost:3000
```

### Configure Application with Public URLs

Once you have ngrok URLs, update `.env`:

```bash
# Replace with your actual ngrok URLs
ALLOWED_ORIGINS=https://abc12345.ngrok.io,https://def67890.ngrok.io,https://ghi11111.ngrok.io
NEXT_PUBLIC_API_URL=https://def67890.ngrok.io
NEXT_PUBLIC_CP_API_URL=https://ghi11111.ngrok.io
```

Then restart services:
```bash
docker compose restart api-gateway admin-dashboard control-plane-ui
```

## 🚀 Quick Start

### View the Application

1. **Admin Dashboard:** [http://localhost:3000](http://localhost:3000)
   - Sign up or login
   - Manage identities and access

2. **Control Plane (Operator):** [http://localhost:3002](http://localhost:3002)
   - Login with: `operator@localhost` / `admin123456`
   - Manage tenants and system settings

3. **API Gateway:** [http://localhost:3001](http://localhost:3001)
   - REST API endpoint
   - Requires JWT authentication

### Test Email Notifications

```bash
# Emails are captured by Ethereal
# View them at: https://ethereal.email

# Login with the credentials above
# Check "Messages" tab for notifications sent by IDMatr
```

## 📊 Docker Status

```bash
# Check all services
docker compose ps

# View logs
docker compose logs -f

# Check specific service
docker compose logs -f control-plane
docker compose logs -f notification-service
```

## 🔍 Database Access

### PostgreSQL
```bash
docker compose exec postgres psql -U idmatr -d idmatr_db
# Then: SELECT * FROM information_schema.tables WHERE table_schema = 'public';
```

### Redis
```bash
docker compose exec redis redis-cli -a redis_dev_password
> PING
> DBSIZE
```

### Neo4j Browser
```
http://localhost:7474
Username: neo4j
Password: password123
```

## 📝 Configuration Files

- **Environment:** [.env](.env)
- **Docker Compose:** [docker-compose.yml](docker-compose.yml)
- **Production Template:** [.env.production.secure](.env.production.secure)

## 📖 Documentation

- **Full Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
  - 16 sections covering complete system design
  - Microservices, databases, security, deployment

- **Compliance Status:** [docs/COMPLIANCE_READINESS_ANALYSIS.md](docs/COMPLIANCE_READINESS_ANALYSIS.md)
  - SOC 2 Type II readiness
  - GDPR/HIPAA/PCI-DSS coverage
  - Production readiness score: 98%

- **Deployment Guide:** [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)
  - Service access points
  - Troubleshooting guide
  - Architecture reference

- **Quick Start:** [QUICK_START_SETUP.md](QUICK_START_SETUP.md)
  - Step-by-step setup
  - ngrok configuration
  - Email testing

## 🎯 Next Steps

1. **✅ Docker deployed** - Services running locally
2. **✅ Database initialized** - PostgreSQL, Redis, Neo4j
3. **✅ Email configured** - Ethereal SMTP service
4. **✅ Credentials generated** - Operator account ready
5. **→ Setup ngrok** - Create public URLs
6. **→ Sign up** - Create admin account
7. **→ Configure integrations** - Connect Google, Azure, etc.
8. **→ Test workflows** - Access governance, risk detection

## ⚠️ Important Notes

### For Development/Testing:
- Using `password123` and other simple creds - **OK for local dev**
- Using Ethereal email - **No real emails sent**
- Running on localhost - **Local access only**
- Demo databases - **No production data**

### For Production:
- ❌ Never use default passwords
- ✅ Generate strong random secrets
- ✅ Use environment-specific configs
- ✅ Enable TLS/HTTPS
- ✅ Use secrets manager (Vault, AWS Secrets)
- ✅ Configure MFA
- ✅ Set up monitoring and logging

## 📞 Support

### Check Status
```bash
# Services running?
docker compose ps

# Logs for errors?
docker compose logs -f api-gateway

# Database connected?
docker compose exec postgres psql -U idmatr -d idmatr_db -c "SELECT 1"
```

### Common Issues

**Admin dashboard not loading:**
- Check: `docker compose logs -f admin-dashboard`
- Verify: http://localhost:3000

**API returning 401/403:**
- Control Plane not started yet
- Check: `docker compose logs -f control-plane`
- Verify credentials in `.env`

**Emails not being sent:**
- Check notification service: `docker compose logs -f notification-service`
- Verify SMTP credentials in `.env`
- View in Ethereal: https://ethereal.email

**ngrok URLs not working:**
- Restart API gateway: `docker compose restart api-gateway admin-dashboard`
- Update `.env` with correct ALLOWED_ORIGINS
- Check ngrok is still active in other terminals

---

**🎉 Your IDMatr instance is ready!**

**Start here:** [http://localhost:3000](http://localhost:3000)
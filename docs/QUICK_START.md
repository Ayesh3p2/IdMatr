# IDMatr Platform — Quick Start Deployment Guide

## 🚀 ONE-MINUTE SETUP

### Prerequisites
- Docker & Docker Compose installed
- Bash shell
- OpenSSL (for password generation)

### Quick Start (5 steps)

```bash
cd /Users/sudhir/Music/IdMatr

# 1. Generate secure credentials
chmod +x scripts/generate-env.sh
./scripts/generate-env.sh

# 2. Customize for your environment (edit .env.production)
# - ADMIN_EMAIL: Your email
# - OPERATOR_EMAIL: Operator email
# - ALLOWED_ORIGINS: Your domains
# - Integrations: Add provider credentials (optional)

# 3. Add to gitignore (IMPORTANT!)
echo ".env.production" >> .gitignore

# 4. Deploy
docker-compose --env-file .env.production up -d

# 5. Wait 30-45 seconds for services to start
sleep 45
```

## 🔍 VERIFY DEPLOYMENT

```bash
# Check API Gateway
curl http://localhost:3001/api/health

# Check Control Plane
curl http://localhost:3010/control/system/health

# View service logs
docker-compose logs -f

# List running services
docker-compose ps
```

## 🔐 FIRST-TIME LOGIN

**Control Plane (Operator Portal):**
- URL: http://localhost:3002
- Email: Use your OPERATOR_EMAIL from .env.production
- Password: Use your OPERATOR_PASSWORD from .env.production
- ⚠️ **CHANGE PASSWORD IMMEDIATELY** after first login

**Admin Dashboard (Tenant):**
- URL: http://localhost:3000
- Email: Use your ADMIN_EMAIL from .env.production
- Password: Use your ADMIN_PASSWORD from .env.production

## 📊 SYSTEM HEALTH CHECK

```bash
# Full health check script
docker-compose exec api-gateway wget -O - http://localhost:3001/api/health 2>/dev/null | jq .
docker-compose exec control-plane wget -O - http://localhost:3010/control/system/health 2>/dev/null | jq .

# Check database connectivity
docker-compose exec postgres psql -U idmatr -d idmatr_db -c "SELECT 1;"

# Check Neo4j
docker-compose exec neo4j cypher-shell -u neo4j -p $(grep NEO4J_PASSWORD .env.production | cut -d= -f2) "RETURN 1;"
```

## 🛑 STOP & CLEANUP

```bash
# Stop all services
docker-compose --env-file .env.production down

# Remove volumes (DELETE ALL DATA!)
docker-compose --env-file .env.production down -v

# Clean up unused Docker resources
docker system prune -a --volumes
```

## ⚠️ SECURITY CHECKLIST

- [ ] `.env.production` added to `.gitignore`
- [ ] `.env.production` backed up securely
- [ ] ADMIN_EMAIL customized (not example)
- [ ] OPERATOR_EMAIL customized (not example)
- [ ] ALLOWED_ORIGINS set to your domain(s)
- [ ] Passwords changed on first login
- [ ] MFA enabled for operators
- [ ] Integration credentials configured (if needed)

## 🔧 COMMON ISSUES & SOLUTIONS

### **Issue: "Connection refused" to API Gateway**
```bash
# Solution 1: Check container is running
docker-compose ps api-gateway

# Solution 2: View logs
docker-compose logs api-gateway

# Solution 3: Give more time (services may still be starting)
sleep 60
```

### **Issue: "OPERATOR_PASSWORD not configured"**
```bash
# Solution: Re-run credential generation
./scripts/generate-env.sh
# Review .env.production and try again
docker-compose down -v
docker-compose --env-file .env.production up -d
```

### **Issue: Database migration failed**
```bash
# Solution 1: Check Prisma client generation
docker-compose exec control-plane npm run prisma:generate

# Solution 2: Run migrations manually
docker-compose exec control-plane npx prisma migrate dev

# Solution 3: Check database logs
docker-compose logs postgres
```

### **Issue: Can't connect to Neo4j**
```bash
# Solution 1: Check password
grep NEO4J_PASSWORD .env.production

# Solution 2: Verify Neo4j is running
docker-compose ps neo4j

# Solution 3: Reset database
docker-compose down -v neo4j
docker-compose up -d neo4j
```

## 📚 ADDITIONAL DOCUMENTATION

- **Full Readiness Report:** `docs/PRODUCTION_READINESS_REPORT.md`
- **Architecture Details:** `docs/SECURITY_ARCHITECTURE.md`
- **Deployment Guide:** `docs/LOCAL_DEPLOYMENT_GUIDE.md`
- **Compliance Report:** `docs/COMPLIANCE_READINESS_REPORT.md`

## 🚨 CRITICAL SECURITY REMINDERS

1. **Never commit .env.production to git**
2. **Never share passwords in chat or email**
3. **Always change operator password on first login**
4. **Use strong, unique secrets (generate-env.sh does this)**
5. **Keep .env.production backed up securely**
6. **Enable MFA for all operator accounts**
7. **Restrict CORS origins to your domain only**

## 📞 SUPPORT

### Logs & Debugging
```bash
# View all service logs
docker-compose logs -f

# View specific service
docker-compose logs -f control-plane

# View last 100 lines
docker-compose logs --tail=100 api-gateway
```

### API Endpoints
- **API Gateway:** http://localhost:3001
- **Control Plane:** http://localhost:3010
- **Admin Dashboard:** http://localhost:3000
- **Control Plane UI:** http://localhost:3002

### Service Status
```bash
# View all services and their status
docker-compose ps

# Check specific service health
docker-compose exec api-gateway curl http://localhost:3001/api/health | jq .
```

---

## PRODUCTION DEPLOYMENT CHECKLIST

After successful local deployment:

- [ ] **Phases 5-13 completed** (see PRODUCTION_READINESS_REPORT.md)
- [ ] **Security audit passed** (Phase 11)
- [ ] **Compliance review done** (Phase 12)
- [ ] **Load testing passed** (Phase 10)
- [ ] **All integrations configured** (Google, Azure, Slack, etc.)
- [ ] **Email/SMTP configured** (notifications)
- [ ] **Backup strategy implemented** (database, secrets)
- [ ] **Monitoring set up** (logging, alerting)
- [ ] **Incident response plan ready** (Phase 12)
- [ ] **Approval from security team** (signoff)

---

**Ready to deploy?** Follow the 5-step Quick Start above! 🚀

#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Deployment Preparation Checklist — IDMatr Production
# ═══════════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}IDMatr Production Deployment Checklist${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}\n"

# ─────────────────────────────────────────────────────────────────────────────
# 1. SECRETS VERIFICATION
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${YELLOW}[1/6]${NC} Checking secrets configuration..."

if [ ! -f ".env.production.secure" ]; then
    echo -e "${RED}✗ .env.production.secure not found${NC}"
    exit 1
fi

perms=$(stat -f "%A" .env.production.secure 2>/dev/null || stat -c "%a" .env.production.secure)
if [ "$perms" != "600" ]; then
    echo -e "${RED}✗ .env.production.secure has incorrect permissions: $perms (should be 600)${NC}"
    chmod 600 .env.production.secure
    echo -e "${GREEN}✓ Fixed permissions to 600${NC}"
else
    echo -e "${GREEN}✓ .env.production.secure permissions: 600${NC}"
fi

# Verify all critical secrets are set
critical_secrets=("JWT_SECRET" "POSTGRES_PASSWORD" "NEO4J_PASSWORD" "REDIS_PASSWORD" "DATA_ENCRYPTION_KEY" "CONTROL_PLANE_JWT_SECRET")
for secret in "${critical_secrets[@]}"; do
    if grep -q "^${secret}=" .env.production.secure && ! grep -q "^${secret}=REPLACE_WITH" .env.production.secure; then
        echo -e "${GREEN}✓ $secret is configured${NC}"
    else
        echo -e "${RED}✗ $secret is missing or not configured${NC}"
        exit 1
    fi
done

# ─────────────────────────────────────────────────────────────────────────────
# 2. GIT SECURITY CHECK
# ─────────────────────────────────────────────────────────────────────────────

echo -e "\n${YELLOW}[2/6]${NC} Checking git configuration..."

if git rev-parse --git-dir > /dev/null 2>&1; then
    # Check if .env files are in .gitignore
    if grep -q "^\.env" .gitignore && grep -q ".env.production.secure" .gitignore; then
        echo -e "${GREEN}✓ .env and .env.production.secure in .gitignore${NC}"
    else
        echo -e "${YELLOW}⚠ .env files may not be fully ignored in .gitignore${NC}"
    fi

    # Check if .env files are already tracked
    if git ls-files | grep -E '\.env' | grep -v '\.env\.example' | grep -v '\.env\..*\.template'; then
        echo -e "${RED}✗ Tracked .env files detected! Remove with: git rm --cached <file>${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ No tracked .env secrets files${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Not a git repository${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. DOCKER CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

echo -e "\n${YELLOW}[3/6]${NC} Checking Docker configuration..."

if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}✗ docker-compose.yml not found${NC}"
    exit 1
fi

if [ ! -f "deploy/docker-compose.prod.yml" ]; then
    echo -e "${RED}✗ deploy/docker-compose.prod.yml not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ docker-compose.yml present${NC}"
echo -e "${GREEN}✓ deploy/docker-compose.prod.yml present${NC}"

if grep -q "REPLACE_WITH" deploy/docker-compose.prod.yml; then
    echo -e "${RED}✗ deploy/docker-compose.prod.yml contains unreplaced placeholders${NC}"
    exit 1
else
    echo -e "${GREEN}✓ deploy/docker-compose.prod.yml is configured${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. NATS CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

echo -e "\n${YELLOW}[4/6]${NC} Checking NATS configuration..."

if [ ! -f "deploy/nats/nats-server.conf" ]; then
    echo -e "${RED}✗ deploy/nats/nats-server.conf not found${NC}"
    exit 1
fi

if grep -q "tls {" deploy/nats/nats-server.conf && ! grep -q "^# tls {" deploy/nats/nats-server.conf; then
    echo -e "${GREEN}✓ NATS TLS configuration enabled${NC}"
else
    echo -e "${YELLOW}⚠ NATS TLS not enabled (required for production)${NC}"
fi

if grep -q "verify.*true" deploy/nats/nats-server.conf; then
    echo -e "${GREEN}✓ NATS TLS client verification enabled${NC}"
else
    echo -e "${YELLOW}⚠ NATS TLS client verification not configured${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. REQUIRED DIRECTORIES & FILES
# ─────────────────────────────────────────────────────────────────────────────

echo -e "\n${YELLOW}[5/6]${NC} Checking directory structure..."

required_dirs=("services" "apps" "packages" "deploy" "deploy/nats")
for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓ $dir present${NC}"
    else
        echo -e "${RED}✗ $dir missing${NC}"
        exit 1
    fi
done

# ─────────────────────────────────────────────────────────────────────────────
# 6. CONFIGURATION RECOMMENDATIONS
# ─────────────────────────────────────────────────────────────────────────────

echo -e "\n${YELLOW}[6/6]${NC} Production recommendations..."

echo -e "\n${YELLOW}Pre-Deployment Checklist:${NC}"
echo "  ☐ Generate TLS certificates for NATS:"
echo "    mkdir -p deploy/nats/certs"
echo "    cd deploy/nats/certs && openssl req -new -x509 -days 3650 -nodes -out server.crt -keyout server.key"
echo "    openssl req -new -x509 -days 3650 -nodes -out ca.crt -keyout ca.key"
echo ""
echo "  ☐ Update ALLOWED_ORIGINS in .env.production.secure to your domain"
echo "  ☐ Update NEXT_PUBLIC_API_URL and NEXT_PUBLIC_CP_API_URL"
echo "  ☐ Configure integration secrets (Google, Azure, GitHub, Slack, SMTP)"
echo "  ☐ Store .env.production.secure in secure secrets manager (Vault, AWS Secrets Manager, etc.)"
echo "  ☐ Never commit .env.production.secure to git"
echo ""
echo -e "${YELLOW}Deployment Command:${NC}"
echo "  docker compose -f docker-compose.yml \\"
echo "                 -f deploy/docker-compose.prod.yml \\"
echo "                 --env-file .env.production.secure up -d"
echo ""
echo -e "${YELLOW}Health Check:${NC}"
echo "  docker compose ps  # All services should show 'Up'"
echo "  docker compose logs -f api-gateway  # Monitor startup"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# FINAL STATUS
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All checks passed. Ready for deployment.${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}\n"

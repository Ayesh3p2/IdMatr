#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# IDMatr Secure Environment Generator
# ═══════════════════════════════════════════════════════════════════════════════
# Generates cryptographically secure random values for all secrets
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to generate random alphanumeric string
gen_random() {
  local length=$1
  openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to generate a secure password (uppercase, lowercase, numbers, symbols)
gen_password() {
  local length=$1
  local charset="A-Za-z0-9!@#$%^&*()_+-=[]{}|;:,.<>?"
  LC_ALL=C tr -dc "$charset" < /dev/urandom | head -c $length
}

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}IDMatr Secure Environment Generator${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if template exists
if [ ! -f ".env.production.template" ]; then
  echo -e "${RED}✗ .env.production.template not found${NC}"
  exit 1
fi

echo -e "${YELLOW}Generating secure environment variables...${NC}"
echo ""

# Initialize .env.production
cp .env.production.template .env.production
chmod 600 .env.production

# Generate secrets
POSTGRES_PASSWORD=$(gen_password 32)
NEO4J_PASSWORD=$(gen_password 32)
JWT_SECRET=$(gen_random 64)
CONTROL_PLANE_JWT_SECRET=$(gen_random 64)
INTERNAL_API_SECRET=$(gen_random 64)
ADMIN_PASSWORD=$(gen_password 32)
OPERATOR_PASSWORD=$(gen_password 32)
DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)
HASH_SALT=$(gen_random 32)

# Update .env.production
sed -i.bak "s/POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD_32_CHARS_MIN/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env.production
sed -i.bak "s/NEO4J_PASSWORD=REPLACE_WITH_STRONG_PASSWORD_32_CHARS_MIN/NEO4J_PASSWORD=$NEO4J_PASSWORD/" .env.production
sed -i.bak "s/JWT_SECRET=REPLACE_WITH_RANDOM_JWT_SECRET_64_CHARS_MIN/JWT_SECRET=$JWT_SECRET/" .env.production
sed -i.bak "s/CONTROL_PLANE_JWT_SECRET=REPLACE_WITH_RANDOM_JWT_SECRET_64_CHARS_MIN/CONTROL_PLANE_JWT_SECRET=$CONTROL_PLANE_JWT_SECRET/" .env.production
sed -i.bak "s/INTERNAL_API_SECRET=REPLACE_WITH_RANDOM_SECRET_64_CHARS_MIN/INTERNAL_API_SECRET=$INTERNAL_API_SECRET/" .env.production
sed -i.bak "s/ADMIN_PASSWORD=REPLACE_WITH_STRONG_PASSWORD_32_CHARS_MIN/ADMIN_PASSWORD=$ADMIN_PASSWORD/" .env.production
sed -i.bak "s/OPERATOR_PASSWORD=/OPERATOR_PASSWORD=$OPERATOR_PASSWORD/" .env.production
sed -i.bak "s/DATA_ENCRYPTION_KEY=REPLACE_WITH_BASE64_ENCRYPTION_KEY_32_BYTES/DATA_ENCRYPTION_KEY=$DATA_ENCRYPTION_KEY/" .env.production
sed -i.bak "s/HASH_SALT=REPLACE_WITH_RANDOM_SALT_32_CHARS/HASH_SALT=$HASH_SALT/" .env.production

# Set operator email default
sed -i.bak "s|OPERATOR_EMAIL=|OPERATOR_EMAIL=operator@idmatr.platform|" .env.production

# Remove backup file
rm -f .env.production.bak

echo -e "${GREEN}✓ Generated .env.production with secure secrets${NC}"
echo ""
echo -e "${YELLOW}CRITICAL CREDENTIALS (Save in secure location):${NC}"
echo ""
echo -e "${GREEN}Database Credentials:${NC}"
echo "  PostgreSQL Password: ${BLUE}[hidden - stored in .env.production]${NC}"
echo "  Neo4j Password: ${BLUE}[hidden - stored in .env.production]${NC}"
echo ""
echo -e "${GREEN}API Gateway Admin:${NC}"
echo "  Email: admin@yourdomain.com"
echo "  Password: ${BLUE}[hidden - stored in .env.production]${NC}"
echo ""
echo -e "${GREEN}Control Plane Operator (Initial Access):${NC}"
echo "  Email: operator@idmatr.platform"
echo "  Password: ${BLUE}[hidden - stored in .env.production]${NC}"
echo ""
echo -e "${RED}⚠️  IMPORTANT:${NC}"
echo "  1. Review .env.production and customize:"
echo "     - Set ADMIN_EMAIL to your email"
echo "     - Set OPERATOR_EMAIL to your operator email"
echo "     - Configure ALLOWED_ORIGINS for CORS"
echo "     - Set up integration credentials (Google, Azure, GitHub, Slack, etc.)"
echo ""
echo "  2. Add .env.production to .gitignore (DO NOT COMMIT)"
echo ""
echo "  3. Store a backup copy in your secure secret management system"
echo ""
echo "  4. Start the platform: docker-compose --env-file .env.production up"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

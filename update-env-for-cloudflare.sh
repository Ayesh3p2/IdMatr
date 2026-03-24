#!/bin/bash
# Update environment for Cloudflare Tunnel
# Run this after setting up Cloudflare tunnel

set -e

echo "🔄 Updating environment for Cloudflare Tunnel..."

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update ALLOWED_ORIGINS with Cloudflare domains
sed -i.bak 's|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002,https://admin-dashboard.idmatr.local,https://api-gateway.idmatr.local,https://control-plane-ui.idmatr.local|' .env

# Update API URLs for frontends
sed -i.bak 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://api-gateway.idmatr.local|' .env
sed -i.bak 's|NEXT_PUBLIC_CP_API_URL=.*|NEXT_PUBLIC_CP_API_URL=https://control-plane-ui.idmatr.local|' .env

echo "✅ Environment updated!"
echo "🔄 Rebuilding frontends with new URLs..."

# Rebuild frontends
docker-compose build admin-dashboard control-plane-ui

echo "✅ Setup complete!"
echo ""
echo "🌐 Your services will be available at:"
echo "  - Admin Dashboard: https://admin-dashboard.idmatr.local"
echo "  - API Gateway: https://api-gateway.idmatr.local"
echo "  - Control Plane UI: https://control-plane-ui.idmatr.local"
echo ""
echo "🚀 Start services: docker-compose up -d"
echo "🚇 Start tunnel: cloudflared tunnel run idmatr-tunnel &"
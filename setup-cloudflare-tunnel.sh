#!/bin/bash
# Cloudflare Tunnel Setup for IDMatr
# Run this after completing cloudflared login

set -e

echo "🚀 Setting up Cloudflare Tunnel for IDMatr..."

# Create tunnel
echo "📝 Creating tunnel..."
cloudflared tunnel create idmatr-tunnel

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep idmatr-tunnel | awk '{print $1}')
echo "Tunnel ID: $TUNNEL_ID"

# Create config file
cat > ~/.cloudflared/config.yaml << EOF
tunnel: idmatr-tunnel
credentials-file: ~/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: admin-dashboard.idmatr.local
    service: http://localhost:3000
  - hostname: api-gateway.idmatr.local
    service: http://localhost:3001
  - hostname: control-plane-ui.idmatr.local
    service: http://localhost:3002
  - service: http_status:404
EOF

echo "✅ Config created at ~/.cloudflared/config.yaml"

# Create DNS records (you'll need to run these manually)
echo "📋 DNS Records to create in Cloudflare:"
echo "  - admin-dashboard.idmatr.local -> CNAME to $TUNNEL_ID.cfargotunnel.com"
echo "  - api-gateway.idmatr.local -> CNAME to $TUNNEL_ID.cfargotunnel.com"
echo "  - control-plane-ui.idmatr.local -> CNAME to $TUNNEL_ID.cfargotunnel.com"

echo ""
echo "🎯 Next steps:"
echo "1. Create the DNS CNAME records above in your Cloudflare dashboard"
echo "2. Run: cloudflared tunnel route dns idmatr-tunnel admin-dashboard.idmatr.local"
echo "3. Run: cloudflared tunnel route dns idmatr-tunnel api-gateway.idmatr.local"
echo "4. Run: cloudflared tunnel route dns idmatr-tunnel control-plane-ui.idmatr.local"
echo "5. Start tunnel: cloudflared tunnel run idmatr-tunnel"
echo ""
echo "Or run all at once:"
echo "cloudflared tunnel run idmatr-tunnel &"
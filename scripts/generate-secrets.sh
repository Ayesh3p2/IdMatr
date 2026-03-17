#!/bin/bash
# Generate cryptographically secure secrets for IDMatr production deployment

set -e

echo "Generating secure secrets for IDMatr production..."
echo ""
echo "Copy the output below into your .env.production.secure file"
echo "=" 
echo ""

echo "# Generated $(date '+%Y-%m-%d %H:%M:%S')"
echo "JWT_SECRET=$(openssl rand -base64 64)"
echo "INTERNAL_API_SECRET=$(openssl rand -base64 64)"
echo "DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "NEO4J_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_API_GATEWAY_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_IDENTITY_SERVICE_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_DISCOVERY_SERVICE_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_GOVERNANCE_SERVICE_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_RISK_ENGINE_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_AUDIT_SERVICE_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_POLICY_ENGINE_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_GRAPH_SERVICE_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_NOTIFICATION_SERVICE_PASSWORD=$(openssl rand -base64 32)"
echo "NATS_WORKER_QUEUE_PASSWORD=$(openssl rand -base64 32)"
echo "CONTROL_PLANE_JWT_SECRET=$(openssl rand -base64 64)"
echo "HASH_SALT=$(openssl rand -base64 32)"

echo ""
echo "="

#!/usr/bin/env bash
# generate-tls-certs.sh — Generates self-signed TLS certificates for internal services
# Use this for development/staging. In production, replace with certificates from a
# trusted CA (Let's Encrypt, AWS ACM, etc.)
set -euo pipefail

CERTS_DIR="$(cd "$(dirname "$0")" && pwd)/certs"
mkdir -p "$CERTS_DIR"/{ca,nats,postgres,redis}

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# ── Root CA ───────────────────────────────────────────────────────────────────
if [ ! -f "$CERTS_DIR/ca/ca.crt" ]; then
  log "Generating root CA..."
  openssl genrsa -out "$CERTS_DIR/ca/ca.key" 4096
  openssl req -new -x509 -days 3650 -key "$CERTS_DIR/ca/ca.key" \
    -out "$CERTS_DIR/ca/ca.crt" \
    -subj "/C=US/ST=CA/O=IDMatr Internal CA/CN=idmatr-internal-ca"
  log "Root CA created."
fi

generate_cert() {
  local service="$1"
  local cn="$2"
  local san="$3"
  local dir="$CERTS_DIR/$service"
  mkdir -p "$dir"

  if [ -f "$dir/server.crt" ]; then
    log "Certificate for $service already exists, skipping."
    return
  fi

  log "Generating certificate for $service (CN=$cn)..."
  openssl genrsa -out "$dir/server.key" 2048
  openssl req -new -key "$dir/server.key" \
    -out "$dir/server.csr" \
    -subj "/C=US/ST=CA/O=IDMatr/CN=$cn"

  cat > "$dir/ext.cnf" <<EOF
[req]
req_extensions = v3_req
[v3_req]
subjectAltName = $san
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
EOF

  openssl x509 -req -days 825 \
    -in "$dir/server.csr" \
    -CA "$CERTS_DIR/ca/ca.crt" \
    -CAkey "$CERTS_DIR/ca/ca.key" \
    -CAcreateserial \
    -out "$dir/server.crt" \
    -extfile "$dir/ext.cnf" \
    -extensions v3_req

  cp "$CERTS_DIR/ca/ca.crt" "$dir/ca.crt"
  chmod 600 "$dir/server.key"
  log "Certificate for $service generated."
}

generate_cert "nats"     "nats"     "DNS:nats,DNS:localhost,IP:127.0.0.1"
generate_cert "postgres" "postgres" "DNS:postgres,DNS:localhost,IP:127.0.0.1"
generate_cert "redis"    "redis"    "DNS:redis,DNS:localhost,IP:127.0.0.1"

log "All certificates generated in $CERTS_DIR"
log ""
log "Next steps:"
log "  1. Mount certs into containers via docker-compose.prod.yml overrides"
log "  2. Update connection strings to use sslmode=require"
log "  3. For production, replace with certificates from a trusted CA"

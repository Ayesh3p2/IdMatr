#!/bin/bash
# IDMatr Agent — Local integration test script
# Tests the agent against a locally running IDMatr stack.
# Usage: ./scripts/test-local.sh [server_url]
set -euo pipefail

SERVER_URL="${1:-http://localhost:3001}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BINARY="$ROOT_DIR/dist/idmart-agent-$(go env GOOS)-$(go env GOARCH)"

if [[ "$(go env GOOS)" == "windows" ]]; then
    BINARY="${BINARY}.exe"
fi

# Build if binary doesn't exist.
if [[ ! -f "$BINARY" ]]; then
    echo "==> Building agent..."
    cd "$ROOT_DIR"
    go build -ldflags="-X main.Version=test" -o "$BINARY" ./cmd/agent
fi

# Create a temporary config pointing at the local server.
TMP_CONFIG=$(mktemp /tmp/idmart-agent-test-XXXXXX.yaml)
cat > "$TMP_CONFIG" << EOF
server_url: "${SERVER_URL}"
api_token: "test-token"
device_id: ""
scan_interval: 60
log_level: "debug"
log_file: ""
queue_dir: "/tmp/idmart-queue-test"
update_check_interval: 0
tls_skip_verify: true
tags:
  environment: "test"
  team: "engineering"
EOF

echo "==> Config written to $TMP_CONFIG"
echo "==> Running agent against $SERVER_URL for 90 seconds..."
echo "    Press Ctrl+C to stop early."
echo ""

cleanup() {
    rm -f "$TMP_CONFIG"
    rm -rf /tmp/idmart-queue-test
}
trap cleanup EXIT

# Run the agent in the foreground for a limited time.
timeout 90 "$BINARY" -config "$TMP_CONFIG" || true

echo ""
echo "==> Test run complete."

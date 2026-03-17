#!/bin/bash
# IDMatr Agent — Linux Installer
# Usage: sudo ./install.sh [server_url] [api_token]
set -euo pipefail

INSTALL_DIR="/opt/idmart"
CONFIG_DIR="/etc/idmart"
LOG_DIR="/var/log/idmart"
QUEUE_DIR="/var/lib/idmart/queue"
CONFIG_FILE="$CONFIG_DIR/agent.yaml"
BINARY_DEST="$INSTALL_DIR/idmart-agent"
SERVICE_SRC="$(dirname "$0")/idmart-agent.service"
SERVICE_DEST="/etc/systemd/system/idmart-agent.service"
SERVER_URL="${1:-https://your-idmart-instance.com}"
API_TOKEN="${2:-}"

if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run as root (sudo ./install.sh)" >&2
    exit 1
fi

# Detect architecture.
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)  ARCH_TAG="amd64" ;;
    aarch64) ARCH_TAG="arm64" ;;
    *)       echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

SCRIPT_DIR="$(dirname "$0")"

# Find binary.
BINARY_SRC="$SCRIPT_DIR/idmart-agent"
if [[ ! -f "$BINARY_SRC" ]]; then
    BINARY_SRC="$SCRIPT_DIR/../../dist/idmart-agent-linux-$ARCH_TAG"
    if [[ ! -f "$BINARY_SRC" ]]; then
        echo "Error: No binary found at $BINARY_SRC" >&2
        exit 1
    fi
fi

echo "==> Creating directories..."
mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR" "$QUEUE_DIR"
chmod 750 "$CONFIG_DIR"

echo "==> Installing binary to $BINARY_DEST..."
cp "$BINARY_SRC" "$BINARY_DEST"
chmod 755 "$BINARY_DEST"
chown root:root "$BINARY_DEST"

echo "==> Writing configuration..."
if [[ ! -f "$CONFIG_FILE" ]]; then
    cat > "$CONFIG_FILE" << EOF
server_url: "${SERVER_URL}"
api_token: "${API_TOKEN}"
device_id: ""
scan_interval: 300
log_level: "info"
log_file: "/var/log/idmart/agent.log"
queue_dir: "/var/lib/idmart/queue"
update_check_interval: 3600
tls_skip_verify: false
tags:
  environment: "production"
  team: ""
  location: ""
EOF
    chmod 640 "$CONFIG_FILE"
    chown root:root "$CONFIG_FILE"
    echo "    Config written to $CONFIG_FILE"
else
    echo "    Config already exists — not overwriting."
fi

echo "==> Installing systemd service..."
cp "$SERVICE_SRC" "$SERVICE_DEST"
chmod 644 "$SERVICE_DEST"

systemctl daemon-reload
systemctl enable idmart-agent
systemctl restart idmart-agent

echo ""
echo "IDMatr Agent installed and running."
echo "  Binary:  $BINARY_DEST"
echo "  Config:  $CONFIG_FILE"
echo "  Logs:    journalctl -u idmart-agent -f"
echo ""
echo "Service status:"
systemctl status idmart-agent --no-pager

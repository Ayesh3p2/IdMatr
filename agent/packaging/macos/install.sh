#!/bin/bash
# IDMatr Agent — macOS Installer
# Usage: sudo ./install.sh [server_url] [api_token]
set -euo pipefail

INSTALL_DIR="/Library/IDMatr"
LOG_DIR="/Library/Logs/IDMatr"
PLIST_SRC="$(dirname "$0")/com.idmart.agent.plist"
PLIST_DEST="/Library/LaunchDaemons/com.idmart.agent.plist"
BINARY_SRC="$(dirname "$0")/idmart-agent"
BINARY_DEST="$INSTALL_DIR/idmart-agent"
CONFIG_FILE="$INSTALL_DIR/agent.yaml"
SERVER_URL="${1:-https://your-idmart-instance.com}"
API_TOKEN="${2:-}"

# Require root.
if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run as root (sudo ./install.sh)" >&2
    exit 1
fi

echo "==> Creating installation directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$INSTALL_DIR/queue"

echo "==> Installing agent binary..."
if [[ -f "$BINARY_SRC" ]]; then
    cp "$BINARY_SRC" "$BINARY_DEST"
else
    # Try to find a pre-built binary in the dist directory.
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64) ARCH_TAG="amd64" ;;
        arm64)  ARCH_TAG="arm64" ;;
        *)      echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
    esac
    DIST_BIN="$(dirname "$0")/../../dist/idmart-agent-darwin-$ARCH_TAG"
    if [[ -f "$DIST_BIN" ]]; then
        cp "$DIST_BIN" "$BINARY_DEST"
    else
        echo "Error: No binary found at $BINARY_SRC or $DIST_BIN" >&2
        exit 1
    fi
fi
chmod 755 "$BINARY_DEST"
chown root:wheel "$BINARY_DEST"

echo "==> Writing configuration..."
if [[ ! -f "$CONFIG_FILE" ]]; then
    cat > "$CONFIG_FILE" << EOF
server_url: "${SERVER_URL}"
api_token: "${API_TOKEN}"
device_id: ""
scan_interval: 300
log_level: "info"
log_file: "/Library/Logs/IDMatr/agent.log"
queue_dir: "/Library/IDMatr/queue"
update_check_interval: 3600
tls_skip_verify: false
tags:
  environment: "production"
  team: ""
  location: ""
EOF
    chmod 640 "$CONFIG_FILE"
    chown root:wheel "$CONFIG_FILE"
    echo "    Config written to $CONFIG_FILE"
else
    echo "    Config already exists at $CONFIG_FILE — not overwriting"
fi

echo "==> Installing LaunchDaemon plist..."
cp "$PLIST_SRC" "$PLIST_DEST"
chmod 644 "$PLIST_DEST"
chown root:wheel "$PLIST_DEST"

# Unload any existing instance first.
if launchctl list com.idmart.agent &>/dev/null; then
    echo "==> Unloading existing service..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

echo "==> Loading and starting service..."
launchctl load -w "$PLIST_DEST"

echo ""
echo "IDMatr Agent installed successfully."
echo "  Binary:  $BINARY_DEST"
echo "  Config:  $CONFIG_FILE"
echo "  Logs:    $LOG_DIR/agent.log"
echo ""
echo "Check service status with:"
echo "  sudo launchctl list com.idmart.agent"

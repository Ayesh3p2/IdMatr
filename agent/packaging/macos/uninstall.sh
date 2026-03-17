#!/bin/bash
# IDMatr Agent — macOS Uninstaller
set -euo pipefail

INSTALL_DIR="/Library/IDMatr"
LOG_DIR="/Library/Logs/IDMatr"
PLIST_DEST="/Library/LaunchDaemons/com.idmart.agent.plist"

if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run as root (sudo ./uninstall.sh)" >&2
    exit 1
fi

echo "==> Stopping IDMatr Agent service..."
if launchctl list com.idmart.agent &>/dev/null; then
    launchctl unload -w "$PLIST_DEST" 2>/dev/null || true
    echo "    Service stopped and unloaded."
else
    echo "    Service was not running."
fi

echo "==> Removing LaunchDaemon plist..."
rm -f "$PLIST_DEST"

echo "==> Removing installation directory..."
rm -rf "$INSTALL_DIR"

echo "==> Removing log directory..."
rm -rf "$LOG_DIR"

echo ""
echo "IDMatr Agent has been uninstalled."

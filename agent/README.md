# IDMatr Discovery Agent

A production-grade, cross-platform identity and SaaS discovery agent for the
IDMatr Identity Security Platform. Written in Go, the agent runs as a system
service on macOS, Linux, and Windows and continuously reports telemetry to the
IDMatr backend.

## What it collects

| Category | Details |
|----------|---------|
| Device | Hostname, OS/version, hardware model, serial number, IP addresses, MAC |
| Current user | Username, display name, home directory, shell |
| Installed applications | Name, version, publisher, install date, source |
| Running processes | PID, name, path, user, CPU%, memory |
| SaaS domains | Detected from browser history (Chrome, Firefox, Safari, Edge, Brave) |
| Privileges | Admin/sudoer status, admin group membership |
| Network connections | Active TCP/UDP connections with process attribution |
| Security posture | Firewall, disk encryption, screen lock, OS patches, antivirus |

## Requirements

- Go 1.22+ (for building)
- No runtime dependencies — single static binary per platform

## Building

```bash
# Build for all platforms
./build/build.sh 1.0.0

# Build for the current platform only
go build -ldflags="-X main.Version=1.0.0" -o dist/idmart-agent ./cmd/agent
```

Output binaries are placed in `dist/`:

```
dist/
  idmart-agent-darwin-amd64
  idmart-agent-darwin-arm64
  idmart-agent-linux-amd64
  idmart-agent-linux-arm64
  idmart-agent-linux-386
  idmart-agent-windows-amd64.exe
  idmart-agent-windows-arm64.exe
  SHA256SUMS
```

## Configuration

Copy `agent.yaml.example` to the platform-appropriate location and edit:

| Platform | Default path |
|----------|-------------|
| macOS | `/Library/IDMatr/agent.yaml` |
| Linux | `/etc/idmart/agent.yaml` |
| Windows | `%ProgramData%\IDMatr\agent.yaml` |

### Environment variable overrides

| Variable | Config field |
|----------|-------------|
| `IDMART_SERVER_URL` | `server_url` |
| `IDMART_API_TOKEN` | `api_token` |
| `IDMART_DEVICE_ID` | `device_id` |

### Key fields

```yaml
server_url: "https://your-idmart-instance.com"
api_token: ""        # Required — obtain from IDMatr console
scan_interval: 300   # Seconds between full scans
log_level: "info"    # debug | info | warn | error
```

## Installation

### macOS

```bash
sudo ./packaging/macos/install.sh https://your-idmart.com tok_yourtokenhere
```

The installer:
1. Copies the binary to `/Library/IDMatr/`
2. Writes a default config to `/Library/IDMatr/agent.yaml`
3. Installs and loads the LaunchDaemon at `/Library/LaunchDaemons/com.idmart.agent.plist`

**Uninstall:** `sudo ./packaging/macos/uninstall.sh`

### Linux (systemd)

```bash
sudo ./packaging/linux/install.sh https://your-idmart.com tok_yourtokenhere
```

The installer:
1. Copies the binary to `/opt/idmart/`
2. Writes a default config to `/etc/idmart/agent.yaml`
3. Installs and starts the systemd unit `idmart-agent.service`

View logs: `journalctl -u idmart-agent -f`

**Uninstall:**
```bash
systemctl stop idmart-agent
systemctl disable idmart-agent
rm -f /etc/systemd/system/idmart-agent.service
rm -rf /opt/idmart /etc/idmart /var/log/idmart /var/lib/idmart
systemctl daemon-reload
```

#### Debian package

Build a `.deb` with `dpkg-buildpackage` from the `packaging/linux/debian/` directory.

#### RPM package

Build an RPM with `rpmbuild -ba packaging/linux/idmart-agent.spec`.

### Windows

```powershell
# Run as Administrator
.\packaging\windows\install.ps1 -ServerURL "https://your-idmart.com" -APIToken "tok_yourtokenhere"
```

The installer:
1. Copies the binary to `%ProgramData%\IDMatr\`
2. Writes a default config to `%ProgramData%\IDMatr\agent.yaml`
3. Creates and starts the Windows Service `IDMatrAgent`

**Uninstall:** `.\packaging\windows\uninstall.ps1` (as Administrator)

## CLI usage

```bash
# Run interactively (foreground)
./idmart-agent -config /path/to/agent.yaml

# Service management
./idmart-agent -service install
./idmart-agent -service start
./idmart-agent -service stop
./idmart-agent -service status
./idmart-agent -service uninstall

# Print version
./idmart-agent -version
```

## Offline queuing

When the IDMatr server is unreachable the agent queues events to
`{queue_dir}/events.queue` as newline-delimited JSON. On the next successful
connection the queue is drained automatically. The queue holds a maximum of
10,000 events; older events are dropped when the limit is reached.

## Auto-update

When `update_check_interval > 0` the agent periodically queries
`GET /api/agent/version` on the server. If a newer version is available the
agent:

1. Downloads the binary from the URL returned by the server
2. Verifies the SHA-256 checksum
3. Atomically replaces the running binary
4. Re-execs itself with the original arguments

## Local testing

```bash
# Requires a running IDMatr stack (docker-compose up from the repo root)
./scripts/test-local.sh http://localhost:3001
```

## Architecture

```
cmd/agent/
  main.go              — entry point, service lifecycle, CLI flags

internal/
  config/
    config.go          — YAML config loading, env overrides, device ID generation

  collector/
    types.go           — shared TelemetryEvent and sub-types
    collector.go       — main orchestrator (calls all sub-collectors)
    device.go          — DeviceCollector interface
    device_darwin.go   — macOS device info (sw_vers, sysctl, system_profiler)
    device_linux.go    — Linux device info (/etc/os-release, /sys/class/dmi)
    device_windows.go  — Windows device info (wmic)
    process.go         — ProcessCollector interface
    process_darwin.go  — macOS: ps -eo pid,user,pcpu,rss,comm
    process_linux.go   — Linux: /proc/*/status + /proc/*/stat
    process_windows.go — Windows: tasklist /FO CSV
    network.go         — netstat parsing (cross-platform)
    security_posture.go          — PostureCollector interface
    security_posture_darwin.go   — macOS: alf, fdesetup, softwareupdate
    security_posture_linux.go    — Linux: ufw, iptables, LUKS, ClamAV
    security_posture_windows.go  — Windows: netsh, manage-bde, Defender registry

  discovery/
    apps.go            — AppDiscovery interface
    apps_darwin.go     — /Applications scan + system_profiler JSON
    apps_linux.go      — dpkg-query / rpm -qa
    apps_windows.go    — Windows registry uninstall keys
    privilege.go       — PrivilegeDetector interface + GetCurrentUser()
    privilege_darwin.go — dscl admin group, sudoers
    privilege_linux.go  — /etc/group sudo/wheel, sudoers
    privilege_windows.go — Token elevation, net localgroup
    saas.go            — Browser history SQLite scanning (Chrome/FF/Safari/Edge/Brave)

  transport/
    client.go          — HTTP client with retry, registration, event submission
    queue.go           — File-backed offline event queue

  update/
    updater.go         — Self-update: download, checksum verify, atomic replace

  logger/
    logger.go          — Structured levelled logger with rotation
    logger_unix.go     — No-op Windows Event Log stub
    logger_windows.go  — Windows Event Log integration

packaging/
  macos/              — LaunchDaemon plist + install/uninstall scripts
  windows/            — PowerShell install/uninstall scripts
  linux/              — systemd unit + install script + RPM spec + Debian control

build/
  build.sh            — Cross-platform build script

scripts/
  test-local.sh       — Integration test against local IDMatr stack
```

## Security notes

- Config file is created with mode `0640` (root-readable only)
- TLS verification is enabled by default; `tls_skip_verify: true` should never be set in production
- The agent does not store credentials in memory beyond what is needed for the current request
- Browser history is read by copying the SQLite file to a temp location; the original is never modified
- On Linux, `ProtectHome=read-only` and `NoNewPrivileges=true` are enforced by the systemd unit

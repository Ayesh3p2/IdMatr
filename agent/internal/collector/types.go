// Package collector re-exports the shared types from internal/types so that
// existing code referencing collector.TelemetryEvent etc. continues to compile.
package collector

import "github.com/idmart/agent/internal/types"

// AgentVersion is the running agent's version string (set via ldflags at build time).
// It mirrors types.AgentVersion and is kept in sync by main.go.
var AgentVersion = "dev"

// Re-export all shared types as aliases so callers that use collector.XYZ still work.
type TelemetryEvent = types.TelemetryEvent
type DeviceInfo = types.DeviceInfo
type UserInfo = types.UserInfo
type AppInfo = types.AppInfo
type ProcessInfo = types.ProcessInfo
type SaaSInfo = types.SaaSInfo
type PrivilegeInfo = types.PrivilegeInfo
type ConnInfo = types.ConnInfo
type SecurityPosture = types.SecurityPosture

// Package types defines the shared data types used throughout the agent.
// It is kept separate from all other packages to avoid import cycles between
// collector and discovery.
package types

import "time"

// AgentVersion is set at build time via -ldflags "-X main.Version=x.y.z".
// It is exported here so all packages can reference it from a single place.
var AgentVersion = "dev"

// TelemetryEvent is the top-level payload sent to the IDMatr server.
type TelemetryEvent struct {
	DeviceID     string          `json:"device_id"`
	AgentVersion string          `json:"agent_version"`
	Timestamp    time.Time       `json:"timestamp"`
	Device       DeviceInfo      `json:"device"`
	User         UserInfo        `json:"user"`
	Applications []AppInfo       `json:"applications"`
	Processes    []ProcessInfo   `json:"processes"`
	SaaSDomains  []SaaSInfo      `json:"saas_domains"`
	Privileges   PrivilegeInfo   `json:"privileges"`
	NetworkConns []ConnInfo      `json:"network_connections"`
	Security     SecurityPosture `json:"security_posture"`
}

// DeviceInfo describes the host machine.
type DeviceInfo struct {
	DeviceID      string   `json:"device_id"`
	Hostname      string   `json:"hostname"`
	OS            string   `json:"os"`
	OSVersion     string   `json:"os_version"`
	HardwareModel string   `json:"hardware_model"`
	SerialNumber  string   `json:"serial_number"`
	Architecture  string   `json:"architecture"`
	IPAddresses   []string `json:"ip_addresses"`
	MACAddress    string   `json:"mac_address"`
}

// UserInfo describes the currently logged-in user.
type UserInfo struct {
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	HomeDir     string `json:"home_dir"`
	Shell       string `json:"shell"`
	IsAdmin     bool   `json:"is_admin"`
}

// AppInfo describes an installed application.
type AppInfo struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Path        string `json:"path"`
	Publisher   string `json:"publisher"`
	InstallDate string `json:"install_date"`
	Source      string `json:"source"` // e.g. "system_profiler", "dpkg", "rpm", "registry"
	BundleID    string `json:"bundle_id,omitempty"`
}

// ProcessInfo describes a running process.
type ProcessInfo struct {
	PID         int     `json:"pid"`
	Name        string  `json:"name"`
	Path        string  `json:"path"`
	User        string  `json:"user"`
	CPUPercent  float64 `json:"cpu_percent"`
	MemoryBytes uint64  `json:"memory_bytes"`
}

// SaaSInfo represents a detected SaaS service.
type SaaSInfo struct {
	Domain   string    `json:"domain"`
	Service  string    `json:"service"`
	LastSeen time.Time `json:"last_seen"`
	Source   string    `json:"source"` // e.g. "browser_history", "network_connection"
	Users    []string  `json:"users,omitempty"`
}

// PrivilegeInfo describes the privilege level of the current user.
type PrivilegeInfo struct {
	IsAdmin         bool     `json:"is_admin"`
	IsSudoer        bool     `json:"is_sudoer"`
	AdminGroups     []string `json:"admin_groups"`
	ElevatedProcess bool     `json:"elevated_process"`
}

// ConnInfo describes an active network connection.
type ConnInfo struct {
	Protocol    string `json:"protocol"`
	LocalAddr   string `json:"local_addr"`
	RemoteAddr  string `json:"remote_addr"`
	Domain      string `json:"domain,omitempty"`
	State       string `json:"state"`
	PID         int    `json:"pid"`
	ProcessName string `json:"process_name,omitempty"`
}

// SecurityPosture summarises the device's security configuration.
type SecurityPosture struct {
	FirewallEnabled    bool `json:"firewall_enabled"`
	EncryptionEnabled  bool `json:"encryption_enabled"`
	ScreenLockEnabled  bool `json:"screen_lock_enabled"`
	OSUpToDate         bool `json:"os_up_to_date"`
	AntivirusInstalled bool `json:"antivirus_installed"`
}

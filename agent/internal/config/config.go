package config

import (
	"crypto/sha256"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config holds all agent configuration.
type Config struct {
	ServerURL           string            `yaml:"server_url"`
	APIToken            string            `yaml:"api_token"`
	DeviceID            string            `yaml:"device_id"`
	ScanInterval        int               `yaml:"scan_interval"`
	LogFile             string            `yaml:"log_file"`
	LogLevel            string            `yaml:"log_level"`
	TLSSkipVerify       bool              `yaml:"tls_skip_verify"`
	QueueDir            string            `yaml:"queue_dir"`
	UpdateCheckInterval int               `yaml:"update_check_interval"`
	Tags                map[string]string `yaml:"tags"`

	// configPath is the file from which the config was loaded (for saving DeviceID back).
	configPath string
}

// configSearchPaths returns the ordered list of directories to search for agent.yaml.
func configSearchPaths() []string {
	switch runtime.GOOS {
	case "darwin":
		return []string{
			"/Library/IDMatr",
			filepath.Join(os.Getenv("HOME"), ".idmart"),
			".",
		}
	case "windows":
		pd := os.Getenv("ProgramData")
		if pd == "" {
			pd = `C:\ProgramData`
		}
		return []string{
			filepath.Join(pd, "IDMatr"),
			".",
		}
	default: // linux and others
		return []string{
			"/etc/idmart",
			filepath.Join(os.Getenv("HOME"), ".idmart"),
			".",
		}
	}
}

// Load reads the config from agent.yaml in the standard search paths, then applies env overrides.
func Load() (*Config, error) {
	cfg := &Config{}
	setDefaults(cfg)

	// Try to find and load the config file.
	for _, dir := range configSearchPaths() {
		path := filepath.Join(dir, "agent.yaml")
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, fmt.Errorf("config: parse error in %s: %w", path, err)
		}
		cfg.configPath = path
		break
	}

	// Apply environment variable overrides.
	applyEnvOverrides(cfg)

	// Apply defaults to zero values.
	applyDefaultsPost(cfg)

	// Ensure device ID is set.
	if err := ensureDeviceID(cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

// LoadFromFile loads config from a specific file path.
func LoadFromFile(path string) (*Config, error) {
	cfg := &Config{}
	setDefaults(cfg)

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("config: cannot read %s: %w", path, err)
	}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("config: parse error in %s: %w", path, err)
	}
	cfg.configPath = path

	applyEnvOverrides(cfg)
	applyDefaultsPost(cfg)

	if err := ensureDeviceID(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

// setDefaults applies compile-time defaults before file loading.
func setDefaults(cfg *Config) {
	cfg.ScanInterval = 300
	cfg.LogLevel = "info"
	cfg.UpdateCheckInterval = 3600
	cfg.TLSSkipVerify = false
}

// applyDefaultsPost applies defaults to fields that may have been zeroed by YAML unmarshal.
func applyDefaultsPost(cfg *Config) {
	if cfg.ScanInterval <= 0 {
		cfg.ScanInterval = 300
	}
	if cfg.UpdateCheckInterval <= 0 {
		cfg.UpdateCheckInterval = 3600
	}
	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}
	if cfg.LogFile == "" {
		cfg.LogFile = defaultLogFile()
	}
	if cfg.QueueDir == "" {
		cfg.QueueDir = defaultQueueDir()
	}
	if cfg.Tags == nil {
		cfg.Tags = make(map[string]string)
	}
}

// applyEnvOverrides overwrites config fields from environment variables.
func applyEnvOverrides(cfg *Config) {
	if v := os.Getenv("IDMART_SERVER_URL"); v != "" {
		cfg.ServerURL = v
	}
	if v := os.Getenv("IDMART_API_TOKEN"); v != "" {
		cfg.APIToken = v
	}
	if v := os.Getenv("IDMART_DEVICE_ID"); v != "" {
		cfg.DeviceID = v
	}
}

// ensureDeviceID generates a stable device ID if one is not already configured,
// then persists it back to the config file so it remains consistent across restarts.
func ensureDeviceID(cfg *Config) error {
	if cfg.DeviceID != "" {
		return nil
	}
	id, err := generateDeviceID()
	if err != nil {
		return fmt.Errorf("config: could not generate device ID: %w", err)
	}
	cfg.DeviceID = id

	// Attempt to persist the generated ID back to the config file.
	if cfg.configPath != "" {
		_ = saveDeviceID(cfg)
	}
	return nil
}

// generateDeviceID creates a stable identifier from hostname + first MAC address.
func generateDeviceID() (string, error) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	mac := firstMACAddress()
	raw := hostname + ":" + mac
	sum := sha256.Sum256([]byte(raw))
	// Format as a UUID-like string using the first 16 bytes.
	b := sum[:16]
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant bits
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}

// firstMACAddress returns the first non-loopback hardware MAC address found.
func firstMACAddress() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "00:00:00:00:00:00"
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if len(iface.HardwareAddr) == 0 {
			continue
		}
		return iface.HardwareAddr.String()
	}
	return "00:00:00:00:00:00"
}

// saveDeviceID updates the device_id field in the existing config file.
func saveDeviceID(cfg *Config) error {
	data, err := os.ReadFile(cfg.configPath)
	if err != nil {
		return err
	}
	lines := strings.Split(string(data), "\n")
	found := false
	for i, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "device_id:") {
			lines[i] = fmt.Sprintf("device_id: %q", cfg.DeviceID)
			found = true
			break
		}
	}
	if !found {
		lines = append(lines, fmt.Sprintf("device_id: %q", cfg.DeviceID))
	}
	return os.WriteFile(cfg.configPath, []byte(strings.Join(lines, "\n")), 0600)
}

// defaultLogFile returns the platform-appropriate default log file path.
func defaultLogFile() string {
	switch runtime.GOOS {
	case "darwin":
		return "/Library/Logs/IDMatr/agent.log"
	case "windows":
		pd := os.Getenv("ProgramData")
		if pd == "" {
			pd = `C:\ProgramData`
		}
		return filepath.Join(pd, "IDMatr", "logs", "agent.log")
	default:
		return "/var/log/idmart/agent.log"
	}
}

// defaultQueueDir returns the platform-appropriate default queue directory.
func defaultQueueDir() string {
	switch runtime.GOOS {
	case "darwin":
		return "/Library/IDMatr/queue"
	case "windows":
		pd := os.Getenv("ProgramData")
		if pd == "" {
			pd = `C:\ProgramData`
		}
		return filepath.Join(pd, "IDMatr", "queue")
	default:
		return "/var/lib/idmart/queue"
	}
}

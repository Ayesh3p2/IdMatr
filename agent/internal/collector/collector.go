package collector

import (
	"log"
	"runtime"
	"time"

	"github.com/idmart/agent/internal/config"
	"github.com/idmart/agent/internal/discovery"
	"github.com/idmart/agent/internal/types"
)

// Collector orchestrates all platform-specific data collection and hands the
// resulting TelemetryEvent to the provided send function.
type Collector struct {
	cfg    *config.Config
	logger *log.Logger
	send   func(types.TelemetryEvent) error
}

// New creates a Collector that calls sendFn for each collected event.
func New(cfg *config.Config, logger *log.Logger, sendFn func(types.TelemetryEvent) error) *Collector {
	return &Collector{
		cfg:    cfg,
		logger: logger,
		send:   sendFn,
	}
}

// Run starts the collection loop. It performs an immediate collection on
// startup, then repeats every ScanInterval seconds until quit is closed.
func (c *Collector) Run(quit <-chan struct{}) {
	c.logger.Printf("collector: starting (interval=%ds)", c.cfg.ScanInterval)

	// Initial collection on startup.
	c.collect()

	ticker := time.NewTicker(time.Duration(c.cfg.ScanInterval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.collect()
		case <-quit:
			c.logger.Println("collector: stopping")
			return
		}
	}
}

// collect gathers all telemetry and sends it via the configured send function.
func (c *Collector) collect() {
	c.logger.Println("collector: running full scan")

	event := types.TelemetryEvent{
		DeviceID:     c.cfg.DeviceID,
		AgentVersion: AgentVersion,
		Timestamp:    time.Now().UTC(),
	}

	// --- Device info ---
	devCollector := NewDeviceCollector()
	if info, err := devCollector.Collect(); err != nil {
		c.logger.Printf("collector: device info error: %v", err)
	} else {
		info.DeviceID = c.cfg.DeviceID
		info.Architecture = runtime.GOARCH
		event.Device = *info
	}

	// --- Current user / privileges ---
	privDetector := discovery.NewPrivilegeDetector()
	if privInfo, err := privDetector.Detect(); err != nil {
		c.logger.Printf("collector: privilege detection error: %v", err)
	} else {
		event.Privileges = *privInfo
	}

	if userInfo, err := discovery.GetCurrentUser(); err != nil {
		c.logger.Printf("collector: user info error: %v", err)
	} else {
		userInfo.IsAdmin = event.Privileges.IsAdmin
		event.User = userInfo
	}

	// --- Installed applications ---
	appDisc := discovery.NewAppDiscovery()
	if apps, err := appDisc.Discover(); err != nil {
		c.logger.Printf("collector: app discovery error: %v", err)
	} else {
		event.Applications = apps
	}

	// --- Running processes ---
	procCollector := NewProcessCollector()
	if procs, err := procCollector.Collect(); err != nil {
		c.logger.Printf("collector: process collection error: %v", err)
	} else {
		event.Processes = procs
	}

	// --- SaaS domains ---
	if saas, err := discovery.DiscoverSaaS(c.logger); err != nil {
		c.logger.Printf("collector: SaaS discovery error: %v", err)
	} else {
		event.SaaSDomains = saas
	}

	// --- Security posture ---
	postureCollector := NewPostureCollector()
	if posture, err := postureCollector.Collect(); err != nil {
		c.logger.Printf("collector: security posture error: %v", err)
	} else {
		event.Security = posture
	}

	// --- Network connections ---
	if conns, err := collectNetworkConnections(c.logger); err != nil {
		c.logger.Printf("collector: network connections error: %v", err)
	} else {
		event.NetworkConns = conns
	}

	// --- Send ---
	if err := c.send(event); err != nil {
		c.logger.Printf("collector: send error: %v", err)
	} else {
		c.logger.Printf("collector: scan complete (apps=%d procs=%d saas=%d)",
			len(event.Applications), len(event.Processes), len(event.SaaSDomains))
	}
}

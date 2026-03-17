package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/kardianos/service"

	"github.com/idmart/agent/internal/collector"
	"github.com/idmart/agent/internal/config"
	applogger "github.com/idmart/agent/internal/logger"
	"github.com/idmart/agent/internal/transport"
	"github.com/idmart/agent/internal/types"
	"github.com/idmart/agent/internal/update"
)

// Version is injected at build time via -ldflags "-X main.Version=x.y.z"
var Version = "dev"

func init() {
	// Propagate Version into the types and collector packages.
	types.AgentVersion = Version
	collector.AgentVersion = Version
}

// agentService implements kardianos/service.Interface.
type agentService struct {
	cfg    *config.Config
	logger *applogger.Logger
	quit   chan struct{}
}

func (a *agentService) Start(s service.Service) error {
	a.logger.Info("agent: starting", "version", Version, "os", runtime.GOOS)
	a.quit = make(chan struct{})
	go a.run()
	return nil
}

func (a *agentService) Stop(s service.Service) error {
	a.logger.Info("agent: stopping")
	if a.quit != nil {
		close(a.quit)
	}
	return nil
}

// run is the main goroutine started by Start().
func (a *agentService) run() {
	cfg := a.cfg
	appLog := a.logger

	// --- Transport ---
	client := transport.NewClient(cfg, appLog.StdLogger())

	// --- Offline queue ---
	q := transport.NewQueue(cfg.QueueDir, appLog.StdLogger())

	// Drain any events queued during previous offline period.
	if err := q.DrainTo(client); err != nil {
		appLog.Warn("agent: queue drain error", "err", err)
	}

	// --- Register device ---
	if err := registerDevice(cfg, client, appLog); err != nil {
		appLog.Warn("agent: registration failed (will retry later)", "err", err)
	}

	// --- Collector ---
	sendFn := func(event types.TelemetryEvent) error {
		err := client.SendEvents([]types.TelemetryEvent{event})
		if err != nil {
			appLog.Warn("agent: send failed, queuing event", "err", err)
			return q.Enqueue(event)
		}
		return nil
	}

	c := collector.New(cfg, appLog.StdLogger(), sendFn)

	// --- Auto-updater ---
	updater := update.New(cfg, client, appLog.StdLogger())
	go runUpdateLoop(updater, cfg, appLog, a.quit)

	// Run collection loop (blocks until quit is closed).
	c.Run(a.quit)

	appLog.Info("agent: shutdown complete")
}

// registerDevice sends a registration request to the server.
func registerDevice(cfg *config.Config, client *transport.Client, appLog *applogger.Logger) error {
	devCollector := collector.NewDeviceCollector()
	devInfo, err := devCollector.Collect()
	if err != nil {
		devInfo = &types.DeviceInfo{}
	}

	req := transport.RegistrationRequest{
		DeviceID:     cfg.DeviceID,
		Hostname:     devInfo.Hostname,
		OS:           runtime.GOOS,
		OSVersion:    devInfo.OSVersion,
		AgentVersion: Version,
		Tags:         cfg.Tags,
	}
	resp, err := client.Register(req)
	if err != nil {
		return err
	}
	if !resp.Accepted {
		return fmt.Errorf("registration rejected: %s", resp.Message)
	}
	appLog.Info("agent: registered with server", "device_id", resp.DeviceID)
	return nil
}

// runUpdateLoop checks for updates every UpdateCheckInterval seconds.
func runUpdateLoop(updater *update.Updater, cfg *config.Config, appLog *applogger.Logger, quit <-chan struct{}) {
	if cfg.UpdateCheckInterval <= 0 {
		return
	}
	ticker := time.NewTicker(time.Duration(cfg.UpdateCheckInterval) * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if err := updater.CheckAndUpdate(Version); err != nil {
				appLog.Warn("agent: update check failed", "err", err)
			}
		case <-quit:
			return
		}
	}
}

func main() {
	var (
		cfgFile   = flag.String("config", "", "Path to agent.yaml config file")
		showVer   = flag.Bool("version", false, "Print version and exit")
		svcAction = flag.String("service", "", "Service action: install|uninstall|start|stop|status")
	)
	// Support positional subcommands: agent version, agent install, etc.
	if len(os.Args) > 1 && !strings.HasPrefix(os.Args[1], "-") {
		switch os.Args[1] {
		case "version":
			fmt.Printf("IDMatr Agent version %s (%s/%s)\n", Version, runtime.GOOS, runtime.GOARCH)
			os.Exit(0)
		case "install":
			os.Args = append([]string{os.Args[0], "-service", "install"}, os.Args[2:]...)
		case "uninstall":
			os.Args = append([]string{os.Args[0], "-service", "uninstall"}, os.Args[2:]...)
		case "start":
			os.Args = append([]string{os.Args[0], "-service", "start"}, os.Args[2:]...)
		case "stop":
			os.Args = append([]string{os.Args[0], "-service", "stop"}, os.Args[2:]...)
		case "status":
			os.Args = append([]string{os.Args[0], "-service", "status"}, os.Args[2:]...)
		case "run":
			// drop the subcommand, continue to service runner
			os.Args = append([]string{os.Args[0]}, os.Args[2:]...)
		default:
			fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", os.Args[1])
			fmt.Fprintln(os.Stderr, "Usage: idmart-agent <command> [flags]")
			fmt.Fprintln(os.Stderr, "Commands: install  uninstall  start  stop  status  run  version")
			os.Exit(1)
		}
	}

	flag.Parse()

	if *showVer {
		fmt.Printf("IDMatr Agent version %s (%s/%s)\n", Version, runtime.GOOS, runtime.GOARCH)
		os.Exit(0)
	}

	// Load configuration.
	var cfg *config.Config
	var err error
	if *cfgFile != "" {
		cfg, err = config.LoadFromFile(*cfgFile)
	} else {
		cfg, err = config.Load()
	}
	if err != nil {
		log.Fatalf("agent: failed to load config: %v", err)
	}

	// Initialise logger.
	appLog, err := applogger.New(cfg.LogFile, cfg.LogLevel)
	if err != nil {
		log.Fatalf("agent: failed to initialise logger: %v", err)
	}
	defer appLog.Close()

	// kardianos/service configuration.
	svcConfig := &service.Config{
		Name:        "IDMatrAgent",
		DisplayName: "IDMatr Identity Agent",
		Description: "IDMatr cross-platform identity and SaaS discovery agent.",
		Arguments:   []string{},
	}
	if *cfgFile != "" {
		svcConfig.Arguments = []string{"-config", *cfgFile}
	}

	svc := &agentService{cfg: cfg, logger: appLog}
	s, err := service.New(svc, svcConfig)
	if err != nil {
		log.Fatalf("agent: service init error: %v", err)
	}

	// Suppress default service logger output.
	_ = s

	// Handle service sub-commands.
	action := *svcAction
	if action == "" && flag.NArg() > 0 {
		action = flag.Arg(0)
	}

	if action != "" {
		switch action {
		case "install":
			if err := s.Install(); err != nil {
				log.Fatalf("agent: install failed: %v", err)
			}
			fmt.Println("Service installed successfully.")
		case "uninstall":
			if err := s.Uninstall(); err != nil {
				log.Fatalf("agent: uninstall failed: %v", err)
			}
			fmt.Println("Service uninstalled successfully.")
		case "start":
			if err := s.Start(); err != nil {
				log.Fatalf("agent: start failed: %v", err)
			}
			fmt.Println("Service started.")
		case "stop":
			if err := s.Stop(); err != nil {
				log.Fatalf("agent: stop failed: %v", err)
			}
			fmt.Println("Service stopped.")
		case "status":
			st, err := s.Status()
			if err != nil {
				log.Fatalf("agent: status error: %v", err)
			}
			statusStr := map[service.Status]string{
				service.StatusRunning: "running",
				service.StatusStopped: "stopped",
				service.StatusUnknown: "unknown",
			}[st]
			fmt.Printf("Service status: %s\n", statusStr)
		case "run":
			runInteractive(svc, appLog)
		default:
			log.Fatalf("unknown service action %q (use install|uninstall|start|stop|status|run)", action)
		}
		return
	}

	// If running interactively (not as a managed service daemon), run directly.
	if service.Interactive() {
		runInteractive(svc, appLog)
		return
	}

	// Run as a managed service (launchd / systemd / Windows SCM).
	if err := s.Run(); err != nil {
		appLog.Error("agent: service run error", "err", err)
		os.Exit(1)
	}
}

// runInteractive starts the agent in the foreground with SIGTERM/SIGINT handling.
func runInteractive(svc *agentService, appLog *applogger.Logger) {
	quit := make(chan struct{})
	svc.quit = quit

	go svc.run()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	sig := <-sigCh
	appLog.Info("agent: received signal, shutting down", "signal", sig)
	close(quit)

	// Give goroutines a moment to finish cleanly.
	time.Sleep(2 * time.Second)
}

package collector

// ProcessCollector collects information about running processes.
type ProcessCollector interface {
	Collect() ([]ProcessInfo, error)
}

// NewProcessCollector returns a platform-specific ProcessCollector.
// The actual implementation is provided by process_darwin.go,
// process_linux.go, or process_windows.go.
func NewProcessCollector() ProcessCollector {
	return newProcessCollector()
}

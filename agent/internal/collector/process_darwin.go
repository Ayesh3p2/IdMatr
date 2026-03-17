//go:build darwin

package collector

import (
	"os/exec"
	"strconv"
	"strings"
)

type darwinProcessCollector struct{}

func newProcessCollector() ProcessCollector {
	return &darwinProcessCollector{}
}

// Collect parses `ps -eo pid,user,pcpu,rss,comm` output on macOS.
// Fields: PID USER %CPU RSS COMMAND
func (d *darwinProcessCollector) Collect() ([]ProcessInfo, error) {
	out, err := exec.Command("ps", "-eo", "pid,user,pcpu,rss,comm").Output()
	if err != nil {
		return nil, err
	}

	var procs []ProcessInfo
	lines := strings.Split(string(out), "\n")
	for i, line := range lines {
		if i == 0 { // skip header
			continue
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}

		pid, err := strconv.Atoi(fields[0])
		if err != nil {
			continue
		}
		cpuPct, _ := strconv.ParseFloat(fields[2], 64)
		rssKB, _ := strconv.ParseUint(fields[3], 10, 64)

		// Remaining fields form the command path.
		commPath := strings.Join(fields[4:], " ")
		name := commPath
		// Extract just the binary name from the path.
		if idx := strings.LastIndex(commPath, "/"); idx >= 0 {
			name = commPath[idx+1:]
		}

		procs = append(procs, ProcessInfo{
			PID:         pid,
			Name:        name,
			Path:        commPath,
			User:        fields[1],
			CPUPercent:  cpuPct,
			MemoryBytes: rssKB * 1024, // RSS is in KB on macOS
		})
	}
	return procs, nil
}

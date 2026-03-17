//go:build linux

package collector

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type linuxProcessCollector struct{}

func newProcessCollector() ProcessCollector {
	return &linuxProcessCollector{}
}

// Collect enumerates /proc/*/status and /proc/*/stat on Linux.
func (d *linuxProcessCollector) Collect() ([]ProcessInfo, error) {
	entries, err := filepath.Glob("/proc/[0-9]*/status")
	if err != nil {
		return nil, err
	}

	var procs []ProcessInfo
	for _, statusPath := range entries {
		// Extract PID from path.
		parts := strings.Split(statusPath, "/")
		if len(parts) < 3 {
			continue
		}
		pid, err := strconv.Atoi(parts[2])
		if err != nil {
			continue
		}

		info := ProcessInfo{PID: pid}

		// Parse /proc/<pid>/status for Name, VmRSS, and Uid.
		data, err := os.ReadFile(statusPath)
		if err != nil {
			continue
		}
		var uid string
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "Name:\t") {
				info.Name = strings.TrimPrefix(line, "Name:\t")
			} else if strings.HasPrefix(line, "VmRSS:\t") {
				val := strings.TrimPrefix(line, "VmRSS:\t")
				val = strings.TrimSuffix(strings.TrimSpace(val), " kB")
				if kb, err := strconv.ParseUint(strings.TrimSpace(val), 10, 64); err == nil {
					info.MemoryBytes = kb * 1024
				}
			} else if strings.HasPrefix(line, "Uid:\t") {
				fields := strings.Fields(strings.TrimPrefix(line, "Uid:\t"))
				if len(fields) > 0 {
					uid = fields[0]
				}
			}
		}

		// Resolve UID to username via /etc/passwd (best-effort).
		if uid != "" {
			info.User = resolveUID(uid)
		}

		// Read full command from /proc/<pid>/cmdline.
		cmdlinePath := filepath.Join("/proc", strconv.Itoa(pid), "cmdline")
		if cmdData, err := os.ReadFile(cmdlinePath); err == nil && len(cmdData) > 0 {
			// cmdline args are NUL-separated.
			cmdline := strings.ReplaceAll(string(cmdData), "\x00", " ")
			info.Path = strings.TrimSpace(cmdline)
		}

		// Parse CPU time from /proc/<pid>/stat (fields 14+15 = utime+stime in jiffies).
		statPath := filepath.Join("/proc", strconv.Itoa(pid), "stat")
		if statData, err := os.ReadFile(statPath); err == nil {
			fields := strings.Fields(string(statData))
			if len(fields) > 15 {
				utime, _ := strconv.ParseFloat(fields[13], 64)
				stime, _ := strconv.ParseFloat(fields[14], 64)
				// Normalise to a rough percentage (not real-time accurate without sampling).
				info.CPUPercent = (utime + stime) / 100.0
			}
		}

		procs = append(procs, info)
	}
	return procs, nil
}

// resolveUID looks up a UID string in /etc/passwd and returns the username.
func resolveUID(uid string) string {
	data, err := os.ReadFile("/etc/passwd")
	if err != nil {
		return uid
	}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Split(line, ":")
		if len(fields) >= 3 && fields[2] == uid {
			return fields[0]
		}
	}
	return uid
}

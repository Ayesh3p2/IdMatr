package collector

import (
	"log"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// collectNetworkConnections parses active TCP/UDP connections using platform
// tools and returns a slice of ConnInfo.
func collectNetworkConnections(logger *log.Logger) ([]ConnInfo, error) {
	switch runtime.GOOS {
	case "darwin", "linux":
		return collectNetstatUnix(logger)
	case "windows":
		return collectNetstatWindows(logger)
	default:
		return collectNetstatUnix(logger)
	}
}

// collectNetstatUnix runs `netstat -tnp` (Linux) or `netstat -tnv` (macOS)
// and parses the output.
func collectNetstatUnix(logger *log.Logger) ([]ConnInfo, error) {
	var args []string
	if runtime.GOOS == "darwin" {
		args = []string{"-tn"}
	} else {
		args = []string{"-tnp"}
	}

	out, err := exec.Command("netstat", args...).Output()
	if err != nil {
		// netstat may not be installed; silently return empty.
		return nil, nil
	}

	var conns []ConnInfo
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "tcp") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		conn := ConnInfo{
			Protocol:   fields[0],
			LocalAddr:  fields[3],
			RemoteAddr: fields[4],
		}
		// State is the 6th field on Linux (with -tnp), 5th on macOS (-tn).
		if len(fields) >= 6 {
			conn.State = fields[5]
		}
		// On Linux the last field may be pid/programname.
		if runtime.GOOS == "linux" && len(fields) >= 7 {
			parts := strings.SplitN(fields[6], "/", 2)
			if len(parts) == 2 {
				if pid, err := strconv.Atoi(parts[0]); err == nil {
					conn.PID = pid
				}
				conn.ProcessName = parts[1]
			}
		}
		conns = append(conns, conn)
	}
	return conns, nil
}

// collectNetstatWindows uses `netstat -ano` on Windows.
func collectNetstatWindows(logger *log.Logger) ([]ConnInfo, error) {
	out, err := exec.Command("netstat", "-ano").Output()
	if err != nil {
		return nil, nil
	}

	var conns []ConnInfo
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "TCP") && !strings.HasPrefix(line, "UDP") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		conn := ConnInfo{
			Protocol:   strings.ToLower(fields[0]),
			LocalAddr:  fields[1],
			RemoteAddr: fields[2],
		}
		if len(fields) >= 4 {
			if pid, err := strconv.Atoi(fields[len(fields)-1]); err == nil {
				conn.PID = pid
			}
		}
		if len(fields) == 5 {
			conn.State = fields[3]
		}
		conns = append(conns, conn)
	}
	return conns, nil
}

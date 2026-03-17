//go:build windows

package collector

import (
	"encoding/csv"
	"os/exec"
	"strconv"
	"strings"
)

type windowsProcessCollector struct{}

func newProcessCollector() ProcessCollector {
	return &windowsProcessCollector{}
}

// Collect parses `tasklist /FO CSV /NH` output on Windows.
// CSV columns: "Image Name","PID","Session Name","Session#","Mem Usage"
func (d *windowsProcessCollector) Collect() ([]ProcessInfo, error) {
	out, err := exec.Command("tasklist", "/FO", "CSV", "/NH").Output()
	if err != nil {
		return nil, err
	}

	r := csv.NewReader(strings.NewReader(string(out)))
	records, err := r.ReadAll()
	if err != nil {
		return nil, err
	}

	var procs []ProcessInfo
	for _, record := range records {
		if len(record) < 5 {
			continue
		}
		imageName := record[0]
		pidStr := record[1]
		memStr := record[4]

		pid, err := strconv.Atoi(pidStr)
		if err != nil {
			continue
		}

		// Memory is like "  4,096 K" — strip non-numeric chars and convert.
		memCleaned := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, memStr)
		var memBytes uint64
		if kb, err := strconv.ParseUint(memCleaned, 10, 64); err == nil {
			memBytes = kb * 1024
		}

		name := strings.TrimSuffix(imageName, ".exe")

		procs = append(procs, ProcessInfo{
			PID:         pid,
			Name:        name,
			Path:        imageName,
			MemoryBytes: memBytes,
		})
	}
	return procs, nil
}

//go:build linux

package discovery

import (
	"os/exec"
	"strings"

	"github.com/idmart/agent/internal/types"
)

type linuxAppDiscovery struct{}

func newAppDiscovery() AppDiscovery {
	return &linuxAppDiscovery{}
}

func (d *linuxAppDiscovery) Discover() ([]types.AppInfo, error) {
	apps, err := discoverDpkg()
	if err == nil && len(apps) > 0 {
		return apps, nil
	}
	return discoverRpm()
}

func discoverDpkg() ([]types.AppInfo, error) {
	out, err := exec.Command("dpkg-query", "-W",
		"-f=${Package}\t${Version}\t${Status}\t${Maintainer}\t${Installed-Size}\n").Output()
	if err != nil {
		return nil, err
	}

	var apps []types.AppInfo
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Split(line, "\t")
		if len(fields) < 3 {
			continue
		}
		if !strings.Contains(fields[2], "install ok installed") {
			continue
		}
		app := types.AppInfo{
			Name:    fields[0],
			Version: fields[1],
			Source:  "dpkg",
		}
		if len(fields) > 3 {
			app.Publisher = fields[3]
		}
		apps = append(apps, app)
	}
	return apps, nil
}

func discoverRpm() ([]types.AppInfo, error) {
	out, err := exec.Command("rpm", "-qa",
		"--queryformat", "%{NAME}\t%{VERSION}\t%{VENDOR}\t%{INSTALLTIME:date}\n").Output()
	if err != nil {
		return nil, err
	}

	var apps []types.AppInfo
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Split(line, "\t")
		if len(fields) < 2 {
			continue
		}
		app := types.AppInfo{
			Name:    fields[0],
			Version: fields[1],
			Source:  "rpm",
		}
		if len(fields) > 2 {
			app.Publisher = fields[2]
		}
		if len(fields) > 3 {
			app.InstallDate = fields[3]
		}
		apps = append(apps, app)
	}
	return apps, nil
}

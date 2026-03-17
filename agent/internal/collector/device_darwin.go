//go:build darwin

package collector

import (
	"net"
	"os"
	"os/exec"
	"strings"
)

type darwinDeviceCollector struct{}

func newDeviceCollector() DeviceCollector {
	return &darwinDeviceCollector{}
}

func (d *darwinDeviceCollector) Collect() (*DeviceInfo, error) {
	info := &DeviceInfo{
		OS: "macOS",
	}

	// Hostname
	if h, err := os.Hostname(); err == nil {
		info.Hostname = h
	}

	// OS version
	if out, err := exec.Command("sw_vers", "-productVersion").Output(); err == nil {
		info.OSVersion = strings.TrimSpace(string(out))
	}

	// Hardware model (e.g. "MacBookPro18,3")
	if out, err := exec.Command("sysctl", "-n", "hw.model").Output(); err == nil {
		info.HardwareModel = strings.TrimSpace(string(out))
	}

	// Serial number via system_profiler
	if out, err := exec.Command("system_profiler", "SPHardwareDataType").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			if strings.Contains(line, "Serial Number") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					info.SerialNumber = strings.TrimSpace(parts[1])
				}
				break
			}
		}
	}

	// Network interfaces
	info.IPAddresses, info.MACAddress = collectNetworkInterfaces()

	return info, nil
}

// collectNetworkInterfaces enumerates non-loopback network interfaces and
// returns a list of IP addresses plus the first MAC address found.
func collectNetworkInterfaces() ([]string, string) {
	var ips []string
	var mac string

	ifaces, err := net.Interfaces()
	if err != nil {
		return ips, mac
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if mac == "" && len(iface.HardwareAddr) > 0 {
			mac = iface.HardwareAddr.String()
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			switch v := addr.(type) {
			case *net.IPNet:
				if !v.IP.IsLoopback() {
					ips = append(ips, v.IP.String())
				}
			case *net.IPAddr:
				if !v.IP.IsLoopback() {
					ips = append(ips, v.IP.String())
				}
			}
		}
	}
	return ips, mac
}

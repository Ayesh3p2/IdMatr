//go:build windows

package collector

import (
	"net"
	"os"
	"os/exec"
	"strings"
)

type windowsDeviceCollector struct{}

func newDeviceCollector() DeviceCollector {
	return &windowsDeviceCollector{}
}

func (d *windowsDeviceCollector) Collect() (*DeviceInfo, error) {
	info := &DeviceInfo{
		OS: "Windows",
	}

	// Hostname
	if h, err := os.Hostname(); err == nil {
		info.Hostname = h
	}

	// OS version + caption via wmic
	if out, err := exec.Command("wmic", "os", "get", "Caption,Version", "/value").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "Caption=") {
				info.OSVersion = strings.TrimPrefix(line, "Caption=")
			}
		}
	}

	// Hardware model
	if out, err := exec.Command("wmic", "computersystem", "get", "Model", "/value").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "Model=") {
				info.HardwareModel = strings.TrimPrefix(line, "Model=")
			}
		}
	}

	// Serial number via BIOS
	if out, err := exec.Command("wmic", "bios", "get", "SerialNumber", "/value").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "SerialNumber=") {
				info.SerialNumber = strings.TrimPrefix(line, "SerialNumber=")
			}
		}
	}

	info.IPAddresses, info.MACAddress = collectNetworkInterfaces()

	return info, nil
}

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

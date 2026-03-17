//go:build linux

package collector

import (
	"bufio"
	"net"
	"os"
	"strings"
)

type linuxDeviceCollector struct{}

func newDeviceCollector() DeviceCollector {
	return &linuxDeviceCollector{}
}

func (d *linuxDeviceCollector) Collect() (*DeviceInfo, error) {
	info := &DeviceInfo{
		OS: "Linux",
	}

	// Hostname
	if h, err := os.Hostname(); err == nil {
		info.Hostname = h
	}

	// OS version from /etc/os-release
	if f, err := os.Open("/etc/os-release"); err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "PRETTY_NAME=") {
				val := strings.TrimPrefix(line, "PRETTY_NAME=")
				info.OSVersion = strings.Trim(val, `"`)
			}
		}
	}

	// Hardware model
	if data, err := os.ReadFile("/sys/class/dmi/id/product_name"); err == nil {
		info.HardwareModel = strings.TrimSpace(string(data))
	}

	// Serial number
	if data, err := os.ReadFile("/sys/class/dmi/id/product_serial"); err == nil {
		info.SerialNumber = strings.TrimSpace(string(data))
	}

	// Network interfaces
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

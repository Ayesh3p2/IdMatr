package collector

// DeviceCollector collects information about the host device.
type DeviceCollector interface {
	Collect() (*DeviceInfo, error)
}

// NewDeviceCollector returns a platform-specific DeviceCollector.
// The actual implementation is provided by device_darwin.go,
// device_linux.go, or device_windows.go.
func NewDeviceCollector() DeviceCollector {
	return newDeviceCollector()
}

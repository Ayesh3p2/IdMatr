package collector

// PostureCollector checks device security posture.
type PostureCollector interface {
	Collect() (SecurityPosture, error)
}

// NewPostureCollector returns a platform-specific PostureCollector.
// The actual implementation is provided by security_posture_darwin.go,
// security_posture_linux.go, or security_posture_windows.go.
func NewPostureCollector() PostureCollector {
	return newPostureCollector()
}

package discovery

import "github.com/idmart/agent/internal/types"

// AppDiscovery discovers installed applications on the host.
type AppDiscovery interface {
	Discover() ([]types.AppInfo, error)
}

// NewAppDiscovery returns a platform-specific AppDiscovery implementation.
func NewAppDiscovery() AppDiscovery {
	return newAppDiscovery()
}

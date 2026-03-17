package discovery

import (
	"fmt"
	"os/user"
	"runtime"

	"github.com/idmart/agent/internal/types"
)

// PrivilegeDetector detects the privilege level of the current user.
type PrivilegeDetector interface {
	Detect() (*types.PrivilegeInfo, error)
}

// NewPrivilegeDetector returns a platform-specific PrivilegeDetector.
func NewPrivilegeDetector() PrivilegeDetector {
	return newPrivilegeDetector()
}

// GetCurrentUser returns basic information about the currently running user.
func GetCurrentUser() (types.UserInfo, error) {
	u, err := user.Current()
	if err != nil {
		return types.UserInfo{}, fmt.Errorf("discovery: get current user: %w", err)
	}

	info := types.UserInfo{
		Username:    u.Username,
		DisplayName: u.Name,
		HomeDir:     u.HomeDir,
	}

	if runtime.GOOS != "windows" {
		info.Shell = lookupShell(u.Username)
	}

	return info, nil
}

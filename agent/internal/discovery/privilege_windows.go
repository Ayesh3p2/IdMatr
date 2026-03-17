//go:build windows

package discovery

import (
	"os/exec"
	"os/user"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"

	"github.com/idmart/agent/internal/types"
)

type windowsPrivilegeDetector struct{}

func newPrivilegeDetector() PrivilegeDetector {
	return &windowsPrivilegeDetector{}
}

func (d *windowsPrivilegeDetector) Detect() (*types.PrivilegeInfo, error) {
	info := &types.PrivilegeInfo{}

	info.IsAdmin = isProcessElevated()
	info.ElevatedProcess = info.IsAdmin

	u, err := user.Current()
	if err == nil {
		username := u.Username
		if idx := strings.LastIndex(username, "\\"); idx >= 0 {
			username = username[idx+1:]
		}

		admins := listLocalAdmins()
		for _, a := range admins {
			if strings.EqualFold(a, username) {
				info.IsAdmin = true
				info.AdminGroups = append(info.AdminGroups, "Administrators")
				break
			}
		}
	}

	return info, nil
}

// tokenElevation mirrors the TOKEN_ELEVATION structure from the Windows SDK.
// golang.org/x/sys/windows does not always export this struct by name, so we
// define it ourselves.
type tokenElevation struct {
	TokenIsElevated uint32
}

func isProcessElevated() bool {
	token := windows.Token(0)
	if err := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_QUERY, &token); err != nil {
		return false
	}
	defer token.Close()

	var elev tokenElevation
	var retLen uint32
	err := windows.GetTokenInformation(
		token,
		windows.TokenElevation,
		(*byte)(unsafe.Pointer(&elev)),
		uint32(unsafe.Sizeof(elev)),
		&retLen,
	)
	if err != nil {
		return false
	}
	return elev.TokenIsElevated != 0
}

func listLocalAdmins() []string {
	out, err := exec.Command("net", "localgroup", "Administrators").Output()
	if err != nil {
		return nil
	}

	var members []string
	lines := strings.Split(string(out), "\n")
	inSection := false
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "---") {
			inSection = true
			continue
		}
		if inSection {
			if line == "" || strings.HasPrefix(line, "The command") {
				break
			}
			members = append(members, line)
		}
	}
	return members
}

func lookupShell(_ string) string {
	return ""
}

func contains(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

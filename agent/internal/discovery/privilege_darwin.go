//go:build darwin

package discovery

import (
	"bufio"
	"os"
	"os/exec"
	"os/user"
	"strings"

	"github.com/idmart/agent/internal/types"
)

type darwinPrivilegeDetector struct{}

func newPrivilegeDetector() PrivilegeDetector {
	return &darwinPrivilegeDetector{}
}

func (d *darwinPrivilegeDetector) Detect() (*types.PrivilegeInfo, error) {
	info := &types.PrivilegeInfo{}

	u, err := user.Current()
	if err != nil {
		return info, nil
	}
	username := u.Username
	if idx := strings.LastIndex(username, "\\"); idx >= 0 {
		username = username[idx+1:]
	}

	var adminGroups []string

	if out, err := exec.Command("dscl", ".", "-read", "/Groups/admin", "GroupMembership").Output(); err == nil {
		line := strings.TrimSpace(string(out))
		if strings.Contains(line, username) {
			info.IsAdmin = true
			adminGroups = append(adminGroups, "admin")
		}
	}

	if out, err := exec.Command("id", "-Gn", username).Output(); err == nil {
		groups := strings.Fields(strings.TrimSpace(string(out)))
		for _, g := range groups {
			if g == "admin" || g == "wheel" || g == "sudo" {
				info.IsAdmin = true
				if !contains(adminGroups, g) {
					adminGroups = append(adminGroups, g)
				}
			}
		}
	}

	if isSudoer(username) {
		info.IsSudoer = true
	}

	info.AdminGroups = adminGroups
	return info, nil
}

func isSudoer(username string) bool {
	paths := []string{"/etc/sudoers"}
	if entries, err := os.ReadDir("/etc/sudoers.d"); err == nil {
		for _, e := range entries {
			paths = append(paths, "/etc/sudoers.d/"+e.Name())
		}
	}
	for _, p := range paths {
		f, err := os.Open(p)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "#") {
				continue
			}
			if strings.HasPrefix(line, username+" ") || strings.HasPrefix(line, username+"\t") {
				f.Close()
				return true
			}
		}
		f.Close()
	}
	return false
}

func lookupShell(username string) string {
	f, err := os.Open("/etc/passwd")
	if err != nil {
		return ""
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Split(scanner.Text(), ":")
		if len(fields) >= 7 && fields[0] == username {
			return fields[6]
		}
	}
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

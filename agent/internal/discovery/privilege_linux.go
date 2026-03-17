//go:build linux

package discovery

import (
	"bufio"
	"os"
	"os/exec"
	"os/user"
	"strings"

	"github.com/idmart/agent/internal/types"
)

type linuxPrivilegeDetector struct{}

func newPrivilegeDetector() PrivilegeDetector {
	return &linuxPrivilegeDetector{}
}

func (d *linuxPrivilegeDetector) Detect() (*types.PrivilegeInfo, error) {
	info := &types.PrivilegeInfo{}

	u, err := user.Current()
	if err != nil {
		return info, nil
	}
	username := u.Username

	var adminGroups []string

	if f, err := os.Open("/etc/group"); err == nil {
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			fields := strings.Split(line, ":")
			if len(fields) < 4 {
				continue
			}
			groupName := fields[0]
			members := strings.Split(fields[3], ",")
			if groupName == "sudo" || groupName == "wheel" || groupName == "admin" {
				for _, m := range members {
					if strings.TrimSpace(m) == username {
						info.IsAdmin = true
						adminGroups = append(adminGroups, groupName)
					}
				}
			}
		}
		f.Close()
	}

	if out, err := exec.Command("id", "-Gn", username).Output(); err == nil {
		for _, g := range strings.Fields(strings.TrimSpace(string(out))) {
			if g == "sudo" || g == "wheel" || g == "admin" {
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

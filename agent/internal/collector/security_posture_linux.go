//go:build linux

package collector

import (
	"os/exec"
	"strings"
)

type linuxPostureCollector struct{}

func newPostureCollector() PostureCollector {
	return &linuxPostureCollector{}
}

func (d *linuxPostureCollector) Collect() (SecurityPosture, error) {
	posture := SecurityPosture{}

	// --- Firewall ---
	// Try ufw first, then iptables.
	posture.FirewallEnabled = checkUFW() || checkIPTables()

	// --- Disk Encryption (LUKS) ---
	if out, err := exec.Command("lsblk", "-o", "NAME,TYPE,FSTYPE").Output(); err == nil {
		posture.EncryptionEnabled = strings.Contains(string(out), "crypto_LUKS")
	}

	// --- Screen lock ---
	// Check gnome-screensaver, xscreensaver, or swayidle.
	posture.ScreenLockEnabled = checkScreenLock()

	// --- OS up-to-date ---
	// Check for pending security updates via apt or yum/dnf (non-interactive).
	posture.OSUpToDate = checkLinuxUpdates()

	// --- Antivirus (ClamAV) ---
	if _, err := exec.LookPath("clamscan"); err == nil {
		posture.AntivirusInstalled = true
	}
	if _, err := exec.LookPath("freshclam"); err == nil {
		posture.AntivirusInstalled = true
	}

	return posture, nil
}

func checkUFW() bool {
	out, err := exec.Command("ufw", "status").Output()
	if err != nil {
		return false
	}
	return strings.Contains(strings.ToLower(string(out)), "status: active")
}

func checkIPTables() bool {
	out, err := exec.Command("iptables", "-L", "-n").Output()
	if err != nil {
		return false
	}
	// If there are rules beyond the default ACCEPT policy, assume firewall is on.
	lines := strings.Split(string(out), "\n")
	ruleCount := 0
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Chain") || strings.HasPrefix(line, "target") {
			continue
		}
		ruleCount++
	}
	return ruleCount > 0
}

func checkScreenLock() bool {
	tools := []string{"gnome-screensaver", "xscreensaver", "xlock", "i3lock", "swayidle"}
	for _, tool := range tools {
		if _, err := exec.LookPath(tool); err == nil {
			return true
		}
	}
	return false
}

func checkLinuxUpdates() bool {
	// apt: if `apt-get -s upgrade` outputs 0 upgraded, treat as current.
	if out, err := exec.Command("apt-get", "-s", "upgrade").Output(); err == nil {
		return strings.Contains(string(out), "0 upgraded, 0 newly installed")
	}
	// dnf / yum: check-update exits 100 if updates are available, 0 if current.
	if err := exec.Command("dnf", "check-update", "-q").Run(); err == nil {
		return true
	}
	if err := exec.Command("yum", "check-update", "-q").Run(); err == nil {
		return true
	}
	return false
}

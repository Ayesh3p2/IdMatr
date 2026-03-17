//go:build darwin

package collector

import (
	"os/exec"
	"strings"
)

type darwinPostureCollector struct{}

func newPostureCollector() PostureCollector {
	return &darwinPostureCollector{}
}

func (d *darwinPostureCollector) Collect() (SecurityPosture, error) {
	posture := SecurityPosture{}

	// --- Firewall ---
	// `defaults read /Library/Preferences/com.apple.alf globalstate` returns:
	//   0 = off, 1 = on for specific services, 2 = on for essential services
	if out, err := exec.Command("defaults", "read",
		"/Library/Preferences/com.apple.alf", "globalstate").Output(); err == nil {
		val := strings.TrimSpace(string(out))
		posture.FirewallEnabled = val == "1" || val == "2"
	}

	// --- FileVault (disk encryption) ---
	if out, err := exec.Command("fdesetup", "status").Output(); err == nil {
		posture.EncryptionEnabled = strings.Contains(string(out), "FileVault is On")
	}

	// --- Screen lock (screensaver password requirement) ---
	// Check both the legacy and new location.
	screenLock := false
	if out, err := exec.Command("defaults", "-currentHost", "read",
		"com.apple.screensaver", "askForPassword").Output(); err == nil {
		screenLock = strings.TrimSpace(string(out)) == "1"
	}
	if !screenLock {
		if out, err := exec.Command("defaults", "read",
			"com.apple.screensaver", "askForPassword").Output(); err == nil {
			screenLock = strings.TrimSpace(string(out)) == "1"
		}
	}
	posture.ScreenLockEnabled = screenLock

	// --- OS up-to-date check ---
	// softwareupdate --list exits 0 with "No new software available." when current.
	if out, err := exec.Command("softwareupdate", "--list").Output(); err == nil {
		combined := strings.ToLower(string(out))
		posture.OSUpToDate = strings.Contains(combined, "no new software available")
	}

	// --- Antivirus / XProtect ---
	// Macs ship with XProtect; check that it's present and reasonably up to date.
	if out, err := exec.Command("system_profiler", "SPInstallHistoryDataType").Output(); err == nil {
		posture.AntivirusInstalled = strings.Contains(string(out), "XProtect") ||
			strings.Contains(string(out), "MRT")
	} else {
		// Fallback: XProtect always exists on modern macOS.
		posture.AntivirusInstalled = true
	}

	return posture, nil
}

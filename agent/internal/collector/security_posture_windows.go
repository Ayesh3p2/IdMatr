//go:build windows

package collector

import (
	"os/exec"
	"strings"

	"golang.org/x/sys/windows/registry"
)

type windowsPostureCollector struct{}

func newPostureCollector() PostureCollector {
	return &windowsPostureCollector{}
}

func (d *windowsPostureCollector) Collect() (SecurityPosture, error) {
	posture := SecurityPosture{}

	// --- Firewall ---
	// `netsh advfirewall show allprofiles state` lists Domain, Private, Public profiles.
	if out, err := exec.Command("netsh", "advfirewall", "show", "allprofiles", "state").Output(); err == nil {
		text := strings.ToLower(string(out))
		// All three profiles should be "on".
		onCount := strings.Count(text, "state                                 on")
		posture.FirewallEnabled = onCount >= 3
	}

	// --- BitLocker (disk encryption) ---
	if out, err := exec.Command("manage-bde", "-status").Output(); err == nil {
		posture.EncryptionEnabled = strings.Contains(string(out), "Protection On")
	}

	// --- Screen lock / lock screen timeout ---
	// Check the policy registry key for ScreenSaveActive and ScreenSaverIsSecure.
	posture.ScreenLockEnabled = checkWindowsScreenLock()

	// --- OS up-to-date ---
	// Check Windows Update pending count via wuauclt or PowerShell (non-interactive).
	posture.OSUpToDate = checkWindowsUpdates()

	// --- Windows Defender ---
	posture.AntivirusInstalled = checkWindowsDefender()

	return posture, nil
}

func checkWindowsScreenLock() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER,
		`Control Panel\Desktop`, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()

	active, _, err := k.GetStringValue("ScreenSaveActive")
	if err != nil || active != "1" {
		return false
	}
	secure, _, err := k.GetStringValue("ScreenSaverIsSecure")
	if err != nil {
		return false
	}
	return secure == "1"
}

func checkWindowsDefender() bool {
	// Check if Windows Defender service (WdBoot/WinDefend) is running.
	if out, err := exec.Command("sc", "query", "WinDefend").Output(); err == nil {
		return strings.Contains(strings.ToLower(string(out)), "running")
	}
	// Check registry for Defender real-time protection status.
	k, err := registry.OpenKey(registry.LOCAL_MACHINE,
		`SOFTWARE\Microsoft\Windows Defender\Real-Time Protection`,
		registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	val, _, err := k.GetIntegerValue("DisableRealtimeMonitoring")
	if err != nil {
		// Key not present usually means RTP is on.
		return true
	}
	return val == 0
}

func checkWindowsUpdates() bool {
	// Use PowerShell to count pending Windows Updates.
	script := `(New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search("IsInstalled=0 and Type='Software'").Updates.Count`
	out, err := exec.Command("powershell", "-NonInteractive", "-Command", script).Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) == "0"
}

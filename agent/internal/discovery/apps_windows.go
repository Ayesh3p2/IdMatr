//go:build windows

package discovery

import (
	"strings"

	"golang.org/x/sys/windows/registry"

	"github.com/idmart/agent/internal/types"
)

type windowsAppDiscovery struct{}

func newAppDiscovery() AppDiscovery {
	return &windowsAppDiscovery{}
}

func (d *windowsAppDiscovery) Discover() ([]types.AppInfo, error) {
	seen := make(map[string]struct{})
	var apps []types.AppInfo

	keyPaths := []struct {
		root registry.Key
		path string
	}{
		{registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`},
		{registry.CURRENT_USER, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`},
		{registry.LOCAL_MACHINE, `SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`},
	}

	for _, kp := range keyPaths {
		readUninstallKey(kp.root, kp.path, seen, &apps)
	}
	return apps, nil
}

func readUninstallKey(root registry.Key, keyPath string, seen map[string]struct{}, apps *[]types.AppInfo) {
	k, err := registry.OpenKey(root, keyPath, registry.ENUMERATE_SUB_KEYS|registry.READ)
	if err != nil {
		return
	}
	defer k.Close()

	subkeyNames, err := k.ReadSubKeyNames(-1)
	if err != nil {
		return
	}

	for _, name := range subkeyNames {
		subk, err := registry.OpenKey(k, name, registry.QUERY_VALUE)
		if err != nil {
			continue
		}

		displayName, _, _ := subk.GetStringValue("DisplayName")
		displayVersion, _, _ := subk.GetStringValue("DisplayVersion")
		publisher, _, _ := subk.GetStringValue("Publisher")
		installDate, _, _ := subk.GetStringValue("InstallDate")
		installLocation, _, _ := subk.GetStringValue("InstallLocation")

		subk.Close()

		if displayName == "" {
			continue
		}
		if strings.HasPrefix(name, "KB") {
			continue
		}

		key := displayName + "|" + displayVersion
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}

		*apps = append(*apps, types.AppInfo{
			Name:        displayName,
			Version:     displayVersion,
			Publisher:   publisher,
			InstallDate: installDate,
			Path:        installLocation,
			Source:      "registry",
		})
	}
}

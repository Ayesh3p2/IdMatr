//go:build darwin

package discovery

import (
	"encoding/json"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"

	"github.com/idmart/agent/internal/types"
)

type darwinAppDiscovery struct{}

func newAppDiscovery() AppDiscovery {
	return &darwinAppDiscovery{}
}

// Discover enumerates applications from /Applications, ~/Applications, and
// system_profiler SPApplicationsDataType. Results are deduplicated by name+version.
func (d *darwinAppDiscovery) Discover() ([]types.AppInfo, error) {
	seen := make(map[string]struct{})
	var apps []types.AppInfo

	add := func(app types.AppInfo) {
		key := app.Name + "|" + app.Version
		if _, exists := seen[key]; !exists {
			seen[key] = struct{}{}
			apps = append(apps, app)
		}
	}

	// Scan /Applications directory.
	scanDir("/Applications", "directory", seen, &apps)

	// Scan ~/Applications directory.
	if u, err := user.Current(); err == nil {
		scanDir(filepath.Join(u.HomeDir, "Applications"), "directory", seen, &apps)
	}

	// system_profiler gives richer metadata.
	spApps := discoverViaSystemProfiler()
	for _, app := range spApps {
		add(app)
	}

	return apps, nil
}

// scanDir walks a directory looking for *.app bundles.
func scanDir(dir, source string, seen map[string]struct{}, apps *[]types.AppInfo) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".app") {
			continue
		}
		appPath := filepath.Join(dir, e.Name())
		app := parsePlist(appPath, source)
		key := app.Name + "|" + app.Version
		if _, exists := seen[key]; !exists {
			seen[key] = struct{}{}
			*apps = append(*apps, app)
		}
	}
}

// parsePlist reads CFBundle keys from an .app bundle's Info.plist.
func parsePlist(appPath, source string) types.AppInfo {
	app := types.AppInfo{
		Name:   strings.TrimSuffix(filepath.Base(appPath), ".app"),
		Path:   appPath,
		Source: source,
	}

	plistPath := filepath.Join(appPath, "Contents", "Info.plist")
	data, err := os.ReadFile(plistPath)
	if err != nil {
		return app
	}

	content := string(data)
	app.BundleID = extractPlistValue(content, "CFBundleIdentifier")
	if name := extractPlistValue(content, "CFBundleName"); name != "" {
		app.Name = name
	}
	if dispName := extractPlistValue(content, "CFBundleDisplayName"); dispName != "" {
		app.Name = dispName
	}
	if ver := extractPlistValue(content, "CFBundleShortVersionString"); ver != "" {
		app.Version = ver
	}
	return app
}

// extractPlistValue extracts the string value following a given key in a plist XML file.
func extractPlistValue(content, key string) string {
	keyTag := "<key>" + key + "</key>"
	idx := strings.Index(content, keyTag)
	if idx < 0 {
		return ""
	}
	rest := content[idx+len(keyTag):]
	start := strings.Index(rest, "<string>")
	if start < 0 {
		return ""
	}
	rest = rest[start+len("<string>"):]
	end := strings.Index(rest, "</string>")
	if end < 0 {
		return ""
	}
	return rest[:end]
}

type spApp struct {
	Name         string `json:"_name"`
	Version      string `json:"version"`
	Path         string `json:"path"`
	LastModified string `json:"lastModified"`
	BundleID     string `json:"bundleId,omitempty"`
}

type spOutput struct {
	SPApplicationsDataType []spApp `json:"SPApplicationsDataType"`
}

func discoverViaSystemProfiler() []types.AppInfo {
	out, err := exec.Command("system_profiler", "SPApplicationsDataType", "-json").Output()
	if err != nil {
		return nil
	}

	var spData spOutput
	if err := json.Unmarshal(out, &spData); err != nil {
		return nil
	}

	apps := make([]types.AppInfo, 0, len(spData.SPApplicationsDataType))
	for _, a := range spData.SPApplicationsDataType {
		if a.Name == "" {
			continue
		}
		apps = append(apps, types.AppInfo{
			Name:        a.Name,
			Version:     a.Version,
			Path:        a.Path,
			InstallDate: a.LastModified,
			BundleID:    a.BundleID,
			Source:      "system_profiler",
		})
	}
	return apps
}

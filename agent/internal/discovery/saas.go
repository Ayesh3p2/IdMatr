package discovery

import (
	"database/sql"
	"io"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	"github.com/idmart/agent/internal/types"
)

// knownSaaS maps hostname substrings to human-readable service names.
var knownSaaS = map[string]string{
	"github.com":               "GitHub",
	"gitlab.com":               "GitLab",
	"slack.com":                "Slack",
	"notion.so":                "Notion",
	"figma.com":                "Figma",
	"atlassian.net":            "Atlassian",
	"jira.com":                 "Jira",
	"confluence.com":           "Confluence",
	"salesforce.com":           "Salesforce",
	"hubspot.com":              "HubSpot",
	"zendesk.com":              "Zendesk",
	"zoom.us":                  "Zoom",
	"dropbox.com":              "Dropbox",
	"box.com":                  "Box",
	"drive.google.com":         "Google Drive",
	"docs.google.com":          "Google Docs",
	"sheets.google.com":        "Google Sheets",
	"mail.google.com":          "Gmail",
	"calendar.google.com":      "Google Calendar",
	"meet.google.com":          "Google Meet",
	"outlook.com":              "Outlook",
	"office.com":               "Microsoft 365",
	"teams.microsoft.com":      "Microsoft Teams",
	"sharepoint.com":           "SharePoint",
	"onedrive.live.com":        "OneDrive",
	"aws.amazon.com":           "AWS",
	"console.aws.amazon.com":   "AWS Console",
	"portal.azure.com":         "Azure",
	"console.cloud.google.com": "GCP",
	"app.datadog.com":          "Datadog",
	"splunk.com":               "Splunk",
	"okta.com":                 "Okta",
	"auth0.com":                "Auth0",
	"1password.com":            "1Password",
	"lastpass.com":             "LastPass",
	"bitwarden.com":            "Bitwarden",
	"linear.app":               "Linear",
	"miro.com":                 "Miro",
	"airtable.com":             "Airtable",
	"asana.com":                "Asana",
	"trello.com":               "Trello",
	"monday.com":               "Monday.com",
	"clickup.com":              "ClickUp",
}

// browserProfile describes a browser history database.
type browserProfile struct {
	name     string
	paths    []string
	isFF     bool
	isSafari bool
}

// DiscoverSaaS scans browser history databases and returns detected SaaS services.
func DiscoverSaaS(logger *log.Logger) ([]types.SaaSInfo, error) {
	home, _ := os.UserHomeDir()

	profiles := buildBrowserProfiles(home)
	seen := make(map[string]types.SaaSInfo)

	for _, profile := range profiles {
		for _, pattern := range profile.paths {
			matches, err := filepath.Glob(pattern)
			if err != nil || len(matches) == 0 {
				continue
			}
			for _, dbPath := range matches {
				var urls []urlRecord
				if profile.isFF {
					urls = readFirefoxHistory(dbPath, logger)
				} else if profile.isSafari {
					urls = readSafariHistory(dbPath, logger)
				} else {
					urls = readChromeHistory(dbPath, logger)
				}
				for _, u := range urls {
					mergeSaaSRecord(u, profile.name, seen)
				}
			}
		}
	}

	result := make([]types.SaaSInfo, 0, len(seen))
	for _, v := range seen {
		result = append(result, v)
	}
	return result, nil
}

type urlRecord struct {
	rawURL   string
	lastSeen time.Time
}

func mergeSaaSRecord(u urlRecord, source string, seen map[string]types.SaaSInfo) {
	parsed, err := url.Parse(u.rawURL)
	if err != nil {
		return
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "" {
		return
	}

	svcName := matchKnownSaaS(host)
	if svcName == "" {
		return
	}

	if existing, ok := seen[host]; !ok {
		seen[host] = types.SaaSInfo{
			Domain:   host,
			Service:  svcName,
			LastSeen: u.lastSeen,
			Source:   source,
		}
	} else if u.lastSeen.After(existing.LastSeen) {
		existing.LastSeen = u.lastSeen
		seen[host] = existing
	}
}

func matchKnownSaaS(host string) string {
	if svc, ok := knownSaaS[host]; ok {
		return svc
	}
	for domain, svc := range knownSaaS {
		if strings.HasSuffix(host, "."+domain) || host == domain {
			return svc
		}
	}
	return ""
}

func buildBrowserProfiles(home string) []browserProfile {
	switch runtime.GOOS {
	case "darwin":
		return []browserProfile{
			{
				name:  "chrome_history",
				paths: []string{filepath.Join(home, "Library/Application Support/Google/Chrome/Default/History")},
			},
			{
				name:  "brave_history",
				paths: []string{filepath.Join(home, "Library/Application Support/BraveSoftware/Brave-Browser/Default/History")},
			},
			{
				name:  "edge_history",
				paths: []string{filepath.Join(home, "Library/Application Support/Microsoft Edge/Default/History")},
			},
			{
				name:  "firefox_history",
				paths: []string{filepath.Join(home, "Library/Application Support/Firefox/Profiles/*/places.sqlite")},
				isFF:  true,
			},
			{
				name:     "safari_history",
				paths:    []string{filepath.Join(home, "Library/Safari/History.db")},
				isSafari: true,
			},
		}
	case "linux":
		return []browserProfile{
			{
				name:  "chrome_history",
				paths: []string{filepath.Join(home, ".config/google-chrome/Default/History")},
			},
			{
				name:  "brave_history",
				paths: []string{filepath.Join(home, ".config/BraveSoftware/Brave-Browser/Default/History")},
			},
			{
				name:  "firefox_history",
				paths: []string{filepath.Join(home, ".mozilla/firefox/*/places.sqlite")},
				isFF:  true,
			},
		}
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		return []browserProfile{
			{
				name:  "chrome_history",
				paths: []string{filepath.Join(localAppData, `Google\Chrome\User Data\Default\History`)},
			},
			{
				name:  "edge_history",
				paths: []string{filepath.Join(localAppData, `Microsoft\Edge\User Data\Default\History`)},
			},
			{
				name:  "brave_history",
				paths: []string{filepath.Join(localAppData, `BraveSoftware\Brave-Browser\User Data\Default\History`)},
			},
			{
				name:  "firefox_history",
				paths: []string{filepath.Join(os.Getenv("APPDATA"), `Mozilla\Firefox\Profiles\*\places.sqlite`)},
				isFF:  true,
			},
		}
	default:
		return nil
	}
}

func copyToTemp(src string) (string, error) {
	sf, err := os.Open(src)
	if err != nil {
		return "", err
	}
	defer sf.Close()

	tf, err := os.CreateTemp("", "idmart-hist-*.db")
	if err != nil {
		return "", err
	}
	defer tf.Close()

	if _, err := io.Copy(tf, sf); err != nil {
		os.Remove(tf.Name())
		return "", err
	}
	return tf.Name(), nil
}

func readChromeHistory(dbPath string, logger *log.Logger) []urlRecord {
	tmp, err := copyToTemp(dbPath)
	if err != nil {
		return nil
	}
	defer os.Remove(tmp)

	db, err := sql.Open("sqlite", tmp+"?mode=ro&_journal=WAL")
	if err != nil {
		return nil
	}
	defer db.Close()

	rows, err := db.Query(`SELECT url, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 5000`)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var records []urlRecord
	for rows.Next() {
		var rawURL string
		var chromeMicro int64
		if err := rows.Scan(&rawURL, &chromeMicro); err != nil {
			continue
		}
		const chromeEpochOffset = 11644473600000000
		t := time.Time{}
		if chromeMicro > 0 {
			unixMicro := chromeMicro - chromeEpochOffset
			t = time.UnixMicro(unixMicro).UTC()
		}
		records = append(records, urlRecord{rawURL: rawURL, lastSeen: t})
	}
	return records
}

func readFirefoxHistory(dbPath string, logger *log.Logger) []urlRecord {
	tmp, err := copyToTemp(dbPath)
	if err != nil {
		return nil
	}
	defer os.Remove(tmp)

	db, err := sql.Open("sqlite", tmp+"?mode=ro")
	if err != nil {
		return nil
	}
	defer db.Close()

	rows, err := db.Query(`SELECT url, last_visit_date FROM moz_places WHERE last_visit_date IS NOT NULL ORDER BY last_visit_date DESC LIMIT 5000`)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var records []urlRecord
	for rows.Next() {
		var rawURL string
		var ffMicro int64
		if err := rows.Scan(&rawURL, &ffMicro); err != nil {
			continue
		}
		t := time.UnixMicro(ffMicro).UTC()
		records = append(records, urlRecord{rawURL: rawURL, lastSeen: t})
	}
	return records
}

func readSafariHistory(dbPath string, logger *log.Logger) []urlRecord {
	tmp, err := copyToTemp(dbPath)
	if err != nil {
		return nil
	}
	defer os.Remove(tmp)

	db, err := sql.Open("sqlite", tmp+"?mode=ro")
	if err != nil {
		return nil
	}
	defer db.Close()

	rows, err := db.Query(`
		SELECT i.url, v.visit_time
		FROM history_items i
		JOIN history_visits v ON v.history_item = i.id
		ORDER BY v.visit_time DESC
		LIMIT 5000`)
	if err != nil {
		rows, err = db.Query(`SELECT url, visit_time FROM history_items ORDER BY visit_time DESC LIMIT 5000`)
		if err != nil {
			return nil
		}
	}
	defer rows.Close()

	var records []urlRecord
	for rows.Next() {
		var rawURL string
		var safariTime float64
		if err := rows.Scan(&rawURL, &safariTime); err != nil {
			continue
		}
		const appleEpoch = 978307200
		t := time.Unix(int64(safariTime)+appleEpoch, 0).UTC()
		records = append(records, urlRecord{rawURL: rawURL, lastSeen: t})
	}
	return records
}

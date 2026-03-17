package update

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"github.com/idmart/agent/internal/config"
	"github.com/idmart/agent/internal/transport"
)

// Updater checks the server for a newer agent binary and performs an in-place
// self-update when a newer version is available.
type Updater struct {
	cfg    *config.Config
	client *transport.Client
	logger *log.Logger
}

// New creates an Updater.
func New(cfg *config.Config, client *transport.Client, logger *log.Logger) *Updater {
	return &Updater{cfg: cfg, client: client, logger: logger}
}

// CheckAndUpdate compares the running version against the server's latest.
// If a newer version is available it downloads, verifies, and installs it,
// then re-execs the new binary.
func (u *Updater) CheckAndUpdate(current string) error {
	u.logger.Printf("updater: checking for updates (current=%s)", current)

	vi, err := u.client.CheckVersionFull(current)
	if err != nil {
		return fmt.Errorf("updater: version check failed: %w", err)
	}

	if vi.Version == "" || vi.DownloadURL == "" {
		u.logger.Println("updater: server returned no update info")
		return nil
	}

	if !isNewerVersion(vi.Version, current) {
		u.logger.Printf("updater: already at latest version %s", current)
		return nil
	}

	u.logger.Printf("updater: new version %s available, downloading from %s", vi.Version, vi.DownloadURL)

	tmpFile, err := u.download(vi.DownloadURL)
	if err != nil {
		return fmt.Errorf("updater: download failed: %w", err)
	}
	defer func() {
		if _, err := os.Stat(tmpFile); err == nil {
			os.Remove(tmpFile)
		}
	}()

	if vi.ChecksumSHA256 != "" {
		if err := verifyChecksum(tmpFile, vi.ChecksumSHA256); err != nil {
			return fmt.Errorf("updater: checksum mismatch: %w", err)
		}
		u.logger.Println("updater: checksum verified")
	}

	if runtime.GOOS != "windows" {
		if err := os.Chmod(tmpFile, 0755); err != nil { //nolint:gosec
			return fmt.Errorf("updater: chmod failed: %w", err)
		}
	}

	selfPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("updater: could not determine self path: %w", err)
	}

	if runtime.GOOS == "windows" {
		oldPath := selfPath + ".old"
		_ = os.Remove(oldPath)
		if err := os.Rename(selfPath, oldPath); err != nil {
			return fmt.Errorf("updater: rename self to .old: %w", err)
		}
	}

	if err := os.Rename(tmpFile, selfPath); err != nil {
		return fmt.Errorf("updater: install new binary: %w", err)
	}

	u.logger.Printf("updater: installed version %s at %s — restarting", vi.Version, selfPath)
	return reexec(selfPath)
}

func (u *Updater) download(downloadURL string) (string, error) {
	resp, err := http.Get(downloadURL) //nolint:gosec
	if err != nil {
		return "", fmt.Errorf("HTTP GET: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download returned status %d", resp.StatusCode)
	}

	tf, err := os.CreateTemp("", "idmart-agent-update-*")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	if _, err := io.Copy(tf, resp.Body); err != nil {
		tf.Close()
		os.Remove(tf.Name())
		return "", fmt.Errorf("write temp file: %w", err)
	}
	tf.Close()
	return tf.Name(), nil
}

func verifyChecksum(path, expected string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	got := hex.EncodeToString(h.Sum(nil))
	if !strings.EqualFold(got, expected) {
		return fmt.Errorf("got %s, want %s", got, expected)
	}
	return nil
}

// isNewerVersion returns true if candidate is a higher semantic version than current.
func isNewerVersion(candidate, current string) bool {
	cParts := splitVersion(candidate)
	rParts := splitVersion(current)

	for i := 0; i < len(cParts) && i < len(rParts); i++ {
		if cParts[i] > rParts[i] {
			return true
		}
		if cParts[i] < rParts[i] {
			return false
		}
	}
	return len(cParts) > len(rParts)
}

func splitVersion(v string) []int {
	v = strings.TrimPrefix(v, "v")
	parts := strings.Split(v, ".")
	result := make([]int, 0, len(parts))
	for _, p := range parts {
		var n int
		fmt.Sscanf(p, "%d", &n)
		result = append(result, n)
	}
	return result
}

func reexec(path string) error {
	args := os.Args[1:]
	cmd := exec.Command(path, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("updater: re-exec failed: %w", err)
	}
	os.Exit(0)
	return nil
}

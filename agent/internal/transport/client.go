package transport

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"time"

	"github.com/idmart/agent/internal/config"
	"github.com/idmart/agent/internal/types"
)

const (
	maxRetries     = 3
	requestTimeout = 30 * time.Second
	initialBackoff = 2 * time.Second
)

// RegistrationRequest is sent to /api/agent/register on first boot.
type RegistrationRequest struct {
	DeviceID     string            `json:"device_id"`
	Hostname     string            `json:"hostname"`
	OS           string            `json:"os"`
	OSVersion    string            `json:"os_version"`
	AgentVersion string            `json:"agent_version"`
	Tags         map[string]string `json:"tags,omitempty"`
}

// RegistrationResponse is the server's reply to a registration request.
type RegistrationResponse struct {
	DeviceID string `json:"device_id"`
	Token    string `json:"token,omitempty"`
	Accepted bool   `json:"accepted"`
	Message  string `json:"message,omitempty"`
}

// VersionInfo is the server's reply when checking for agent updates.
type VersionInfo struct {
	Version        string `json:"version"`
	DownloadURL    string `json:"download_url"`
	ChecksumSHA256 string `json:"checksum_sha256"`
	ReleaseNotes   string `json:"release_notes,omitempty"`
}

// Client handles all HTTP communication with the IDMatr server.
type Client struct {
	cfg        *config.Config
	httpClient *http.Client
	logger     *log.Logger
}

// NewClient creates a Client using the provided configuration.
func NewClient(cfg *config.Config, logger *log.Logger) *Client {
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: cfg.TLSSkipVerify, //nolint:gosec // user-controlled flag
		},
	}
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout:   requestTimeout,
			Transport: tr,
		},
		logger: logger,
	}
}

// Register sends a device registration request to the server.
func (c *Client) Register(req RegistrationRequest) (*RegistrationResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("transport: marshal registration: %w", err)
	}

	resp, err := c.doWithRetry("POST", "/api/agent/register", body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var regResp RegistrationResponse
	if err := json.NewDecoder(resp.Body).Decode(&regResp); err != nil {
		return nil, fmt.Errorf("transport: decode registration response: %w", err)
	}
	return &regResp, nil
}

// SendEvents submits a batch of telemetry events to the server.
func (c *Client) SendEvents(events []types.TelemetryEvent) error {
	body, err := json.Marshal(events)
	if err != nil {
		return fmt.Errorf("transport: marshal events: %w", err)
	}

	resp, err := c.doWithRetry("POST", "/api/agent/events", body)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// CheckVersionFull queries the server and returns the full VersionInfo struct.
func (c *Client) CheckVersionFull(current string) (*VersionInfo, error) {
	resp, err := c.doWithRetry("GET", "/api/agent/version?current="+current, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var vi VersionInfo
	if err := json.NewDecoder(resp.Body).Decode(&vi); err != nil {
		return nil, fmt.Errorf("transport: decode version info: %w", err)
	}
	return &vi, nil
}

// doWithRetry performs an HTTP request with exponential-backoff retry (max 3 attempts).
func (c *Client) doWithRetry(method, path string, body []byte) (*http.Response, error) {
	var lastErr error
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt-1))) * initialBackoff
			c.logger.Printf("transport: retry %d/%d after %v (last error: %v)", attempt, maxRetries, backoff, lastErr)
			time.Sleep(backoff)
		}

		resp, err := c.do(method, path, body)
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode >= 500 {
			data, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("transport: server error %d: %s", resp.StatusCode, string(data))
			continue
		}
		if resp.StatusCode >= 400 {
			data, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("transport: client error %d: %s", resp.StatusCode, string(data))
		}
		return resp, nil
	}
	return nil, fmt.Errorf("transport: all %d retries failed; last error: %w", maxRetries, lastErr)
}

// do executes a single HTTP request with the agent's standard headers.
func (c *Client) do(method, path string, body []byte) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		reqBody = bytes.NewReader(body)
	}

	url := c.cfg.ServerURL + path
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("transport: build request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIToken)
	req.Header.Set("X-Agent-Version", types.AgentVersion)
	req.Header.Set("X-Device-ID", c.cfg.DeviceID)

	return c.httpClient.Do(req)
}

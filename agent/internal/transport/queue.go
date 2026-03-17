package transport

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/idmart/agent/internal/types"
)

const (
	queueFileName = "events.queue"
	maxQueueSize  = 10000
)

// Queue is a file-backed, thread-safe buffer for TelemetryEvents.
type Queue struct {
	dir    string
	mu     sync.Mutex
	logger *log.Logger
}

// NewQueue creates a Queue that stores events in dir/events.queue.
func NewQueue(dir string, logger *log.Logger) *Queue {
	if err := os.MkdirAll(dir, 0750); err != nil {
		logger.Printf("queue: could not create queue dir %s: %v", dir, err)
	}
	return &Queue{dir: dir, logger: logger}
}

// Enqueue appends a TelemetryEvent to the queue file.
func (q *Queue) Enqueue(event types.TelemetryEvent) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.unsafeSize() >= maxQueueSize {
		if err := q.dropOldest(1); err != nil {
			q.logger.Printf("queue: drop oldest failed: %v", err)
		}
	}

	line, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("queue: marshal event: %w", err)
	}

	f, err := os.OpenFile(q.path(), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640)
	if err != nil {
		return fmt.Errorf("queue: open file: %w", err)
	}
	defer f.Close()

	if _, err := f.Write(append(line, '\n')); err != nil {
		return fmt.Errorf("queue: write event: %w", err)
	}
	return nil
}

// DrainTo reads all queued events and sends them via client.
func (q *Queue) DrainTo(client *Client) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	f, err := os.Open(q.path())
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("queue: open for drain: %w", err)
	}

	var events []types.TelemetryEvent
	scanner := bufio.NewScanner(f)
	buf := make([]byte, 0, 4*1024*1024)
	scanner.Buffer(buf, 4*1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var event types.TelemetryEvent
		if err := json.Unmarshal(line, &event); err != nil {
			q.logger.Printf("queue: skip malformed line: %v", err)
			continue
		}
		events = append(events, event)
	}
	f.Close()

	if len(events) == 0 {
		return nil
	}

	q.logger.Printf("queue: draining %d queued events", len(events))

	const batchSize = 100
	sentCount := 0
	for i := 0; i < len(events); i += batchSize {
		end := i + batchSize
		if end > len(events) {
			end = len(events)
		}
		batch := events[i:end]
		if err := client.SendEvents(batch); err != nil {
			q.logger.Printf("queue: drain send error (sent %d/%d): %v", sentCount, len(events), err)
			return q.rewriteWith(events[i:])
		}
		sentCount += len(batch)
	}

	q.logger.Printf("queue: drained all %d events", sentCount)
	return os.Remove(q.path())
}

// Size returns the current number of events in the queue.
func (q *Queue) Size() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.unsafeSize()
}

func (q *Queue) unsafeSize() int {
	f, err := os.Open(q.path())
	if err != nil {
		return 0
	}
	defer f.Close()

	count := 0
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		if len(scanner.Bytes()) > 0 {
			count++
		}
	}
	return count
}

func (q *Queue) dropOldest(n int) error {
	f, err := os.Open(q.path())
	if err != nil {
		return err
	}

	var lines [][]byte
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		b := scanner.Bytes()
		if len(b) > 0 {
			cp := make([]byte, len(b))
			copy(cp, b)
			lines = append(lines, cp)
		}
	}
	f.Close()

	if n >= len(lines) {
		return os.Remove(q.path())
	}
	lines = lines[n:]
	return q.writeLines(lines)
}

func (q *Queue) rewriteWith(events []types.TelemetryEvent) error {
	lines := make([][]byte, 0, len(events))
	for _, e := range events {
		line, err := json.Marshal(e)
		if err != nil {
			continue
		}
		lines = append(lines, line)
	}
	return q.writeLines(lines)
}

func (q *Queue) writeLines(lines [][]byte) error {
	f, err := os.OpenFile(q.path(), os.O_TRUNC|os.O_CREATE|os.O_WRONLY, 0640)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriter(f)
	for _, line := range lines {
		w.Write(line)
		w.WriteByte('\n')
	}
	return w.Flush()
}

func (q *Queue) path() string {
	return filepath.Join(q.dir, queueFileName)
}

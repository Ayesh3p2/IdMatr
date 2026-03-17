package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	maxLogSize    = 50 * 1024 * 1024 // 50 MB
	maxLogRotates = 3
)

// Level represents a log severity level.
type Level int

const (
	LevelDebug Level = iota
	LevelInfo
	LevelWarn
	LevelError
)

func parseLevel(s string) Level {
	switch strings.ToLower(s) {
	case "debug":
		return LevelDebug
	case "warn", "warning":
		return LevelWarn
	case "error":
		return LevelError
	default:
		return LevelInfo
	}
}

func levelString(l Level) string {
	switch l {
	case LevelDebug:
		return "DEBUG"
	case LevelWarn:
		return "WARN"
	case LevelError:
		return "ERROR"
	default:
		return "INFO"
	}
}

// Logger is a structured, levelled logger that writes to a file and stdout,
// with automatic rotation when the file exceeds maxLogSize.
type Logger struct {
	mu       sync.Mutex
	level    Level
	filePath string
	file     *os.File
	multi    io.Writer
	std      *log.Logger
	eventLog io.Writer // platform-specific (Windows Event Log)
}

// New creates a Logger writing to logFile at the given log level.
// If logFile is empty, output goes to stdout only.
func New(logFile, level string) (*Logger, error) {
	l := &Logger{
		level:    parseLevel(level),
		filePath: logFile,
	}

	if err := l.openFile(); err != nil {
		return nil, err
	}

	// Optionally attach Windows Event Log.
	if runtime.GOOS == "windows" {
		l.eventLog = newWindowsEventLog()
	}

	return l, nil
}

// openFile (re)opens the log file and rebuilds the multi-writer.
func (l *Logger) openFile() error {
	if l.filePath == "" {
		l.multi = os.Stdout
		l.std = log.New(l.multi, "", 0)
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(l.filePath), 0750); err != nil {
		return fmt.Errorf("logger: create log dir: %w", err)
	}

	f, err := os.OpenFile(l.filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640)
	if err != nil {
		return fmt.Errorf("logger: open log file: %w", err)
	}

	if l.file != nil {
		l.file.Close()
	}
	l.file = f
	l.multi = io.MultiWriter(os.Stdout, f)
	l.std = log.New(l.multi, "", 0)
	return nil
}

// Debug logs at DEBUG level.
func (l *Logger) Debug(msg string, fields ...interface{}) {
	l.log(LevelDebug, msg, fields...)
}

// Info logs at INFO level.
func (l *Logger) Info(msg string, fields ...interface{}) {
	l.log(LevelInfo, msg, fields...)
}

// Warn logs at WARN level.
func (l *Logger) Warn(msg string, fields ...interface{}) {
	l.log(LevelWarn, msg, fields...)
}

// Error logs at ERROR level.
func (l *Logger) Error(msg string, fields ...interface{}) {
	l.log(LevelError, msg, fields...)
}

// Printf implements a Printf-style interface so this logger can be passed as a
// *log.Logger-compatible writer (used by the kardianos/service package).
func (l *Logger) Printf(format string, args ...interface{}) {
	l.log(LevelInfo, fmt.Sprintf(format, args...))
}

// Println implements a Println-style interface.
func (l *Logger) Println(args ...interface{}) {
	l.log(LevelInfo, fmt.Sprint(args...))
}

// StdLogger returns a *log.Logger that forwards to this logger at INFO level.
func (l *Logger) StdLogger() *log.Logger {
	return log.New(&logWriter{l: l}, "", 0)
}

// log writes a log entry if level >= l.level.
func (l *Logger) log(level Level, msg string, fields ...interface{}) {
	if level < l.level {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	ts := time.Now().Format(time.RFC3339)
	entry := fmt.Sprintf("%s %s %s", ts, levelString(level), msg)
	if len(fields) > 0 && len(fields)%2 == 0 {
		var sb strings.Builder
		for i := 0; i < len(fields); i += 2 {
			sb.WriteString(fmt.Sprintf(" %v=%v", fields[i], fields[i+1]))
		}
		entry += sb.String()
	}

	l.std.Println(entry)

	if l.eventLog != nil {
		fmt.Fprintln(l.eventLog, entry)
	}

	// Rotate if needed.
	if l.file != nil {
		if fi, err := l.file.Stat(); err == nil && fi.Size() > maxLogSize {
			l.rotate()
		}
	}
}

// rotate renames log files: .log → .log.1 → .log.2 → .log.3 (oldest dropped).
func (l *Logger) rotate() {
	l.file.Close()
	l.file = nil

	// Remove the oldest rotation.
	oldest := fmt.Sprintf("%s.%d", l.filePath, maxLogRotates)
	os.Remove(oldest)

	// Shift: .2 → .3, .1 → .2, base → .1
	for i := maxLogRotates - 1; i >= 1; i-- {
		src := fmt.Sprintf("%s.%d", l.filePath, i)
		dst := fmt.Sprintf("%s.%d", l.filePath, i+1)
		os.Rename(src, dst)
	}
	os.Rename(l.filePath, l.filePath+".1")

	// Reopen a fresh file.
	_ = l.openFile()
}

// Close flushes and closes the log file.
func (l *Logger) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.file != nil {
		l.file.Close()
		l.file = nil
	}
}

// logWriter bridges this Logger to the io.Writer interface.
type logWriter struct{ l *Logger }

func (w *logWriter) Write(p []byte) (int, error) {
	w.l.log(LevelInfo, strings.TrimRight(string(p), "\n"))
	return len(p), nil
}

// newWindowsEventLog returns an io.Writer that writes to the Windows Event Log,
// or nil on non-Windows platforms.
func newWindowsEventLog() io.Writer {
	// Only compiled in on Windows via logger_windows.go.
	return openWindowsEventLog()
}

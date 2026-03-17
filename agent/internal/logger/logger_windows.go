//go:build windows

package logger

import (
	"io"

	"golang.org/x/sys/windows/svc/eventlog"
)

type winEventLogWriter struct {
	el *eventlog.Log
}

func (w *winEventLogWriter) Write(p []byte) (int, error) {
	if w.el != nil {
		_ = w.el.Info(1, string(p))
	}
	return len(p), nil
}

// openWindowsEventLog registers (if necessary) and opens the Windows Event Log
// source "IDMatrAgent".
func openWindowsEventLog() io.Writer {
	const src = "IDMatrAgent"
	// Try to register the event source; ignore errors if it already exists.
	_ = eventlog.InstallAsEventCreate(src, eventlog.Error|eventlog.Warning|eventlog.Info)

	el, err := eventlog.Open(src)
	if err != nil {
		return nil
	}
	return &winEventLogWriter{el: el}
}

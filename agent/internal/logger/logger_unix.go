//go:build !windows

package logger

import "io"

// openWindowsEventLog is a no-op on non-Windows platforms.
func openWindowsEventLog() io.Writer {
	return nil
}

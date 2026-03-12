package domain

// ValidTransitions defines which status transitions are allowed.
var ValidTransitions = map[DownloadStatus][]DownloadStatus{
	StatusQueued:      {StatusDownloading, StatusCancelled, StatusPaused},
	StatusDownloading: {StatusCompleted, StatusFailed, StatusPaused, StatusCancelled, StatusInterrupted},
	StatusPaused:      {StatusQueued, StatusDownloading, StatusCancelled},
	StatusFailed:      {StatusQueued, StatusCancelled},     // retry goes back to queued
	StatusCancelled:   {},                                  // terminal
	StatusCompleted:   {},                                  // terminal
	StatusInterrupted: {StatusQueued, StatusDownloading, StatusCancelled}, // can retry/resume
}

// CanTransition checks if moving from `from` to `to` is valid.
func CanTransition(from, to DownloadStatus) bool {
	allowed, ok := ValidTransitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

// IsTerminal returns true if the status is a final state.
func IsTerminal(status DownloadStatus) bool {
	return status == StatusCompleted || status == StatusCancelled
}

// IsActive returns true if the download is currently in progress.
func IsActive(status DownloadStatus) bool {
	return status == StatusDownloading
}

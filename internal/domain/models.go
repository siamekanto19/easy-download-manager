package domain

import "time"

// DownloadStatus represents the current state of a download.
type DownloadStatus string

const (
	StatusQueued       DownloadStatus = "queued"
	StatusDownloading  DownloadStatus = "downloading"
	StatusPaused       DownloadStatus = "paused"
	StatusCompleted    DownloadStatus = "completed"
	StatusFailed       DownloadStatus = "failed"
	StatusCancelled    DownloadStatus = "cancelled"
	StatusInterrupted  DownloadStatus = "interrupted"
)

// HistoryOutcome represents the final result of a download attempt.
type HistoryOutcome string

const (
	OutcomeCompleted   HistoryOutcome = "completed"
	OutcomeFailed      HistoryOutcome = "failed"
	OutcomeCancelled   HistoryOutcome = "cancelled"
	OutcomeInterrupted HistoryOutcome = "interrupted"
	OutcomeRemoved     HistoryOutcome = "removed"
	OutcomeRetried     HistoryOutcome = "retried"
)

// Download represents a download task in the system.
type Download struct {
	ID               string         `json:"id"`
	URL              string         `json:"url"`
	OriginalURL      string         `json:"originalUrl"`
	FileName         string         `json:"fileName"`
	OutputDirectory  string         `json:"outputDirectory"`
	TargetPath       string         `json:"targetPath"`
	TempPath         string         `json:"tempPath"`
	Status           DownloadStatus `json:"status"`
	ProgressPercent  float64        `json:"progressPercent"`
	DownloadedBytes  int64          `json:"downloadedBytes"`
	TotalBytes       int64          `json:"totalBytes"`
	SpeedBytesPerSec int64          `json:"speedBytesPerSec"`
	ETASeconds       float64        `json:"etaSeconds"`
	SourceHost       string         `json:"sourceHost"`
	MimeType         string         `json:"mimeType"`
	CanResume        bool           `json:"canResume"`
	Resumable        bool           `json:"resumable"`
	ErrorMessage     string         `json:"errorMessage"`
	CreatedAt        time.Time      `json:"createdAt"`
	StartedAt        *time.Time     `json:"startedAt"`
	CompletedAt      *time.Time     `json:"completedAt"`
	LastUpdatedAt    time.Time      `json:"lastUpdatedAt"`
}

// HistoryEntry represents a record in the download history.
type HistoryEntry struct {
	ID            string         `json:"id"`
	DownloadID    string         `json:"downloadId"`
	URL           string         `json:"url"`
	FileName      string         `json:"fileName"`
	TargetPath    string         `json:"targetPath"`
	FinalStatus   HistoryOutcome `json:"finalStatus"`
	TotalBytes    int64          `json:"totalBytes"`
	StartedAt     *time.Time     `json:"startedAt"`
	EndedAt       *time.Time     `json:"endedAt"`
	AttemptNumber int            `json:"attemptNumber"`
	ActionSummary string         `json:"actionSummary"`
	ErrorMessage  string         `json:"errorMessage"`
	CreatedAt     time.Time      `json:"createdAt"`
}

// Settings holds application configuration.
type Settings struct {
	DefaultDownloadDir   string `json:"defaultDownloadDir"`
	MaxConcurrentDL      int    `json:"maxConcurrentDownloads"`
	DuplicateBehavior    string `json:"duplicateBehavior"`    // "rename", "overwrite", "ask"
	ShowNotifications    bool   `json:"showNotifications"`
	ConfirmOnCloseActive bool   `json:"confirmOnCloseActive"`
}

// DefaultSettings returns sensible defaults.
func DefaultSettings() Settings {
	return Settings{
		DefaultDownloadDir:   "",   // Will be resolved to ~/Downloads at runtime
		MaxConcurrentDL:      3,
		DuplicateBehavior:    "rename",
		ShowNotifications:    true,
		ConfirmOnCloseActive: true,
	}
}

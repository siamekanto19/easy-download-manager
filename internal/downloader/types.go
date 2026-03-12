package downloader

import (
	"context"
	"time"
)

// DownloadRequest describes what to download.
type DownloadRequest struct {
	URL             string
	OutputDirectory string
	FileName        string // If empty, inferred from URL/headers
	TempPath        string // If empty, auto-generated
	Connections     int    // Number of parallel segments (1 = single-connection)
}

// ProgressUpdate is emitted periodically during a download.
type ProgressUpdate struct {
	DownloadedBytes  int64
	TotalBytes       int64
	ProgressPercent  float64
	SpeedBytesPerSec int64
	ETASeconds       float64
	Segments         []SegmentProgress // Per-segment progress (nil for single-connection)
}

// SegmentProgress tracks a single download segment's progress.
type SegmentProgress struct {
	Index           int     `json:"index"`
	StartByte       int64   `json:"startByte"`
	EndByte         int64   `json:"endByte"`
	DownloadedBytes int64   `json:"downloadedBytes"`
	TotalBytes      int64   `json:"totalBytes"`
	Percent         float64 `json:"percent"`
}

// DownloadResult is the final result of a download operation.
type DownloadResult struct {
	FileName    string
	TargetPath  string
	TempPath    string
	TotalBytes  int64
	MimeType    string
	CanResume   bool
	Resumable   bool
	SourceHost  string
	StartedAt   time.Time
	CompletedAt time.Time
	Error       error
}

// ProgressCallback is called periodically with download progress.
type ProgressCallback func(update ProgressUpdate)

// Downloader defines the interface for the download engine.
type Downloader interface {
	// Download starts a download. It blocks until completion, cancellation, or error.
	// The ctx is used for cancellation. progressCb is called periodically with updates.
	Download(ctx context.Context, req DownloadRequest, progressCb ProgressCallback) DownloadResult
}

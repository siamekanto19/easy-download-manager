package services

import (
	"context"
	"download-manager-wails/internal/domain"
	"download-manager-wails/internal/downloader"
	"download-manager-wails/internal/storage"
	"fmt"
	"net/url"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// DownloadService manages download lifecycle and Wails event emission.
type DownloadService struct {
	ctx        context.Context
	repo       *storage.DownloadRepository
	engine     downloader.Downloader
	settings   *SettingsService
	mu         sync.RWMutex
	cancellers map[string]context.CancelFunc // download ID → cancel function
}

// NewDownloadService creates a new download service.
func NewDownloadService(
	repo *storage.DownloadRepository,
	engine downloader.Downloader,
	settings *SettingsService,
) *DownloadService {
	return &DownloadService{
		repo:       repo,
		engine:     engine,
		settings:   settings,
		cancellers: make(map[string]context.CancelFunc),
	}
}

// SetContext sets the Wails context for event emission.
func (s *DownloadService) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// AddDownload creates a new download and optionally starts it immediately.
func (s *DownloadService) AddDownload(rawURL string, outputDir string, fileName string, startImmediately bool) (*domain.Download, error) {
	// Validate URL
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, fmt.Errorf("invalid URL: must be http or https")
	}

	// Use default output dir if not specified
	if outputDir == "" {
		val, err := s.settings.Get("default_download_dir")
		if err != nil || val == "" {
			return nil, fmt.Errorf("no output directory specified and no default set")
		}
		outputDir = val
	}

	// Infer file name from URL if not provided
	if fileName == "" {
		fileName = inferFileNameFromURL(parsed)
	}

	now := time.Now()
	status := domain.StatusQueued
	if startImmediately {
		status = domain.StatusQueued // will transition to downloading when started
	}

	dl := &domain.Download{
		ID:              generateID(),
		URL:             rawURL,
		OriginalURL:     rawURL,
		FileName:        fileName,
		OutputDirectory: outputDir,
		Status:          status,
		CreatedAt:       now,
		LastUpdatedAt:   now,
		SourceHost:      parsed.Hostname(),
	}

	if err := s.repo.Create(dl); err != nil {
		return nil, fmt.Errorf("save download: %w", err)
	}

	// Emit event
	s.emitEvent("download:added", dl)

	if startImmediately {
		go s.startDownload(dl.ID)
	}

	return dl, nil
}

// StartDownload begins downloading a queued/paused download.
func (s *DownloadService) StartDownload(id string) error {
	return s.startDownload(id)
}

func (s *DownloadService) startDownload(id string) error {
	dl, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("download not found: %w", err)
	}

	if !domain.CanTransition(dl.Status, domain.StatusDownloading) {
		return fmt.Errorf("cannot start download in status %s", dl.Status)
	}

	// Update status to downloading
	if err := s.repo.UpdateStatus(id, domain.StatusDownloading, ""); err != nil {
		return fmt.Errorf("update status: %w", err)
	}
	dl.Status = domain.StatusDownloading

	s.emitEvent("download:updated", dl)

	// Create cancellable context
	ctx, cancel := context.WithCancel(context.Background())
	s.mu.Lock()
	s.cancellers[id] = cancel
	s.mu.Unlock()

	// Run download in goroutine
	go func() {
		defer func() {
			s.mu.Lock()
			delete(s.cancellers, id)
			s.mu.Unlock()
		}()

		req := downloader.DownloadRequest{
			URL:             dl.URL,
			OutputDirectory: dl.OutputDirectory,
			FileName:        dl.FileName,
			TempPath:        dl.TempPath,
		}

		result := s.engine.Download(ctx, req, func(update downloader.ProgressUpdate) {
			// Update DB (throttled — the engine already throttles progress callbacks)
			_ = s.repo.UpdateProgress(id, update.DownloadedBytes, update.TotalBytes, update.ProgressPercent, update.SpeedBytesPerSec, update.ETASeconds)

			// Emit real-time event
			s.emitEvent("download:progress", map[string]interface{}{
				"id":               id,
				"downloadedBytes":  update.DownloadedBytes,
				"totalBytes":       update.TotalBytes,
				"progressPercent":  update.ProgressPercent,
				"speedBytesPerSec": update.SpeedBytesPerSec,
				"etaSeconds":       update.ETASeconds,
			})
		})

		// Handle result
		if result.Error != nil {
			errMsg := result.Error.Error()
			if ctx.Err() != nil {
				// Cancelled by user
				_ = s.repo.UpdateStatus(id, domain.StatusCancelled, "")
				s.emitDownloadStatus(id, domain.StatusCancelled, "")
			} else {
				// Failed
				_ = s.repo.UpdateStatus(id, domain.StatusFailed, errMsg)
				s.emitDownloadStatus(id, domain.StatusFailed, errMsg)
			}
			return
		}

		// Success: update record with final info
		dl, _ := s.repo.GetByID(id)
		if dl != nil {
			dl.Status = domain.StatusCompleted
			dl.FileName = result.FileName
			dl.TargetPath = result.TargetPath
			dl.TotalBytes = result.TotalBytes
			dl.DownloadedBytes = result.TotalBytes
			dl.ProgressPercent = 100
			dl.SpeedBytesPerSec = 0
			dl.ETASeconds = 0
			dl.MimeType = result.MimeType
			dl.CanResume = result.CanResume
			dl.Resumable = result.Resumable
			dl.SourceHost = result.SourceHost
			now := time.Now()
			dl.CompletedAt = &now
			_ = s.repo.Update(dl)
		} else {
			_ = s.repo.UpdateStatus(id, domain.StatusCompleted, "")
		}
		s.emitDownloadStatus(id, domain.StatusCompleted, "")
	}()

	return nil
}

// CancelDownload cancels an active download.
func (s *DownloadService) CancelDownload(id string) error {
	s.mu.RLock()
	cancel, ok := s.cancellers[id]
	s.mu.RUnlock()

	if ok {
		cancel()
	}

	return s.repo.UpdateStatus(id, domain.StatusCancelled, "Cancelled by user")
}

// RemoveDownload removes a download from the list (does not delete file).
func (s *DownloadService) RemoveDownload(id string) error {
	// Cancel if active
	s.mu.RLock()
	cancel, ok := s.cancellers[id]
	s.mu.RUnlock()
	if ok {
		cancel()
	}

	if err := s.repo.Delete(id); err != nil {
		return err
	}
	s.emitEvent("download:removed", map[string]string{"id": id})
	return nil
}

// GetAllDownloads returns all downloads.
func (s *DownloadService) GetAllDownloads() ([]*domain.Download, error) {
	return s.repo.GetAll()
}

// GetDownload returns a single download by ID.
func (s *DownloadService) GetDownload(id string) (*domain.Download, error) {
	return s.repo.GetByID(id)
}

// ── Helpers ──

func (s *DownloadService) emitEvent(eventName string, data interface{}) {
	if s.ctx != nil {
		wailsRuntime.EventsEmit(s.ctx, eventName, data)
	}
}

func (s *DownloadService) emitDownloadStatus(id string, status domain.DownloadStatus, errMsg string) {
	s.emitEvent("download:status", map[string]interface{}{
		"id":           id,
		"status":       string(status),
		"errorMessage": errMsg,
	})
}

func inferFileNameFromURL(parsed *url.URL) string {
	path := parsed.Path
	if path == "" || path == "/" {
		return "download"
	}
	// Get the last segment
	segments := splitPath(path)
	if len(segments) > 0 {
		name := segments[len(segments)-1]
		if name != "" {
			return name
		}
	}
	return "download"
}

func splitPath(path string) []string {
	var segments []string
	for _, s := range splitString(path, '/') {
		if s != "" {
			segments = append(segments, s)
		}
	}
	return segments
}

func splitString(s string, sep byte) []string {
	var parts []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	parts = append(parts, s[start:])
	return parts
}

func generateID() string {
	// Simple time-based ID with enough uniqueness for desktop app
	return fmt.Sprintf("dl_%d", time.Now().UnixNano())
}

package main

import (
	"context"
	"download-manager-wails/internal/domain"
	"download-manager-wails/internal/downloader"
	"download-manager-wails/internal/orchestrator"
	"download-manager-wails/internal/services"
	"download-manager-wails/internal/storage"
	"fmt"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strconv"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct holds the application state and services.
type App struct {
	ctx          context.Context
	db           *storage.Database
	repo         *storage.DownloadRepository
	historyRepo  *storage.HistoryRepository
	settings     *services.SettingsService
	orchestrator *orchestrator.Orchestrator
}

// NewApp creates a new App application struct.
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize database
	dbPath, err := storage.DefaultDBPath()
	if err != nil {
		log.Fatalf("Failed to determine database path: %v", err)
	}

	db, err := storage.NewDatabase(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	a.db = db

	// Initialize services
	a.settings = services.NewSettingsService(db.DB)
	if err := a.settings.Bootstrap(); err != nil {
		log.Printf("Warning: failed to bootstrap settings: %v", err)
	}

	// Initialize repositories and orchestrator
	a.repo = storage.NewDownloadRepository(db.DB)
	a.historyRepo = storage.NewHistoryRepository(db.DB)
	engine := downloader.NewHTTPDownloader()

	maxSlots := 3
	if val, err := a.settings.Get("max_concurrent_dl"); err == nil && val != "" {
		if v, err := strconv.Atoi(val); err == nil && v > 0 {
			maxSlots = v
		}
	}

	a.orchestrator = orchestrator.NewOrchestrator(a.repo, engine, maxSlots)
	a.orchestrator.SetContext(ctx)
	a.orchestrator.SetHistoryRepo(a.historyRepo)

	// Apply connections-per-download setting
	if val, err := a.settings.Get("connections_per_download"); err == nil && val != "" {
		if v, err := strconv.Atoi(val); err == nil && v > 0 {
			a.orchestrator.SetConnectionsPerDownload(v)
		}
	}

	a.orchestrator.RestoreOnStartup()

	log.Printf("Easy Download Manager started. DB: %s, Max slots: %d", dbPath, maxSlots)
}

// shutdown is called when the app is closing.
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
	log.Println("Easy Download Manager shutdown complete.")
}

// ──────────────────────────────────────────────
// Settings Methods
// ──────────────────────────────────────────────

func (a *App) GetSettings() (string, error) {
	return a.settings.GetAllJSON()
}

func (a *App) UpdateSetting(key string, value string) error {
	err := a.settings.Set(key, value)
	if err != nil {
		return err
	}
	// Apply dynamic settings
	if key == "max_concurrent_dl" {
		if v, err := strconv.Atoi(value); err == nil {
			a.orchestrator.SetMaxSlots(v)
		}
	}
	if key == "show_notifications" {
		a.orchestrator.SetNotificationsEnabled(value == "true")
	}
	if key == "connections_per_download" {
		if v, err := strconv.Atoi(value); err == nil {
			a.orchestrator.SetConnectionsPerDownload(v)
		}
	}
	return nil
}

func (a *App) GetDefaultDownloadDir() string {
	val, err := a.settings.Get("default_download_dir")
	if err != nil || val == "" {
		return "~/Downloads"
	}
	return val
}

// ──────────────────────────────────────────────
// Download Methods
// ──────────────────────────────────────────────

// ProbeURL does a HEAD request to get file info without starting a download.
func (a *App) ProbeURL(rawURL string) (map[string]interface{}, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, fmt.Errorf("invalid URL")
	}

	engine := downloader.NewHTTPDownloader()
	totalBytes, canResume, err := engine.Probe(context.Background(), rawURL)
	if err != nil {
		return nil, fmt.Errorf("probe failed: %w", err)
	}

	// Try to get filename from HEAD response
	fileName := inferFileNameFromURL(parsed)

	// Do a HEAD to check Content-Disposition
	client := &http.Client{Timeout: 10 * time.Second}
	headReq, err := http.NewRequest(http.MethodHead, rawURL, nil)
	if err == nil {
		headReq.Header.Set("User-Agent", "EasyDownloadManager/0.1")
		if resp, err := client.Do(headReq); err == nil {
			defer resp.Body.Close()
			if cd := resp.Header.Get("Content-Disposition"); cd != "" {
				_, params, err := mime.ParseMediaType(cd)
				if err == nil {
					if fn, ok := params["filename"]; ok && fn != "" {
						fileName = fn
					}
				}
			}
			// Add extension from Content-Type if missing
			if filepath.Ext(fileName) == "" {
				ct := resp.Header.Get("Content-Type")
				if ct != "" {
					mediaType, _, _ := mime.ParseMediaType(ct)
					if mediaType != "" && mediaType != "application/octet-stream" {
						if exts, _ := mime.ExtensionsByType(mediaType); len(exts) > 0 {
							fileName += exts[0]
						}
					}
				}
			}
		}
	}

	return map[string]interface{}{
		"fileName":  fileName,
		"totalBytes": totalBytes,
		"canResume": canResume,
	}, nil
}

func (a *App) AddDownload(rawURL string, outputDir string, fileName string, startImmediately bool) (*domain.Download, error) {
	// Validate URL
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, fmt.Errorf("invalid URL: must be http or https")
	}

	if outputDir == "" {
		val, err := a.settings.Get("default_download_dir")
		if err != nil || val == "" {
			return nil, fmt.Errorf("no output directory specified")
		}
		outputDir = val
	}

	if fileName == "" {
		fileName = inferFileNameFromURL(parsed)
	}

	now := time.Now()
	dl := &domain.Download{
		ID:              fmt.Sprintf("dl_%d", now.UnixNano()),
		URL:             rawURL,
		OriginalURL:     rawURL,
		FileName:        fileName,
		OutputDirectory: outputDir,
		Status:          domain.StatusQueued,
		CreatedAt:       now,
		LastUpdatedAt:   now,
		SourceHost:      parsed.Hostname(),
	}

	if err := a.repo.Create(dl); err != nil {
		return nil, fmt.Errorf("save download: %w", err)
	}

	wailsRuntime.EventsEmit(a.ctx, "download:added", dl)
	a.orchestrator.Enqueue(dl, startImmediately)

	return dl, nil
}

func (a *App) StartDownload(id string) error {
	return a.orchestrator.Start(id)
}

func (a *App) PauseDownload(id string) error {
	return a.orchestrator.Pause(id)
}

func (a *App) CancelDownload(id string) error {
	return a.orchestrator.Cancel(id)
}

func (a *App) RetryDownload(id string) error {
	dl, err := a.repo.GetByID(id)
	if err != nil {
		return err
	}
	if dl.Status != domain.StatusFailed && dl.Status != domain.StatusInterrupted && dl.Status != domain.StatusCancelled {
		return fmt.Errorf("cannot retry download in status %s", dl.Status)
	}
	// Reset status to queued
	_ = a.repo.UpdateStatus(id, domain.StatusQueued, "")
	wailsRuntime.EventsEmit(a.ctx, "download:status", map[string]interface{}{
		"id":           id,
		"status":       string(domain.StatusQueued),
		"errorMessage": "",
	})
	return a.orchestrator.Start(id)
}

func (a *App) RemoveDownload(id string) error {
	return a.orchestrator.Remove(id)
}

// RemoveDownloadAndFile removes the download entry and deletes the downloaded file from disk.
func (a *App) RemoveDownloadAndFile(id string) error {
	dl, err := a.repo.GetByID(id)
	if err != nil {
		return a.orchestrator.Remove(id)
	}
	// Delete the file from disk
	if dl.TargetPath != "" {
		os.Remove(dl.TargetPath)
	}
	// Also clean up any temp/partial files
	if dl.TempPath != "" {
		os.Remove(dl.TempPath)
	}
	return a.orchestrator.Remove(id)
}

func (a *App) GetAllDownloads() ([]*domain.Download, error) {
	return a.repo.GetAll()
}

func (a *App) GetDownload(id string) (*domain.Download, error) {
	return a.repo.GetByID(id)
}

// ──────────────────────────────────────────────
// History Methods
// ──────────────────────────────────────────────

func (a *App) GetHistory() ([]*domain.HistoryEntry, error) {
	return a.historyRepo.GetAll()
}

func (a *App) SearchHistory(query string) ([]*domain.HistoryEntry, error) {
	return a.historyRepo.Search(query)
}

func (a *App) ClearHistory() error {
	return a.historyRepo.ClearAll()
}

func (a *App) DeleteHistoryEntry(id string) error {
	return a.historyRepo.Delete(id)
}

// ──────────────────────────────────────────────
// File System Methods
// ──────────────────────────────────────────────

func (a *App) SelectDirectory() (string, error) {
	dir, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Download Folder",
	})
	if err != nil {
		return "", fmt.Errorf("directory dialog: %w", err)
	}
	return dir, nil
}

// OpenFile opens the file with the default system application.
func (a *App) OpenFile(path string) error {
	if goruntime.GOOS == "darwin" {
		return exec.Command("open", path).Start()
	}
	return exec.Command("xdg-open", path).Start()
}

// RevealInFolder opens the folder containing the file.
func (a *App) RevealInFolder(path string) error {
	if goruntime.GOOS == "darwin" {
		return exec.Command("open", "-R", path).Start()
	}
	return exec.Command("xdg-open", path).Start()
}

// ── Helpers ──

func inferFileNameFromURL(parsed *url.URL) string {
	path := parsed.Path
	if path == "" || path == "/" {
		return "download"
	}
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' {
			name := path[i+1:]
			if name != "" {
				// URL-decode the filename
				if decoded, err := url.PathUnescape(name); err == nil {
					name = decoded
				}
				return name
			}
		}
	}
	return "download"
}

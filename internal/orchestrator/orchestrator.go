package orchestrator

import (
	"context"
	"download-manager-wails/internal/domain"
	"download-manager-wails/internal/downloader"
	"download-manager-wails/internal/storage"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gen2brain/beeep"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Orchestrator manages concurrent downloads with a configurable slot limit.
// It owns the download lifecycle: starting, queueing, pausing, resuming, cancelling.
type Orchestrator struct {
	ctx                  context.Context
	repo                 *storage.DownloadRepository
	historyRepo          *storage.HistoryRepository
	engine               downloader.Downloader
	maxSlots             int
	connectionsPerDL     int
	notificationsEnabled bool
	mu                   sync.Mutex
	active               map[string]context.CancelFunc
	paused               map[string]bool
	queueOrder           []string
}

// NewOrchestrator creates a new download orchestrator.
func NewOrchestrator(repo *storage.DownloadRepository, engine downloader.Downloader, maxSlots int) *Orchestrator {
	if maxSlots < 1 {
		maxSlots = 3
	}
	return &Orchestrator{
		repo:                 repo,
		engine:               engine,
		maxSlots:             maxSlots,
		connectionsPerDL:     4,
		notificationsEnabled: true,
		active:               make(map[string]context.CancelFunc),
		paused:               make(map[string]bool),
	}
}

// SetContext sets the Wails context for event emission.
func (o *Orchestrator) SetContext(ctx context.Context) {
	o.ctx = ctx
}

// SetHistoryRepo sets the history repository for recording download outcomes.
func (o *Orchestrator) SetHistoryRepo(repo *storage.HistoryRepository) {
	o.historyRepo = repo
}

// SetNotificationsEnabled enables or disables native OS notifications.
func (o *Orchestrator) SetNotificationsEnabled(enabled bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.notificationsEnabled = enabled
}

// SetConnectionsPerDownload sets the number of parallel connections per download.
func (o *Orchestrator) SetConnectionsPerDownload(n int) {
	o.mu.Lock()
	defer o.mu.Unlock()
	if n < 1 {
		n = 1
	}
	if n > 16 {
		n = 16
	}
	o.connectionsPerDL = n
}

// SetMaxSlots updates the maximum concurrent download slots.
func (o *Orchestrator) SetMaxSlots(max int) {
	o.mu.Lock()
	defer o.mu.Unlock()
	if max < 1 {
		max = 1
	}
	o.maxSlots = max
	// Try to start queued downloads if we have new capacity
	o.processQueueLocked()
}

// Enqueue adds a download and either starts it immediately or queues it.
func (o *Orchestrator) Enqueue(dl *domain.Download, startImmediately bool) {
	o.mu.Lock()
	defer o.mu.Unlock()

	if startImmediately && len(o.active) < o.maxSlots {
		// Start immediately — we have capacity
		go o.startDownloadLocked(dl)
	} else {
		// Queue it
		o.queueOrder = append(o.queueOrder, dl.ID)
		if startImmediately {
			// Mark as queued but try to process
			o.processQueueLocked()
		}
	}
}

// Start begins or resumes a specific download.
func (o *Orchestrator) Start(id string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	// If paused, it was previously running — resume
	if o.paused[id] {
		delete(o.paused, id)
	}

	dl, err := o.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("download not found: %w", err)
	}

	if dl.Status != domain.StatusQueued && dl.Status != domain.StatusPaused && dl.Status != domain.StatusFailed && dl.Status != domain.StatusInterrupted {
		return fmt.Errorf("cannot start download in status %s", dl.Status)
	}

	if len(o.active) >= o.maxSlots {
		// Queue it
		_ = o.repo.UpdateStatus(id, domain.StatusQueued, "")
		o.emitStatus(id, domain.StatusQueued, "")
		// Add to queue if not already there
		if !o.isInQueue(id) {
			o.queueOrder = append(o.queueOrder, id)
		}
		return nil
	}

	go o.startDownloadLocked(dl)
	return nil
}

// Pause pauses an active download.
func (o *Orchestrator) Pause(id string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	cancel, ok := o.active[id]
	if !ok {
		return fmt.Errorf("download %s is not active", id)
	}

	o.paused[id] = true
	cancel() // Cancel the context — the goroutine will handle the paused state

	return nil
}

// Cancel cancels an active or queued download.
func (o *Orchestrator) Cancel(id string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	// Cancel active download
	if cancel, ok := o.active[id]; ok {
		cancel()
		delete(o.active, id)
	}

	// Remove from queue
	o.removeFromQueue(id)
	delete(o.paused, id)

	_ = o.repo.UpdateStatus(id, domain.StatusCancelled, "Cancelled by user")
	o.emitStatus(id, domain.StatusCancelled, "Cancelled by user")

	// Process queue since we freed a slot
	o.processQueueLocked()

	return nil
}

// Remove removes a download entirely.
func (o *Orchestrator) Remove(id string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	// Cancel if active
	if cancel, ok := o.active[id]; ok {
		cancel()
		delete(o.active, id)
	}

	o.removeFromQueue(id)
	delete(o.paused, id)

	if err := o.repo.Delete(id); err != nil {
		return err
	}


	o.emitEvent("download:removed", map[string]string{"id": id})
	o.processQueueLocked()
	return nil
}

// ActiveCount returns the number of currently active downloads.
func (o *Orchestrator) ActiveCount() int {
	o.mu.Lock()
	defer o.mu.Unlock()
	return len(o.active)
}

// RestoreOnStartup handles interrupted downloads from a previous session.
func (o *Orchestrator) RestoreOnStartup() {
	// Mark any "downloading" items as interrupted (they can't be in that state after restart)
	downloads, err := o.repo.GetByStatus(domain.StatusDownloading)
	if err != nil {
		log.Printf("Warning: failed to get interrupted downloads: %v", err)
		return
	}
	for _, dl := range downloads {
		_ = o.repo.UpdateStatus(dl.ID, domain.StatusInterrupted, "App was closed during download")
	}
}

// ── Internal ──

func (o *Orchestrator) startDownloadLocked(dl *domain.Download) {
	ctx, cancel := context.WithCancel(context.Background())

	o.mu.Lock()
	o.active[dl.ID] = cancel
	o.mu.Unlock()

	// Update status
	_ = o.repo.UpdateStatus(dl.ID, domain.StatusDownloading, "")
	o.emitStatus(dl.ID, domain.StatusDownloading, "")

	req := downloader.DownloadRequest{
		URL:             dl.URL,
		OutputDirectory: dl.OutputDirectory,
		FileName:        dl.FileName,
		TempPath:        dl.TempPath,
		Connections:     o.connectionsPerDL,
	}

	result := o.engine.Download(ctx, req, func(update downloader.ProgressUpdate) {
		// Persist progress (throttled by the engine)
		_ = o.repo.UpdateProgress(dl.ID, update.DownloadedBytes, update.TotalBytes,
			update.ProgressPercent, update.SpeedBytesPerSec, update.ETASeconds)

		// Emit real-time event
		eventData := map[string]interface{}{
			"id":               dl.ID,
			"downloadedBytes":  update.DownloadedBytes,
			"totalBytes":       update.TotalBytes,
			"progressPercent":  update.ProgressPercent,
			"speedBytesPerSec": update.SpeedBytesPerSec,
			"etaSeconds":       update.ETASeconds,
		}
		if update.Segments != nil {
			eventData["segments"] = update.Segments
		}
		o.emitEvent("download:progress", eventData)
	})

	// Download finished — remove from active
	o.mu.Lock()
	delete(o.active, dl.ID)
	wasPaused := o.paused[dl.ID]
	delete(o.paused, dl.ID)
	o.mu.Unlock()

	if result.Error != nil {
		if wasPaused {
			_ = o.repo.UpdateStatus(dl.ID, domain.StatusPaused, "")
			o.emitStatus(dl.ID, domain.StatusPaused, "")
		} else if ctx.Err() != nil {
			// Already handled by Cancel — don't double-update
		} else {
			_ = o.repo.UpdateStatus(dl.ID, domain.StatusFailed, result.Error.Error())
			o.emitStatus(dl.ID, domain.StatusFailed, result.Error.Error())
			o.recordHistory(dl, domain.OutcomeFailed)
		}
	} else {
		updated, _ := o.repo.GetByID(dl.ID)
		if updated != nil {
			updated.Status = domain.StatusCompleted
			updated.FileName = result.FileName
			updated.TargetPath = result.TargetPath
			updated.TotalBytes = result.TotalBytes
			updated.DownloadedBytes = result.TotalBytes
			updated.ProgressPercent = 100
			updated.SpeedBytesPerSec = 0
			updated.ETASeconds = 0
			updated.MimeType = result.MimeType
			updated.CanResume = result.CanResume
			updated.Resumable = result.Resumable
			updated.SourceHost = result.SourceHost
			now := time.Now()
			updated.CompletedAt = &now
			_ = o.repo.Update(updated)
			o.recordHistory(updated, domain.OutcomeCompleted)
		}
		o.emitStatus(dl.ID, domain.StatusCompleted, "")
		o.sendNotification("Download Complete", dl.FileName+" has finished downloading.")
	}

	// Process queue — a slot freed up
	o.mu.Lock()
	o.processQueueLocked()
	o.mu.Unlock()
}

func (o *Orchestrator) processQueueLocked() {
	for len(o.active) < o.maxSlots && len(o.queueOrder) > 0 {
		nextID := o.queueOrder[0]
		o.queueOrder = o.queueOrder[1:]

		dl, err := o.repo.GetByID(nextID)
		if err != nil || dl == nil {
			continue
		}
		// Only start if still in a startable state
		if dl.Status == domain.StatusQueued || dl.Status == domain.StatusPaused {
			go o.startDownloadLocked(dl)
		}
	}
}

func (o *Orchestrator) isInQueue(id string) bool {
	for _, qid := range o.queueOrder {
		if qid == id {
			return true
		}
	}
	return false
}

func (o *Orchestrator) removeFromQueue(id string) {
	for i, qid := range o.queueOrder {
		if qid == id {
			o.queueOrder = append(o.queueOrder[:i], o.queueOrder[i+1:]...)
			return
		}
	}
}

func (o *Orchestrator) emitEvent(eventName string, data interface{}) {
	if o.ctx != nil {
		wailsRuntime.EventsEmit(o.ctx, eventName, data)
	}
}

func (o *Orchestrator) emitStatus(id string, status domain.DownloadStatus, errMsg string) {
	o.emitEvent("download:status", map[string]interface{}{
		"id":           id,
		"status":       string(status),
		"errorMessage": errMsg,
	})
}

func (o *Orchestrator) recordHistory(dl *domain.Download, outcome domain.HistoryOutcome) {
	if o.historyRepo == nil {
		return
	}
	entry := storage.RecordFromDownload(dl, outcome, 1)
	if err := o.historyRepo.Create(entry); err != nil {
		log.Printf("Warning: failed to record history: %v", err)
	}
}

func (o *Orchestrator) sendNotification(title, message string) {
	o.mu.Lock()
	enabled := o.notificationsEnabled
	o.mu.Unlock()

	if !enabled {
		return
	}

	go func() {
		if err := beeep.Notify(title, message, ""); err != nil {
			log.Printf("Warning: failed to send notification: %v", err)
		}
	}()
}

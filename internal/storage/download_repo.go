package storage

import (
	"database/sql"
	"download-manager-wails/internal/domain"
	"fmt"
	"time"
)

// DownloadRepository handles SQLite CRUD for download records.
type DownloadRepository struct {
	db *sql.DB
}

// NewDownloadRepository creates a new repository.
func NewDownloadRepository(db *sql.DB) *DownloadRepository {
	return &DownloadRepository{db: db}
}

// Create inserts a new download record.
func (r *DownloadRepository) Create(d *domain.Download) error {
	_, err := r.db.Exec(`
		INSERT INTO downloads (
			id, url, original_url, file_name, output_directory, target_path, temp_path,
			status, progress_percent, downloaded_bytes, total_bytes, speed_bps, eta_seconds,
			source_host, mime_type, can_resume, resumable, error_message,
			created_at, started_at, completed_at, last_updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		d.ID, d.URL, d.OriginalURL, d.FileName, d.OutputDirectory, d.TargetPath, d.TempPath,
		string(d.Status), d.ProgressPercent, d.DownloadedBytes, d.TotalBytes, d.SpeedBytesPerSec, d.ETASeconds,
		d.SourceHost, d.MimeType, boolToInt(d.CanResume), boolToInt(d.Resumable), d.ErrorMessage,
		d.CreatedAt, timeToNullable(d.StartedAt), timeToNullable(d.CompletedAt), d.LastUpdatedAt,
	)
	return err
}

// Update updates an existing download record.
func (r *DownloadRepository) Update(d *domain.Download) error {
	d.LastUpdatedAt = time.Now()
	_, err := r.db.Exec(`
		UPDATE downloads SET
			url = ?, original_url = ?, file_name = ?, output_directory = ?, target_path = ?, temp_path = ?,
			status = ?, progress_percent = ?, downloaded_bytes = ?, total_bytes = ?, speed_bps = ?, eta_seconds = ?,
			source_host = ?, mime_type = ?, can_resume = ?, resumable = ?, error_message = ?,
			started_at = ?, completed_at = ?, last_updated_at = ?
		WHERE id = ?`,
		d.URL, d.OriginalURL, d.FileName, d.OutputDirectory, d.TargetPath, d.TempPath,
		string(d.Status), d.ProgressPercent, d.DownloadedBytes, d.TotalBytes, d.SpeedBytesPerSec, d.ETASeconds,
		d.SourceHost, d.MimeType, boolToInt(d.CanResume), boolToInt(d.Resumable), d.ErrorMessage,
		timeToNullable(d.StartedAt), timeToNullable(d.CompletedAt), d.LastUpdatedAt,
		d.ID,
	)
	return err
}

// GetByID retrieves a download by ID.
func (r *DownloadRepository) GetByID(id string) (*domain.Download, error) {
	row := r.db.QueryRow(`SELECT
		id, url, original_url, file_name, output_directory, target_path, temp_path,
		status, progress_percent, downloaded_bytes, total_bytes, speed_bps, eta_seconds,
		source_host, mime_type, can_resume, resumable, error_message,
		created_at, started_at, completed_at, last_updated_at
		FROM downloads WHERE id = ?`, id)
	return scanDownload(row)
}

// GetAll retrieves all downloads ordered by creation time.
func (r *DownloadRepository) GetAll() ([]*domain.Download, error) {
	rows, err := r.db.Query(`SELECT
		id, url, original_url, file_name, output_directory, target_path, temp_path,
		status, progress_percent, downloaded_bytes, total_bytes, speed_bps, eta_seconds,
		source_host, mime_type, can_resume, resumable, error_message,
		created_at, started_at, completed_at, last_updated_at
		FROM downloads ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var downloads []*domain.Download
	for rows.Next() {
		d, err := scanDownloadRow(rows)
		if err != nil {
			return nil, err
		}
		downloads = append(downloads, d)
	}
	return downloads, rows.Err()
}

// GetByStatus retrieves downloads with a specific status.
func (r *DownloadRepository) GetByStatus(status domain.DownloadStatus) ([]*domain.Download, error) {
	rows, err := r.db.Query(`SELECT
		id, url, original_url, file_name, output_directory, target_path, temp_path,
		status, progress_percent, downloaded_bytes, total_bytes, speed_bps, eta_seconds,
		source_host, mime_type, can_resume, resumable, error_message,
		created_at, started_at, completed_at, last_updated_at
		FROM downloads WHERE status = ? ORDER BY created_at DESC`, string(status))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var downloads []*domain.Download
	for rows.Next() {
		d, err := scanDownloadRow(rows)
		if err != nil {
			return nil, err
		}
		downloads = append(downloads, d)
	}
	return downloads, rows.Err()
}

// Delete removes a download by ID.
func (r *DownloadRepository) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM downloads WHERE id = ?`, id)
	return err
}

// UpdateProgress updates only the progress-related fields (called frequently).
func (r *DownloadRepository) UpdateProgress(id string, downloaded int64, total int64, progress float64, speed int64, eta float64) error {
	_, err := r.db.Exec(`
		UPDATE downloads SET
			downloaded_bytes = ?, total_bytes = ?, progress_percent = ?,
			speed_bps = ?, eta_seconds = ?, last_updated_at = ?
		WHERE id = ?`,
		downloaded, total, progress, speed, eta, time.Now(), id,
	)
	return err
}

// UpdateStatus updates the status field.
func (r *DownloadRepository) UpdateStatus(id string, status domain.DownloadStatus, errMsg string) error {
	now := time.Now()
	var completedAt interface{} = nil
	var startedAt interface{} = nil

	if status == domain.StatusDownloading {
		startedAt = now
	}
	if status == domain.StatusCompleted || status == domain.StatusFailed || status == domain.StatusCancelled {
		completedAt = now
	}

	_, err := r.db.Exec(`
		UPDATE downloads SET
			status = ?, error_message = ?, last_updated_at = ?,
			started_at = COALESCE(?, started_at),
			completed_at = COALESCE(?, completed_at)
		WHERE id = ?`,
		string(status), errMsg, now, startedAt, completedAt, id,
	)
	return err
}

// ── Scan Helpers ──

type scannable interface {
	Scan(dest ...interface{}) error
}

func scanDownload(s scannable) (*domain.Download, error) {
	d := &domain.Download{}
	var status string
	var canResume, resumable int
	var startedAt, completedAt sql.NullTime

	err := s.Scan(
		&d.ID, &d.URL, &d.OriginalURL, &d.FileName, &d.OutputDirectory, &d.TargetPath, &d.TempPath,
		&status, &d.ProgressPercent, &d.DownloadedBytes, &d.TotalBytes, &d.SpeedBytesPerSec, &d.ETASeconds,
		&d.SourceHost, &d.MimeType, &canResume, &resumable, &d.ErrorMessage,
		&d.CreatedAt, &startedAt, &completedAt, &d.LastUpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	d.Status = domain.DownloadStatus(status)
	d.CanResume = canResume == 1
	d.Resumable = resumable == 1
	if startedAt.Valid {
		d.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		d.CompletedAt = &completedAt.Time
	}
	return d, nil
}

func scanDownloadRow(rows *sql.Rows) (*domain.Download, error) {
	return scanDownload(rows)
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func timeToNullable(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return *t
}

// FormatError safely returns an error message for DB storage.
func FormatError(err error) string {
	if err == nil {
		return ""
	}
	return fmt.Sprintf("%v", err)
}

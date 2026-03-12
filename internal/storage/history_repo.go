package storage

import (
	"database/sql"
	"download-manager-wails/internal/domain"
	"fmt"
	"time"
)

// HistoryRepository handles SQLite CRUD for download history records.
type HistoryRepository struct {
	db *sql.DB
}

// NewHistoryRepository creates a new history repository.
func NewHistoryRepository(db *sql.DB) *HistoryRepository {
	return &HistoryRepository{db: db}
}

// Create inserts a new history entry.
func (r *HistoryRepository) Create(h *domain.HistoryEntry) error {
	_, err := r.db.Exec(`
		INSERT INTO download_history (
			id, download_id, url, file_name, target_path, final_status,
			total_bytes, started_at, ended_at, attempt_number, action_summary,
			error_message, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		h.ID, h.DownloadID, h.URL, h.FileName, h.TargetPath, string(h.FinalStatus),
		h.TotalBytes, timeToNullable(h.StartedAt), timeToNullable(h.EndedAt),
		h.AttemptNumber, h.ActionSummary, h.ErrorMessage, h.CreatedAt,
	)
	return err
}

// GetAll retrieves all history entries ordered by creation time.
func (r *HistoryRepository) GetAll() ([]*domain.HistoryEntry, error) {
	return r.query(`SELECT
		id, download_id, url, file_name, target_path, final_status,
		total_bytes, started_at, ended_at, attempt_number, action_summary,
		error_message, created_at
		FROM download_history ORDER BY created_at DESC`)
}

// Search queries history by file name or URL.
func (r *HistoryRepository) Search(query string) ([]*domain.HistoryEntry, error) {
	pattern := "%" + query + "%"
	return r.query(`SELECT
		id, download_id, url, file_name, target_path, final_status,
		total_bytes, started_at, ended_at, attempt_number, action_summary,
		error_message, created_at
		FROM download_history
		WHERE file_name LIKE ? OR url LIKE ?
		ORDER BY created_at DESC`, pattern, pattern)
}

// GetByStatus retrieves history entries by final status.
func (r *HistoryRepository) GetByStatus(status domain.HistoryOutcome) ([]*domain.HistoryEntry, error) {
	return r.query(`SELECT
		id, download_id, url, file_name, target_path, final_status,
		total_bytes, started_at, ended_at, attempt_number, action_summary,
		error_message, created_at
		FROM download_history WHERE final_status = ? ORDER BY created_at DESC`, string(status))
}

// Delete removes a history entry by ID.
func (r *HistoryRepository) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM download_history WHERE id = ?`, id)
	return err
}

// ClearAll removes all history entries.
func (r *HistoryRepository) ClearAll() error {
	_, err := r.db.Exec(`DELETE FROM download_history`)
	return err
}

// ── Internal ──

func (r *HistoryRepository) query(queryStr string, args ...interface{}) ([]*domain.HistoryEntry, error) {
	rows, err := r.db.Query(queryStr, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*domain.HistoryEntry
	for rows.Next() {
		h := &domain.HistoryEntry{}
		var finalStatus string
		var startedAt, endedAt sql.NullTime

		err := rows.Scan(
			&h.ID, &h.DownloadID, &h.URL, &h.FileName, &h.TargetPath, &finalStatus,
			&h.TotalBytes, &startedAt, &endedAt, &h.AttemptNumber, &h.ActionSummary,
			&h.ErrorMessage, &h.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		h.FinalStatus = domain.HistoryOutcome(finalStatus)
		if startedAt.Valid {
			h.StartedAt = &startedAt.Time
		}
		if endedAt.Valid {
			h.EndedAt = &endedAt.Time
		}
		entries = append(entries, h)
	}
	return entries, rows.Err()
}

// RecordFromDownload creates a history entry from a completed/failed/cancelled download.
func RecordFromDownload(dl *domain.Download, outcome domain.HistoryOutcome, attempt int) *domain.HistoryEntry {
	now := time.Now()
	return &domain.HistoryEntry{
		ID:            fmt.Sprintf("hist_%d", now.UnixNano()),
		DownloadID:    dl.ID,
		URL:           dl.URL,
		FileName:      dl.FileName,
		TargetPath:    dl.TargetPath,
		FinalStatus:   outcome,
		TotalBytes:    dl.TotalBytes,
		StartedAt:     dl.StartedAt,
		EndedAt:       &now,
		AttemptNumber: attempt,
		ActionSummary: string(outcome),
		ErrorMessage:  dl.ErrorMessage,
		CreatedAt:     now,
	}
}

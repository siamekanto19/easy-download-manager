package services

import (
	"database/sql"
	"download-manager-wails/internal/domain"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
)

// SettingsService manages application settings stored in SQLite.
type SettingsService struct {
	db *sql.DB
}

// NewSettingsService creates a new settings service.
func NewSettingsService(db *sql.DB) *SettingsService {
	return &SettingsService{db: db}
}

// Bootstrap ensures default settings exist.
func (s *SettingsService) Bootstrap() error {
	defaults := domain.DefaultSettings()

	// Resolve default download dir
	if defaults.DefaultDownloadDir == "" {
		home, err := os.UserHomeDir()
		if err == nil {
			defaults.DefaultDownloadDir = filepath.Join(home, "Downloads")
		}
	}

	pairs := map[string]string{
		"default_download_dir":    defaults.DefaultDownloadDir,
		"max_concurrent_dl":       strconv.Itoa(defaults.MaxConcurrentDL),
		"duplicate_behavior":      defaults.DuplicateBehavior,
		"show_notifications":      strconv.FormatBool(defaults.ShowNotifications),
		"confirm_on_close_active": strconv.FormatBool(defaults.ConfirmOnCloseActive),
	}

	for key, value := range pairs {
		_, err := s.db.Exec(
			`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
			key, value,
		)
		if err != nil {
			return fmt.Errorf("bootstrap setting %s: %w", key, err)
		}
	}
	return nil
}

// Get retrieves a single setting value.
func (s *SettingsService) Get(key string) (string, error) {
	var value string
	err := s.db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

// Set stores a single setting value.
func (s *SettingsService) Set(key, value string) error {
	_, err := s.db.Exec(
		`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		key, value,
	)
	return err
}

// GetAll retrieves all settings as a domain.Settings struct.
func (s *SettingsService) GetAll() (domain.Settings, error) {
	settings := domain.DefaultSettings()

	rows, err := s.db.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return settings, err
	}
	defer rows.Close()

	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		switch key {
		case "default_download_dir":
			settings.DefaultDownloadDir = value
		case "max_concurrent_dl":
			if v, err := strconv.Atoi(value); err == nil {
				settings.MaxConcurrentDL = v
			}
		case "duplicate_behavior":
			settings.DuplicateBehavior = value
		case "show_notifications":
			settings.ShowNotifications = value == "true"
		case "confirm_on_close_active":
			settings.ConfirmOnCloseActive = value == "true"
		}
	}
	return settings, rows.Err()
}

// GetAllJSON returns settings as a JSON string (for Wails binding convenience).
func (s *SettingsService) GetAllJSON() (string, error) {
	settings, err := s.GetAll()
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(settings)
	return string(b), err
}

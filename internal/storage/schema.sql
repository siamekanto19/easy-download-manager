-- Easy Download Manager — Database Schema
-- SQLite with modernc.org/sqlite (pure Go)

CREATE TABLE IF NOT EXISTS downloads (
    id               TEXT PRIMARY KEY,
    url              TEXT NOT NULL,
    original_url     TEXT NOT NULL DEFAULT '',
    file_name        TEXT NOT NULL,
    output_directory TEXT NOT NULL,
    target_path      TEXT NOT NULL DEFAULT '',
    temp_path        TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'queued',
    progress_percent REAL NOT NULL DEFAULT 0,
    downloaded_bytes INTEGER NOT NULL DEFAULT 0,
    total_bytes      INTEGER NOT NULL DEFAULT 0,
    speed_bps        INTEGER NOT NULL DEFAULT 0,
    eta_seconds      REAL NOT NULL DEFAULT 0,
    source_host      TEXT NOT NULL DEFAULT '',
    mime_type        TEXT NOT NULL DEFAULT '',
    can_resume       INTEGER NOT NULL DEFAULT 0,
    resumable        INTEGER NOT NULL DEFAULT 0,
    error_message    TEXT NOT NULL DEFAULT '',
    created_at       DATETIME NOT NULL DEFAULT (datetime('now')),
    started_at       DATETIME,
    completed_at     DATETIME,
    last_updated_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS download_history (
    id              TEXT PRIMARY KEY,
    download_id     TEXT NOT NULL,
    url             TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    target_path     TEXT NOT NULL DEFAULT '',
    final_status    TEXT NOT NULL,
    total_bytes     INTEGER NOT NULL DEFAULT 0,
    started_at      DATETIME,
    ended_at        DATETIME,
    attempt_number  INTEGER NOT NULL DEFAULT 1,
    action_summary  TEXT NOT NULL DEFAULT '',
    error_message   TEXT NOT NULL DEFAULT '',
    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_download_id ON download_history(download_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON download_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_final_status ON download_history(final_status);

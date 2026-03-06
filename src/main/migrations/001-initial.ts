export const INITIAL_MIGRATION = `
  CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    output_directory TEXT NOT NULL,
    target_path TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    progress_percent REAL DEFAULT 0,
    downloaded_bytes INTEGER DEFAULT 0,
    total_bytes INTEGER,
    speed_bytes_per_sec REAL DEFAULT 0,
    eta_seconds REAL,
    source_host TEXT,
    error_message TEXT,
    can_resume INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    last_updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS download_history (
    id TEXT PRIMARY KEY,
    download_id TEXT,
    url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    target_path TEXT,
    final_status TEXT NOT NULL,
    total_bytes INTEGER,
    started_at TEXT,
    ended_at TEXT,
    action_summary TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
  CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at);
  CREATE INDEX IF NOT EXISTS idx_history_download_id ON download_history(download_id);
  CREATE INDEX IF NOT EXISTS idx_history_final_status ON download_history(final_status);
  CREATE INDEX IF NOT EXISTS idx_history_created_at ON download_history(created_at);
`

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { INITIAL_MIGRATION } from '../migrations/001-initial'
import type { DownloadRecord, DownloadHistoryRecord, SettingsRecord } from '../../shared/types'

let db: Database.Database | null = null

function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  return join(dbDir, 'downloads.db')
}

export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  return db
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function runMigrations(database: Database.Database): void {
  const migrations = [{ name: '001-initial', sql: INITIAL_MIGRATION }]

  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `)

  const appliedStmt = database.prepare('SELECT name FROM migrations')
  const applied = new Set((appliedStmt.all() as { name: string }[]).map((row) => row.name))

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')
        .run(migration.name, new Date().toISOString())
      console.log(`[DB] Applied migration: ${migration.name}`)
    }
  }
}

// ----- Download CRUD -----

function rowToDownload(row: Record<string, unknown>): DownloadRecord {
  return {
    id: row.id as string,
    url: row.url as string,
    fileName: row.file_name as string,
    outputDirectory: row.output_directory as string,
    targetPath: (row.target_path as string) || null,
    status: row.status as DownloadRecord['status'],
    progressPercent: (row.progress_percent as number) || 0,
    downloadedBytes: (row.downloaded_bytes as number) || 0,
    totalBytes: (row.total_bytes as number) || null,
    speedBytesPerSec: (row.speed_bytes_per_sec as number) || 0,
    etaSeconds: (row.eta_seconds as number) || null,
    sourceHost: (row.source_host as string) || null,
    errorMessage: (row.error_message as string) || null,
    canResume: Boolean(row.can_resume),
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string) || null,
    completedAt: (row.completed_at as string) || null,
    lastUpdatedAt: row.last_updated_at as string
  }
}

export function insertDownload(record: DownloadRecord): void {
  const database = getDatabase()
  database
    .prepare(
      `INSERT INTO downloads (
        id, url, file_name, output_directory, target_path, status,
        progress_percent, downloaded_bytes, total_bytes, speed_bytes_per_sec,
        eta_seconds, source_host, error_message, can_resume,
        created_at, started_at, completed_at, last_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.id,
      record.url,
      record.fileName,
      record.outputDirectory,
      record.targetPath,
      record.status,
      record.progressPercent,
      record.downloadedBytes,
      record.totalBytes,
      record.speedBytesPerSec,
      record.etaSeconds,
      record.sourceHost,
      record.errorMessage,
      record.canResume ? 1 : 0,
      record.createdAt,
      record.startedAt,
      record.completedAt,
      record.lastUpdatedAt
    )
}

export function updateDownload(
  id: string,
  fields: Partial<Omit<DownloadRecord, 'id'>>
): void {
  const database = getDatabase()
  const sets: string[] = []
  const values: unknown[] = []

  const fieldMap: Record<string, string> = {
    url: 'url',
    fileName: 'file_name',
    outputDirectory: 'output_directory',
    targetPath: 'target_path',
    status: 'status',
    progressPercent: 'progress_percent',
    downloadedBytes: 'downloaded_bytes',
    totalBytes: 'total_bytes',
    speedBytesPerSec: 'speed_bytes_per_sec',
    etaSeconds: 'eta_seconds',
    sourceHost: 'source_host',
    errorMessage: 'error_message',
    canResume: 'can_resume',
    createdAt: 'created_at',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    lastUpdatedAt: 'last_updated_at'
  }

  for (const [key, value] of Object.entries(fields)) {
    const col = fieldMap[key]
    if (col) {
      sets.push(`${col} = ?`)
      values.push(key === 'canResume' ? (value ? 1 : 0) : value)
    }
  }

  if (sets.length === 0) return

  values.push(id)
  database.prepare(`UPDATE downloads SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

export function getDownloadById(id: string): DownloadRecord | null {
  const database = getDatabase()
  const row = database.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? rowToDownload(row) : null
}

export function listDownloads(): DownloadRecord[] {
  const database = getDatabase()
  const rows = database
    .prepare('SELECT * FROM downloads ORDER BY created_at DESC')
    .all() as Record<string, unknown>[]
  return rows.map(rowToDownload)
}

export function deleteDownload(id: string): void {
  const database = getDatabase()
  database.prepare('DELETE FROM downloads WHERE id = ?').run(id)
}

// ----- History CRUD -----

function rowToHistory(row: Record<string, unknown>): DownloadHistoryRecord {
  return {
    id: row.id as string,
    downloadId: (row.download_id as string) || null,
    url: row.url as string,
    fileName: row.file_name as string,
    targetPath: (row.target_path as string) || null,
    finalStatus: row.final_status as DownloadHistoryRecord['finalStatus'],
    totalBytes: (row.total_bytes as number) || null,
    startedAt: (row.started_at as string) || null,
    endedAt: (row.ended_at as string) || null,
    actionSummary: (row.action_summary as string) || null,
    errorMessage: (row.error_message as string) || null,
    createdAt: row.created_at as string
  }
}

export function insertHistory(record: DownloadHistoryRecord): void {
  const database = getDatabase()
  database
    .prepare(
      `INSERT INTO download_history (
        id, download_id, url, file_name, target_path, final_status,
        total_bytes, started_at, ended_at, action_summary, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.id,
      record.downloadId,
      record.url,
      record.fileName,
      record.targetPath,
      record.finalStatus,
      record.totalBytes,
      record.startedAt,
      record.endedAt,
      record.actionSummary,
      record.errorMessage,
      record.createdAt
    )
}

export function listHistory(
  options: { search?: string; status?: string; limit?: number; offset?: number } = {}
): DownloadHistoryRecord[] {
  const database = getDatabase()
  const conditions: string[] = []
  const params: unknown[] = []

  if (options.search) {
    conditions.push('(file_name LIKE ? OR url LIKE ?)')
    params.push(`%${options.search}%`, `%${options.search}%`)
  }
  if (options.status) {
    conditions.push('final_status = ?')
    params.push(options.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = options.limit ? `LIMIT ${options.limit}` : ''
  const offset = options.offset ? `OFFSET ${options.offset}` : ''

  const rows = database
    .prepare(`SELECT * FROM download_history ${where} ORDER BY created_at DESC ${limit} ${offset}`)
    .all(...params) as Record<string, unknown>[]
  return rows.map(rowToHistory)
}

export function clearHistory(): void {
  const database = getDatabase()
  database.prepare('DELETE FROM download_history').run()
}

export function removeHistoryItem(id: string): void {
  const database = getDatabase()
  database.prepare('DELETE FROM download_history WHERE id = ?').run(id)
}

// ----- Settings -----

export function getSetting(key: string): string | null {
  const database = getDatabase()
  const row = database.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | SettingsRecord
    | undefined
  return row ? row.value : null
}

export function setSetting(key: string, value: string): void {
  const database = getDatabase()
  database
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const database = getDatabase()
  const rows = database.prepare('SELECT key, value FROM settings').all() as SettingsRecord[]
  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return settings
}

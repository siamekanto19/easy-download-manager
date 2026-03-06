export enum DownloadStatus {
  Queued = 'queued',
  Downloading = 'downloading',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Interrupted = 'interrupted'
}

export enum HistoryOutcome {
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Removed = 'removed',
  Interrupted = 'interrupted',
  Retried = 'retried'
}

export interface DownloadRecord {
  id: string
  url: string
  fileName: string
  outputDirectory: string
  targetPath: string | null
  status: DownloadStatus
  progressPercent: number
  downloadedBytes: number
  totalBytes: number | null
  speedBytesPerSec: number
  etaSeconds: number | null
  sourceHost: string | null
  errorMessage: string | null
  canResume: boolean
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  lastUpdatedAt: string
}

export interface DownloadHistoryRecord {
  id: string
  downloadId: string | null
  url: string
  fileName: string
  targetPath: string | null
  finalStatus: HistoryOutcome
  totalBytes: number | null
  startedAt: string | null
  endedAt: string | null
  actionSummary: string | null
  errorMessage: string | null
  createdAt: string
}

export interface SettingsRecord {
  key: string
  value: string
}

export interface AppSettings {
  downloadDirectory: string
  maxConcurrentDownloads: number
  connectionsPerDownload: number
  theme: 'system' | 'dark' | 'light'
  notificationsEnabled: boolean
  duplicateNameBehavior: 'rename' | 'overwrite' | 'skip'
  closeBehavior: 'minimize' | 'quit'
}

export type SettingsKey = keyof AppSettings

export interface DownloadProgressEvent {
  id: string
  status: DownloadStatus
  progressPercent: number
  downloadedBytes: number
  totalBytes: number | null
  speedBytesPerSec: number
  etaSeconds: number | null
}

export interface AddDownloadRequest {
  url: string
  fileName?: string
  outputDirectory?: string
  startImmediately?: boolean
}

export interface DownloadActionResult {
  success: boolean
  error?: string
}

export type ViewName = 'downloads' | 'history' | 'settings'

export type DownloadFilter = 'all' | 'active' | 'queued' | 'paused' | 'completed' | 'failed'

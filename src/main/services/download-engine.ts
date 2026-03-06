import { BrowserWindow, Notification } from 'electron'
import { join } from 'path'
import { existsSync, unlinkSync } from 'fs'
import { v4 as uuid } from 'uuid'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EasyDl = require('easydl')

import {
  insertDownload,
  updateDownload,
  getDownloadById,
  deleteDownload,
  listDownloads,
  insertHistory
} from './database'
import { getAppSettings } from './settings'
import { IPC } from '../../shared/ipc-channels'
import { DownloadStatus, HistoryOutcome } from '../../shared/types'
import type {
  DownloadRecord,
  AddDownloadRequest,
  DownloadProgressEvent,
  DownloadActionResult
} from '../../shared/types'

// ===== Types =====

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ActiveDownload {
  id: string
  instance: any
  record: DownloadRecord
  lastDbWrite: number // Timestamp of last DB progress write (throttle)
}

// ===== State =====

const activeDownloads = new Map<string, ActiveDownload>()
const DB_WRITE_THROTTLE_MS = 2000 // Write progress to DB at most every 2s
const PROGRESS_REPORT_THROTTLE_MS = 250 // Send progress to renderer at most every 250ms
const lastProgressSent = new Map<string, number>()

// ===== Helpers =====

function sendToRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}

function extractFileName(url: string): string {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const segments = pathname.split('/')
    const last = segments[segments.length - 1]
    if (last && last.includes('.')) {
      return decodeURIComponent(last)
    }
  } catch {
    // ignore
  }
  return `download-${Date.now()}`
}

function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/**
 * Generate a unique filename by appending (1), (2), etc. if the file already exists.
 */
function resolveUniqueFileName(directory: string, baseName: string): string {
  let candidate = baseName
  let counter = 1

  while (existsSync(join(directory, candidate))) {
    const dotIdx = baseName.lastIndexOf('.')
    if (dotIdx > 0) {
      const name = baseName.substring(0, dotIdx)
      const ext = baseName.substring(dotIdx)
      candidate = `${name} (${counter})${ext}`
    } else {
      candidate = `${baseName} (${counter})`
    }
    counter++
  }

  return candidate
}

// ===== Orchestrator =====

/**
 * Returns how many slots are available for new downloads.
 */
function getAvailableSlots(): number {
  const settings = getAppSettings()
  const maxConcurrent = settings.maxConcurrentDownloads || 3
  return Math.max(0, maxConcurrent - activeDownloads.size)
}

/**
 * Drains the queue by starting as many queued downloads as concurrency allows.
 * Called after any download completes, fails, is cancelled, or is paused.
 */
function drainQueue(): void {
  const slots = getAvailableSlots()
  if (slots <= 0) return

  // Get queued downloads ordered by creation time (FIFO)
  const allDownloads = listDownloads()
  const queued = allDownloads
    .filter(d => d.status === DownloadStatus.Queued)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const toStart = queued.slice(0, slots)
  for (const download of toStart) {
    startDownloadInternal(download.id)
  }
}

/**
 * Checks if an active or queued download already exists for the given URL.
 */
function checkDuplicate(url: string): { isDuplicate: boolean; existingId?: string; existingFileName?: string } {
  const allDownloads = listDownloads()
  const match = allDownloads.find(
    d => d.url === url && [
      DownloadStatus.Queued,
      DownloadStatus.Downloading,
      DownloadStatus.Paused
    ].includes(d.status as DownloadStatus)
  )

  if (match) {
    return { isDuplicate: true, existingId: match.id, existingFileName: match.fileName }
  }

  return { isDuplicate: false }
}

// ===== Core Engine =====

export async function addDownload(request: AddDownloadRequest): Promise<DownloadActionResult> {
  try {
    // Duplicate check
    const { isDuplicate, existingFileName } = checkDuplicate(request.url)
    if (isDuplicate) {
      return {
        success: false,
        error: `This URL is already being downloaded as "${existingFileName}"`
      }
    }

    const settings = getAppSettings()
    const outputDir = request.outputDirectory || settings.downloadDirectory
    const baseFileName = request.fileName || extractFileName(request.url)

    // Handle duplicate file names based on settings
    let fileName = baseFileName
    if (settings.duplicateNameBehavior === 'rename') {
      fileName = resolveUniqueFileName(outputDir, baseFileName)
    } else if (settings.duplicateNameBehavior === 'skip' && existsSync(join(outputDir, baseFileName))) {
      return { success: false, error: `File "${baseFileName}" already exists` }
    }

    const now = new Date().toISOString()
    const record: DownloadRecord = {
      id: uuid(),
      url: request.url,
      fileName,
      outputDirectory: outputDir,
      targetPath: join(outputDir, fileName),
      status: DownloadStatus.Queued,
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: null,
      speedBytesPerSec: 0,
      etaSeconds: null,
      sourceHost: extractHost(request.url),
      errorMessage: null,
      canResume: false,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      lastUpdatedAt: now
    }

    // Persist to DB
    insertDownload(record)

    // Send to renderer immediately
    sendToRenderer(IPC.DOWNLOAD_STATUS_CHANGED, {
      id: record.id,
      status: record.status,
      download: record
    })

    // If requested to start immediately, try to start via orchestrator
    if (request.startImmediately !== false) {
      const slots = getAvailableSlots()
      if (slots > 0) {
        startDownloadInternal(record.id)
      }
      // Otherwise it stays queued and will auto-start when a slot opens
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add download'
    console.error('[DownloadEngine] addDownload error:', message)
    return { success: false, error: message }
  }
}

/**
 * Internal function that actually starts a download (creates easydl instance).
 * Does NOT check concurrency — callers must check slots before calling.
 */
function startDownloadInternal(id: string): void {
  const record = getDownloadById(id)
  if (!record) {
    console.error('[DownloadEngine] Download not found:', id)
    return
  }

  if (activeDownloads.has(id)) {
    console.warn('[DownloadEngine] Download already active:', id)
    return
  }

  const now = new Date().toISOString()

  // Update status to downloading
  updateDownload(id, {
    status: DownloadStatus.Downloading,
    startedAt: record.startedAt || now,
    lastUpdatedAt: now,
    errorMessage: null
  })

  const updatedRecord = getDownloadById(id)!

  sendToRenderer(IPC.DOWNLOAD_STATUS_CHANGED, {
    id,
    status: DownloadStatus.Downloading,
    download: updatedRecord
  })

  // Create easydl instance with configurable connections
  const settings = getAppSettings()
  const dl = new EasyDl(record.url, record.targetPath || join(record.outputDirectory, record.fileName), {
    connections: settings.connectionsPerDownload || 8,
    maxRetry: 3,
    retryDelay: 1000,
    retryBackoff: 1000,
    existBehavior: 'new_file',
    reportInterval: 300
  })

  const active: ActiveDownload = {
    id,
    instance: dl,
    record: updatedRecord,
    lastDbWrite: Date.now()
  }

  activeDownloads.set(id, active)

  // Progress events — with throttling
  dl.on('progress', (progress: { total: { percentage: number; bytes: number; speed: number } }) => {
    const totalBytes = progress.total.bytes || null
    const pct = progress.total.percentage || 0
    const speed = progress.total.speed || 0

    const downloadedBytes = totalBytes ? Math.round((pct / 100) * totalBytes) : 0
    const etaSeconds = speed > 0 && totalBytes
      ? Math.round((totalBytes - downloadedBytes) / speed)
      : null

    const nowMs = Date.now()

    // Throttled DB writes (every 2 seconds max)
    if (nowMs - active.lastDbWrite >= DB_WRITE_THROTTLE_MS) {
      active.lastDbWrite = nowMs
      updateDownload(id, {
        progressPercent: Math.round(pct * 100) / 100,
        downloadedBytes,
        totalBytes,
        speedBytesPerSec: Math.round(speed),
        etaSeconds,
        lastUpdatedAt: new Date().toISOString()
      })
    }

    // Throttled renderer updates (every 250ms)
    const lastSent = lastProgressSent.get(id) || 0
    if (nowMs - lastSent >= PROGRESS_REPORT_THROTTLE_MS) {
      lastProgressSent.set(id, nowMs)

      const progressEvent: DownloadProgressEvent = {
        id,
        status: DownloadStatus.Downloading,
        progressPercent: Math.round(pct * 100) / 100,
        downloadedBytes,
        totalBytes,
        speedBytesPerSec: Math.round(speed),
        etaSeconds
      }

      sendToRenderer(IPC.DOWNLOAD_PROGRESS, progressEvent)
    }
  })

  // Metadata event
  dl.on('metadata', (meta: { size?: number }) => {
    if (meta.size) {
      updateDownload(id, { totalBytes: meta.size, lastUpdatedAt: new Date().toISOString() })
    }
  })

  // Error event
  dl.on('error', (error: Error) => {
    console.error('[DownloadEngine] Download error:', id, error.message)
    handleDownloadFailure(id, error.message)
  })

  // Wait for completion
  dl.wait()
    .then((completed: boolean) => {
      if (completed) {
        handleDownloadComplete(id)
      } else {
        if (!activeDownloads.has(id)) return // Was cancelled/paused
        handleDownloadFailure(id, 'Download incomplete')
      }
    })
    .catch((error: Error) => {
      handleDownloadFailure(id, error.message)
    })
    .finally(() => {
      activeDownloads.delete(id)
      lastProgressSent.delete(id)
      // Auto-start next queued item
      drainQueue()
    })
}

function handleDownloadComplete(id: string): void {
  const now = new Date().toISOString()

  // Final DB write with 100% progress
  updateDownload(id, {
    status: DownloadStatus.Completed,
    progressPercent: 100,
    speedBytesPerSec: 0,
    etaSeconds: null,
    completedAt: now,
    lastUpdatedAt: now
  })

  const record = getDownloadById(id)
  if (record) {
    insertHistory({
      id: uuid(),
      downloadId: id,
      url: record.url,
      fileName: record.fileName,
      targetPath: record.targetPath,
      finalStatus: HistoryOutcome.Completed,
      totalBytes: record.totalBytes,
      startedAt: record.startedAt,
      endedAt: now,
      actionSummary: 'Download completed successfully',
      errorMessage: null,
      createdAt: now
    })

    sendToRenderer(IPC.DOWNLOAD_STATUS_CHANGED, {
      id,
      status: DownloadStatus.Completed,
      download: { ...record, status: DownloadStatus.Completed, progressPercent: 100, completedAt: now }
    })
  }

  console.log('[DownloadEngine] Download completed:', id)

  // Native notification
  try {
    const settings = getAppSettings()
    if (settings.notificationsEnabled && Notification.isSupported()) {
      new Notification({
        title: 'Download Complete',
        body: record?.fileName ?? 'File downloaded successfully'
      }).show()
    }
  } catch { /* ignore notification errors */ }
}

function handleDownloadFailure(id: string, errorMessage: string): void {
  const now = new Date().toISOString()

  updateDownload(id, {
    status: DownloadStatus.Failed,
    speedBytesPerSec: 0,
    etaSeconds: null,
    errorMessage,
    lastUpdatedAt: now
  })

  const record = getDownloadById(id)
  if (record) {
    insertHistory({
      id: uuid(),
      downloadId: id,
      url: record.url,
      fileName: record.fileName,
      targetPath: record.targetPath,
      finalStatus: HistoryOutcome.Failed,
      totalBytes: record.totalBytes,
      startedAt: record.startedAt,
      endedAt: now,
      actionSummary: 'Download failed',
      errorMessage,
      createdAt: now
    })

    sendToRenderer(IPC.DOWNLOAD_STATUS_CHANGED, {
      id,
      status: DownloadStatus.Failed,
      download: { ...record, status: DownloadStatus.Failed, errorMessage }
    })
  }

  console.error('[DownloadEngine] Download failed:', id, errorMessage)

  // Native notification
  try {
    const settings = getAppSettings()
    if (settings.notificationsEnabled && Notification.isSupported()) {
      new Notification({
        title: 'Download Failed',
        body: `${record?.fileName ?? 'Download'}: ${errorMessage}`
      }).show()
    }
  } catch { /* ignore notification errors */ }
}

// ===== Control Actions =====

export function pauseDownload(id: string): DownloadActionResult {
  const active = activeDownloads.get(id)
  if (!active) {
    return { success: false, error: 'Download is not active' }
  }

  try {
    active.instance.destroy()
    activeDownloads.delete(id)
    lastProgressSent.delete(id)

    const now = new Date().toISOString()
    updateDownload(id, {
      status: DownloadStatus.Paused,
      speedBytesPerSec: 0,
      etaSeconds: null,
      lastUpdatedAt: now
    })

    const record = getDownloadById(id)
    if (record) {
      sendToRenderer(IPC.DOWNLOAD_STATUS_CHANGED, {
        id,
        status: DownloadStatus.Paused,
        download: record
      })
    }

    // A slot opened — try to start a queued download
    drainQueue()

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to pause' }
  }
}

export function resumeDownload(id: string): DownloadActionResult {
  const record = getDownloadById(id)
  if (!record) {
    return { success: false, error: 'Download not found' }
  }

  if (record.status !== DownloadStatus.Paused && record.status !== DownloadStatus.Failed) {
    return { success: false, error: `Cannot resume a ${record.status} download` }
  }

  // Check if we have a slot
  const slots = getAvailableSlots()
  if (slots > 0) {
    startDownloadInternal(id)
  } else {
    // Re-queue so it auto-starts when a slot opens
    updateDownload(id, {
      status: DownloadStatus.Queued,
      speedBytesPerSec: 0,
      etaSeconds: null,
      lastUpdatedAt: new Date().toISOString()
    })
    const updated = getDownloadById(id)
    if (updated) {
      sendToRenderer(IPC.DOWNLOAD_STATUS_CHANGED, {
        id,
        status: DownloadStatus.Queued,
        download: updated
      })
    }
  }

  return { success: true }
}

export function cancelDownload(id: string): DownloadActionResult {
  const active = activeDownloads.get(id)
  if (active) {
    active.instance.destroy()
    activeDownloads.delete(id)
    lastProgressSent.delete(id)
  }

  const now = new Date().toISOString()
  const record = getDownloadById(id)

  updateDownload(id, {
    status: DownloadStatus.Cancelled,
    speedBytesPerSec: 0,
    etaSeconds: null,
    lastUpdatedAt: now
  })

  if (record) {
    insertHistory({
      id: uuid(),
      downloadId: id,
      url: record.url,
      fileName: record.fileName,
      targetPath: record.targetPath,
      finalStatus: HistoryOutcome.Cancelled,
      totalBytes: record.totalBytes,
      startedAt: record.startedAt,
      endedAt: now,
      actionSummary: 'Download cancelled by user',
      errorMessage: null,
      createdAt: now
    })

    sendToRenderer(IPC.DOWNLOAD_STATUS_CHANGED, {
      id,
      status: DownloadStatus.Cancelled,
      download: { ...record, status: DownloadStatus.Cancelled }
    })
  }

  // A slot may have opened
  drainQueue()

  return { success: true }
}

export function retryDownload(id: string): DownloadActionResult {
  const record = getDownloadById(id)
  if (!record) {
    return { success: false, error: 'Download not found' }
  }

  if (record.status !== DownloadStatus.Failed && record.status !== DownloadStatus.Cancelled) {
    return { success: false, error: `Cannot retry a ${record.status} download` }
  }

  // Reset download state
  const now = new Date().toISOString()
  updateDownload(id, {
    status: DownloadStatus.Queued,
    progressPercent: 0,
    downloadedBytes: 0,
    speedBytesPerSec: 0,
    etaSeconds: null,
    errorMessage: null,
    lastUpdatedAt: now
  })

  const updated = getDownloadById(id)
  if (updated) {
    sendToRenderer(IPC.DOWNLOAD_STATUS_CHANGED, {
      id,
      status: DownloadStatus.Queued,
      download: updated
    })
  }

  // Try to start immediately if slot available
  const slots = getAvailableSlots()
  if (slots > 0) {
    startDownloadInternal(id)
  }
  // Otherwise stays queued, will auto-start via drainQueue

  return { success: true }
}

export function removeDownload(id: string): DownloadActionResult {
  const active = activeDownloads.get(id)
  if (active) {
    active.instance.destroy()
    activeDownloads.delete(id)
    lastProgressSent.delete(id)
  }

  deleteDownload(id)

  // A slot may have opened
  drainQueue()

  return { success: true }
}

export function removeDownloadWithFile(id: string): DownloadActionResult {
  // Get the download record first to find the file path
  const download = getDownloadById(id)
  
  const active = activeDownloads.get(id)
  if (active) {
    active.instance.destroy()
    activeDownloads.delete(id)
    lastProgressSent.delete(id)
  }

  deleteDownload(id)

  // Delete the file from disk
  if (download?.targetPath) {
    try {
      if (existsSync(download.targetPath)) {
        unlinkSync(download.targetPath)
      }
    } catch (err) {
      console.warn('[DownloadEngine] Failed to delete file:', err)
    }
  }

  drainQueue()

  return { success: true }
}

// ===== Pause All / Resume All =====

export function pauseAllDownloads(): DownloadActionResult {
  const entries = Array.from(activeDownloads.keys())
  for (const id of entries) {
    pauseDownload(id)
  }
  return { success: true }
}

export function resumeAllDownloads(): DownloadActionResult {
  const allDownloads = listDownloads()
  const paused = allDownloads.filter(d => d.status === DownloadStatus.Paused)

  for (const download of paused) {
    // Re-queue them all
    updateDownload(download.id, {
      status: DownloadStatus.Queued,
      lastUpdatedAt: new Date().toISOString()
    })
    const updated = getDownloadById(download.id)
    if (updated) {
      sendToRenderer(IPC.DOWNLOAD_STATUS_CHANGED, {
        id: download.id,
        status: DownloadStatus.Queued,
        download: updated
      })
    }
  }

  // Drain queue to start what we can
  drainQueue()
  return { success: true }
}

// ===== Lifecycle =====

/**
 * Called on app startup to restore interrupted downloads.
 * Any download that was 'downloading' when the app crashed gets re-queued.
 */
export function restoreInterruptedDownloads(): void {
  const allDownloads = listDownloads()
  const interrupted = allDownloads.filter(
    d => d.status === DownloadStatus.Downloading || d.status === DownloadStatus.Queued
  )

  for (const download of interrupted) {
    if (download.status === DownloadStatus.Downloading) {
      // Was mid-download when app quit — mark as interrupted then re-queue
      updateDownload(download.id, {
        status: DownloadStatus.Queued,
        speedBytesPerSec: 0,
        etaSeconds: null,
        lastUpdatedAt: new Date().toISOString()
      })
    }
  }

  // Start queued downloads up to concurrency limit
  drainQueue()

  if (interrupted.length > 0) {
    console.log(`[DownloadEngine] Restored ${interrupted.length} interrupted downloads`)
  }
}

export function destroyAllDownloads(): void {
  const entries = Array.from(activeDownloads.entries())
  for (const [, active] of entries) {
    try {
      active.instance.destroy()
    } catch {
      // ignore
    }
  }
  activeDownloads.clear()
  lastProgressSent.clear()
}

/**
 * Returns the number of currently active downloads.
 */
export function getActiveCount(): number {
  return activeDownloads.size
}

/**
 * Archive all completed downloads — removes them from the downloads list.
 * They remain in history.
 */
export function archiveCompletedDownloads(): DownloadActionResult {
  const allDownloads = listDownloads()
  const completed = allDownloads.filter(d => d.status === DownloadStatus.Completed)

  for (const download of completed) {
    deleteDownload(download.id)
  }

  return { success: true }
}

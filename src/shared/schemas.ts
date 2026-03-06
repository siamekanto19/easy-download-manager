import { z } from 'zod'

export const DownloadStatusSchema = z.enum([
  'queued',
  'downloading',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'interrupted'
])

export const HistoryOutcomeSchema = z.enum([
  'completed',
  'failed',
  'cancelled',
  'removed',
  'interrupted',
  'retried'
])

export const DownloadRecordSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  fileName: z.string().min(1),
  outputDirectory: z.string().min(1),
  targetPath: z.string().nullable(),
  status: DownloadStatusSchema,
  progressPercent: z.number().min(0).max(100),
  downloadedBytes: z.number().int().min(0),
  totalBytes: z.number().int().nullable(),
  speedBytesPerSec: z.number().min(0),
  etaSeconds: z.number().nullable(),
  sourceHost: z.string().nullable(),
  errorMessage: z.string().nullable(),
  canResume: z.boolean(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  lastUpdatedAt: z.string()
})

export const DownloadHistoryRecordSchema = z.object({
  id: z.string().uuid(),
  downloadId: z.string().uuid().nullable(),
  url: z.string().url(),
  fileName: z.string().min(1),
  targetPath: z.string().nullable(),
  finalStatus: HistoryOutcomeSchema,
  totalBytes: z.number().int().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  actionSummary: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string()
})

export const AddDownloadRequestSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  fileName: z.string().optional(),
  outputDirectory: z.string().optional(),
  startImmediately: z.boolean().optional().default(true)
})

export const SettingsUpdateSchema = z.object({
  key: z.string(),
  value: z.string()
})

export const AppSettingsSchema = z.object({
  downloadDirectory: z.string(),
  maxConcurrentDownloads: z.number().int().min(1).max(10),
  theme: z.enum(['dark', 'light']),
  notificationsEnabled: z.boolean(),
  duplicateNameBehavior: z.enum(['rename', 'overwrite', 'skip']),
  closeBehavior: z.enum(['minimize', 'quit'])
})

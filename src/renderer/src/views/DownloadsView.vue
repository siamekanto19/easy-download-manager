<script setup lang="ts">
import { useUIStore } from '../stores/ui'
import { useDownloadsStore } from '../stores/downloads'
import { computed, ref } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  PlusSignIcon,
  PauseIcon,
  PlayIcon,
  Cancel01Icon,
  RefreshIcon,
  FileIcon,
  FolderOpenIcon,
  Delete02Icon,
  Download04Icon,
  CheckmarkCircle02Icon
} from '@hugeicons/core-free-icons'
import EmptyState from '../components/ui/EmptyState.vue'
import DownloadDetailDrawer from '../components/downloads/DownloadDetailDrawer.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import type { DownloadFilter, DownloadRecord } from '../../../shared/types'

const ui = useUIStore()
const downloadsStore = useDownloadsStore()
const selectedDownload = ref<DownloadRecord | null>(null)
const showDrawer = ref(false)
const removeTarget = ref<DownloadRecord | null>(null)
const showRemoveDialog = ref(false)

const hasActiveDownloads = computed(() => downloadsStore.activeCount > 0)
const hasPausedDownloads = computed(() =>
  downloadsStore.downloads.some(d => d.status === 'paused' || d.status === 'queued')
)
const hasCompletedDownloads = computed(() => downloadsStore.completedCount > 0)

const filters: { id: DownloadFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'queued', label: 'Queued' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' }
]

const filteredDownloads = computed(() => {
  return downloadsStore.filterDownloads(ui.downloadFilter)
})

const isEmpty = computed(() => filteredDownloads.value.length === 0)

// ===== Formatters =====

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatSpeed(bytesPerSec: number): string {
  return formatBytes(bytesPerSec) + '/s'
}

function formatEta(seconds: number | null): string {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function getHostname(url: string): string {
  try {
    return new globalThis.URL(url).hostname
  } catch {
    return url
  }
}

// ===== Status styles =====

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    downloading: 'text-status-info',
    completed: 'text-status-success',
    failed: 'text-status-error',
    cancelled: 'text-status-error',
    paused: 'text-status-warning',
    queued: 'text-text-secondary',
    interrupted: 'text-status-warning'
  }
  return map[status] || 'text-text-secondary'
}

function getStatusBgColor(status: string): string {
  const map: Record<string, string> = {
    downloading: 'bg-status-info-muted',
    completed: 'bg-status-success-muted',
    failed: 'bg-status-error-muted',
    cancelled: 'bg-status-error-muted',
    paused: 'bg-status-warning-muted',
    queued: 'bg-surface-overlay',
    interrupted: 'bg-status-warning-muted'
  }
  return map[status] || 'bg-surface-overlay'
}

function getProgressBarColor(status: string): string {
  const map: Record<string, string> = {
    downloading: 'bg-accent',
    completed: 'bg-status-success',
    failed: 'bg-status-error',
    paused: 'bg-status-warning',
    queued: 'bg-text-tertiary'
  }
  return map[status] || 'bg-text-tertiary'
}

function getStatusIconClass(status: string): string {
  const map: Record<string, string> = {
    downloading: 'text-accent',
    completed: 'text-status-success',
    failed: 'text-status-error',
    cancelled: 'text-status-error',
    paused: 'text-status-warning',
    queued: 'text-text-tertiary'
  }
  return map[status] || 'text-text-tertiary'
}

// ===== Download actions =====

async function handlePause(download: DownloadRecord): Promise<void> {
  await window.api.downloads.pause(download.id)
}

async function handleResume(download: DownloadRecord): Promise<void> {
  await window.api.downloads.resume(download.id)
}

async function handleCancel(download: DownloadRecord): Promise<void> {
  await window.api.downloads.cancel(download.id)
}

async function handleRetry(download: DownloadRecord): Promise<void> {
  await window.api.downloads.retry(download.id)
}

function handleRemove(download: DownloadRecord): void {
  removeTarget.value = download
  showRemoveDialog.value = true
}

async function confirmRemove(deleteFile: boolean): Promise<void> {
  if (!removeTarget.value) return
  const id = removeTarget.value.id
  if (deleteFile) {
    await window.api.downloads.removeWithFile(id)
  } else {
    await window.api.downloads.remove(id)
  }
  downloadsStore.removeFromList(id)
  showRemoveDialog.value = false
  removeTarget.value = null
}

function cancelRemove(): void {
  showRemoveDialog.value = false
  removeTarget.value = null
}

async function handleOpenFile(download: DownloadRecord): Promise<void> {
  if (download.targetPath) {
    await window.api.shell.openPath(download.targetPath)
  }
}

async function handleShowInFolder(download: DownloadRecord): Promise<void> {
  if (download.targetPath) {
    await window.api.shell.showItemInFolder(download.targetPath)
  }
}

async function handlePauseAll(): Promise<void> {
  await window.api.downloads.pauseAll()
}

async function handleResumeAll(): Promise<void> {
  await window.api.downloads.resumeAll()
}

async function handleArchiveCompleted(): Promise<void> {
  await window.api.downloads.archiveCompleted()
  downloadsStore.removeCompletedFromList()
}

function handleRowClick(download: DownloadRecord): void {
  selectedDownload.value = download
  showDrawer.value = true
}

function handleDrawerClose(): void {
  showDrawer.value = false
  selectedDownload.value = null
}

async function handleDrawerOpenFile(path: string): Promise<void> {
  await window.api.shell.openPath(path)
}

async function handleDrawerShowInFolder(path: string): Promise<void> {
  await window.api.shell.showItemInFolder(path)
}

function openAddDownloadWindow(): void {
  window.api.window.openAddDownload()
}
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- Main content column -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <!-- Toolbar — clean, no hard borders -->
      <div class="flex items-center justify-between px-6 py-2.5" style="border-bottom: 0.5px solid rgba(var(--glass-rgb), 0.06)">
        <!-- Filters — pill-shaped tabs -->
        <div class="flex items-center gap-0.5 rounded-lg p-0.5" style="background: rgba(var(--glass-rgb), 0.04)">
          <button
            v-for="filter in filters"
            :key="filter.id"
            @click="ui.setDownloadFilter(filter.id)"
            class="rounded-md px-2.5 py-[5px] text-[11px] font-medium transition-all duration-150"
            :class="[
              ui.downloadFilter === filter.id
                ? 'bg-white/10 text-white/85 shadow-[0_0_0_0.5px_rgba(var(--glass-rgb), 0.1)]'
                : 'text-white/40 hover:text-white/60'
            ]"
          >
            {{ filter.label }}
          </button>
        </div>

        <!-- Actions row — glass capsule buttons -->
        <div class="flex items-center gap-1.5">
          <button
            v-if="hasActiveDownloads"
            @click="handlePauseAll"
            class="no-drag inline-flex items-center gap-1.5 rounded-lg px-2.5 py-[5px] text-[11px] font-medium text-white/50 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/70"
            title="Pause all active downloads"
          >
            <HugeiconsIcon :icon="PauseIcon" :size="11" />
            Pause All
          </button>

          <button
            v-if="hasPausedDownloads"
            @click="handleResumeAll"
            class="no-drag inline-flex items-center gap-1.5 rounded-lg px-2.5 py-[5px] text-[11px] font-medium text-white/50 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/70"
            title="Resume all paused downloads"
          >
            <HugeiconsIcon :icon="PlayIcon" :size="11" />
            Resume All
          </button>

          <!-- Archive Completed -->
          <button
            v-if="hasCompletedDownloads"
            @click="handleArchiveCompleted"
            class="no-drag inline-flex items-center gap-1.5 rounded-lg px-2.5 py-[5px] text-[11px] font-medium text-white/50 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/70"
            title="Archive all completed downloads"
          >
            <HugeiconsIcon :icon="CheckmarkCircle02Icon" :size="11" />
            Archive
          </button>

          <button
            @click="openAddDownloadWindow"
            class="no-drag inline-flex items-center gap-1.5 rounded-lg px-3 py-[6px] text-[12px] font-semibold text-white/90 transition-all duration-150 active:scale-[0.97]"
            style="background: rgba(255,255,255,0.10); box-shadow: 0 0 0 0.5px rgba(var(--glass-rgb), 0.14)"
          >
            <HugeiconsIcon :icon="PlusSignIcon" :size="13" />
            Add Download
          </button>
        </div>
      </div>

      <!-- Download list / empty state -->
      <div class="flex-1 overflow-y-auto">
        <EmptyState
          v-if="isEmpty && !downloadsStore.loaded"
          title="Loading..."
          description="Fetching your downloads"
        />

        <EmptyState
          v-else-if="isEmpty"
          title="No downloads yet"
          description="Paste a URL and start downloading. Your files will appear here with real-time progress tracking."
          actionLabel="Add Download"
          @action="openAddDownloadWindow"
        >
          <template #icon>
            <HugeiconsIcon :icon="Download04Icon" :size="24" class="text-text-tertiary" />
          </template>
        </EmptyState>

        <!-- Download rows -->
        <div v-else class="divide-y divide-border-subtle">
          <div
            v-for="download in filteredDownloads"
            :key="download.id"
            @click="handleRowClick(download)"
            class="group download-row-enter flex cursor-pointer items-center gap-4 px-6 py-3.5 transition-colors-fast hover:bg-surface-hover"
            :class="{ 'bg-surface-selected': selectedDownload?.id === download.id && showDrawer }"
          >
            <!-- Status icon -->
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-overlay">
              <HugeiconsIcon
                v-if="download.status === 'downloading'"
                :icon="Download04Icon" :size="20"
                :class="getStatusIconClass(download.status)"
                class="animate-pulse"
              />
              <HugeiconsIcon
                v-else-if="download.status === 'completed'"
                :icon="CheckmarkCircle02Icon" :size="20"
                :class="getStatusIconClass(download.status)"
              />
              <HugeiconsIcon
                v-else-if="download.status === 'failed' || download.status === 'cancelled'"
                :icon="Cancel01Icon" :size="20"
                :class="getStatusIconClass(download.status)"
              />
              <HugeiconsIcon
                v-else-if="download.status === 'paused'"
                :icon="PauseIcon" :size="20"
                :class="getStatusIconClass(download.status)"
              />
              <HugeiconsIcon
                v-else
                :icon="FileIcon" :size="18"
                class="text-text-tertiary"
              />
            </div>

            <!-- File info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate text-[13px] font-medium text-text-primary">{{ download.fileName }}</p>
                <span
                  :class="[getStatusColor(download.status), getStatusBgColor(download.status)]"
                  class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                >
                  {{ download.status }}
                </span>
                <span v-if="download.status === 'downloading'" class="live-dot" />
              </div>
              <p class="mt-0.5 truncate text-[11px] text-text-tertiary">
                {{ download.sourceHost || getHostname(download.url) }}
              </p>

              <!-- Progress bar with shimmer -->
              <div v-if="download.status === 'downloading' || (download.progressPercent > 0 && download.status !== 'completed')" class="mt-2">
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
                  <div
                    :class="[
                      getProgressBarColor(download.status),
                      download.status === 'downloading' ? 'progress-bar-animated' : ''
                    ]"
                    class="h-full rounded-full transition-all duration-300"
                    :style="{ width: `${download.progressPercent}%` }"
                  />
                </div>
              </div>

              <!-- Error message -->
              <p v-if="download.errorMessage && download.status === 'failed'" class="mt-1 truncate text-[11px] text-status-error">
                {{ download.errorMessage }}
              </p>
            </div>

            <!-- Stats & Actions -->
            <div class="flex items-center gap-3">
              <div class="shrink-0 text-right">
                <p v-if="download.totalBytes && download.status === 'downloading'" class="text-[12px] text-text-secondary">
                  {{ formatBytes(download.downloadedBytes) }} / {{ formatBytes(download.totalBytes) }}
                </p>
                <p v-else-if="download.totalBytes && download.status === 'completed'" class="text-[12px] text-text-secondary">
                  {{ formatBytes(download.totalBytes) }}
                </p>
                <p v-else-if="download.downloadedBytes > 0" class="text-[12px] text-text-secondary">
                  {{ formatBytes(download.downloadedBytes) }}
                </p>
                <p
                  v-if="download.status === 'downloading' && download.speedBytesPerSec > 0"
                  class="mt-0.5 text-[11px] text-text-tertiary"
                >
                  {{ formatSpeed(download.speedBytesPerSec) }}
                  <span v-if="download.etaSeconds" class="ml-1">• {{ formatEta(download.etaSeconds) }}</span>
                </p>
              </div>

              <!-- Action buttons -->
              <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  v-if="download.status === 'downloading'"
                  @click.stop="handlePause(download)"
                  class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-active hover:text-text-primary"
                  title="Pause"
                >
                  <HugeiconsIcon :icon="PauseIcon" :size="14" />
                </button>

                <button
                  v-if="download.status === 'paused'"
                  @click.stop="handleResume(download)"
                  class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-active hover:text-text-primary"
                  title="Resume"
                >
                  <HugeiconsIcon :icon="PlayIcon" :size="14" />
                </button>

                <button
                  v-if="['downloading', 'paused', 'queued'].includes(download.status)"
                  @click.stop="handleCancel(download)"
                  class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-status-error-muted hover:text-status-error"
                  title="Cancel"
                >
                  <HugeiconsIcon :icon="Cancel01Icon" :size="14" />
                </button>

                <button
                  v-if="['failed', 'cancelled'].includes(download.status)"
                  @click.stop="handleRetry(download)"
                  class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-active hover:text-text-primary"
                  title="Retry"
                >
                  <HugeiconsIcon :icon="RefreshIcon" :size="14" />
                </button>

                <button
                  v-if="download.status === 'completed' && download.targetPath"
                  @click.stop="handleOpenFile(download)"
                  class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-active hover:text-text-primary"
                  title="Open file"
                >
                  <HugeiconsIcon :icon="FileIcon" :size="14" />
                </button>

                <button
                  v-if="download.status === 'completed' && download.targetPath"
                  @click.stop="handleShowInFolder(download)"
                  class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-active hover:text-text-primary"
                  title="Show in folder"
                >
                  <HugeiconsIcon :icon="FolderOpenIcon" :size="14" />
                </button>

                <button
                  @click.stop="handleRemove(download)"
                  class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-status-error-muted hover:text-status-error"
                  title="Remove"
                >
                  <HugeiconsIcon :icon="Delete02Icon" :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Detail Drawer -->
    <DownloadDetailDrawer
      :download="selectedDownload"
      :visible="showDrawer"
      @close="handleDrawerClose"
      @pause="(id) => handlePause({ id } as DownloadRecord)"
      @resume="(id) => handleResume({ id } as DownloadRecord)"
      @cancel="(id) => handleCancel({ id } as DownloadRecord)"
      @retry="(id) => handleRetry({ id } as DownloadRecord)"
      @remove="(id) => { handleRemove({ id } as DownloadRecord); handleDrawerClose(); }"
      @open-file="handleDrawerOpenFile"
      @show-in-folder="handleDrawerShowInFolder"
    />

    <!-- Remove confirmation dialog -->
    <ConfirmDialog
      :visible="showRemoveDialog"
      title="Remove Download"
      :message="`Are you sure you want to remove '${removeTarget?.fileName || ''}'? You can also delete the downloaded file from your computer.`"
      :dangerousAction="true"
      :showDeleteFileOption="true"
      @confirm="confirmRemove"
      @cancel="cancelRemove"
    />
  </div>
</template>

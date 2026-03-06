<script setup lang="ts">
import { computed } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Cancel01Icon,
  Download04Icon,
  CheckmarkCircle02Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  FileIcon,
  FolderOpenIcon,
  Delete02Icon,
  LinkIcon,
  TimeIcon
} from '@hugeicons/core-free-icons'
import type { DownloadRecord } from '../../../../shared/types'

const props = defineProps<{
  download: DownloadRecord | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  pause: [id: string]
  resume: [id: string]
  cancel: [id: string]
  retry: [id: string]
  remove: [id: string]
  openFile: [path: string]
  showInFolder: [path: string]
}>()

const progressPercent = computed(() => props.download?.progressPercent ?? 0)

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
  if (!seconds || seconds <= 0) return 'Calculating...'
  if (seconds < 60) return `${Math.round(seconds)}s remaining`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s remaining`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m remaining`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function getStatusColor(status: string): string {
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

function getHostname(url: string): string {
  try { return new globalThis.URL(url).hostname } catch { return '' }
}
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="visible && download"
      class="glass-panel flex h-full w-[360px] shrink-0 flex-col border-l border-border-default"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-border-default px-5 py-3.5">
        <h3 class="text-[13px] font-semibold text-text-primary">Download Details</h3>
        <button
          @click="emit('close')"
          class="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <HugeiconsIcon :icon="Cancel01Icon" :size="12" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-5 py-4">
        <!-- File icon + name -->
        <div class="mb-5 flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-overlay">
            <HugeiconsIcon
              v-if="download.status === 'downloading'" :icon="Download04Icon" :size="20" class="animate-pulse text-accent"
            />
            <HugeiconsIcon
              v-else-if="download.status === 'completed'" :icon="CheckmarkCircle02Icon" :size="20" class="text-status-success"
            />
            <HugeiconsIcon
              v-else-if="download.status === 'failed' || download.status === 'cancelled'" :icon="Cancel01Icon" :size="20" class="text-status-error"
            />
            <HugeiconsIcon
              v-else-if="download.status === 'paused'" :icon="PauseIcon" :size="20" class="text-status-warning"
            />
            <HugeiconsIcon v-else :icon="FileIcon" :size="20" class="text-text-tertiary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="break-words text-[14px] font-semibold leading-tight text-text-primary">{{ download.fileName }}</p>
            <p :class="getStatusColor(download.status)" class="mt-1 text-[12px] font-medium capitalize">
              {{ download.status }}
              <span v-if="download.status === 'downloading'" class="live-dot ml-1 inline-block" />
            </p>
          </div>
        </div>

        <!-- Progress (if downloading or has progress) -->
        <div v-if="download.status === 'downloading' || (progressPercent > 0 && download.status !== 'completed')" class="mb-5">
          <div class="mb-2 flex items-baseline justify-between">
            <span class="text-[22px] font-bold tabular-nums text-text-primary">{{ Math.round(progressPercent) }}%</span>
            <span v-if="download.etaSeconds" class="text-[11px] text-text-tertiary">{{ formatEta(download.etaSeconds) }}</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
            <div
              :class="download.status === 'downloading' ? 'progress-bar-animated bg-accent' : 'bg-status-warning'"
              class="h-full rounded-full transition-all duration-300"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <div v-if="download.status === 'downloading'" class="mt-2 flex justify-between text-[11px] text-text-tertiary">
            <span>{{ formatBytes(download.downloadedBytes) }} / {{ formatBytes(download.totalBytes || 0) }}</span>
            <span v-if="download.speedBytesPerSec > 0">{{ formatSpeed(download.speedBytesPerSec) }}</span>
          </div>
        </div>

        <!-- Completed size -->
        <div v-else-if="download.status === 'completed' && download.totalBytes" class="mb-5 rounded-lg bg-status-success-muted px-3.5 py-2.5">
          <p class="text-[12px] font-medium text-status-success">
            ✓ Downloaded {{ formatBytes(download.totalBytes) }}
          </p>
        </div>

        <!-- Error -->
        <div v-if="download.errorMessage && download.status === 'failed'" class="mb-5 rounded-lg bg-status-error-muted px-3.5 py-2.5">
          <p class="text-[12px] font-medium text-status-error">{{ download.errorMessage }}</p>
        </div>

        <!-- Info grid -->
        <div class="space-y-3">
          <div class="flex items-start gap-2.5">
            <HugeiconsIcon :icon="LinkIcon" :size="14" class="mt-0.5 shrink-0 text-text-tertiary" />
            <div class="min-w-0">
              <p class="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">Source</p>
              <p class="mt-0.5 break-all text-[12px] text-text-secondary">{{ download.url }}</p>
              <p class="text-[11px] text-text-tertiary">{{ getHostname(download.url) }}</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5">
            <HugeiconsIcon :icon="FolderOpenIcon" :size="14" class="mt-0.5 shrink-0 text-text-tertiary" />
            <div class="min-w-0">
              <p class="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">Save Location</p>
              <p class="mt-0.5 break-all text-[12px] text-text-secondary">{{ download.targetPath || download.outputDirectory }}</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5">
            <HugeiconsIcon :icon="TimeIcon" :size="14" class="mt-0.5 shrink-0 text-text-tertiary" />
            <div class="min-w-0">
              <p class="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">Timeline</p>
              <div class="mt-0.5 space-y-0.5 text-[12px] text-text-secondary">
                <p>Created: {{ formatDate(download.createdAt) }}</p>
                <p v-if="download.startedAt">Started: {{ formatDate(download.startedAt) }}</p>
                <p v-if="download.completedAt">Completed: {{ formatDate(download.completedAt) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center gap-2 border-t border-border-default px-5 py-3">
        <button
          v-if="download.status === 'downloading'"
          @click="emit('pause', download.id)"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-default py-2 text-[12px] font-medium text-text-secondary transition-colors-fast hover:bg-surface-hover hover:text-text-primary"
        >
          <HugeiconsIcon :icon="PauseIcon" :size="13" />
          Pause
        </button>

        <button
          v-if="download.status === 'paused'"
          @click="emit('resume', download.id)"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-[12px] font-medium text-white transition-default hover:bg-accent-hover"
        >
          <HugeiconsIcon :icon="PlayIcon" :size="13" />
          Resume
        </button>

        <button
          v-if="['downloading', 'paused', 'queued'].includes(download.status)"
          @click="emit('cancel', download.id)"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-status-error/30 py-2 text-[12px] font-medium text-status-error transition-colors-fast hover:bg-status-error-muted"
        >
          <HugeiconsIcon :icon="Cancel01Icon" :size="13" />
          Cancel
        </button>

        <button
          v-if="['failed', 'cancelled'].includes(download.status)"
          @click="emit('retry', download.id)"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-[12px] font-medium text-white transition-default hover:bg-accent-hover"
        >
          <HugeiconsIcon :icon="RefreshIcon" :size="13" />
          Retry
        </button>

        <button
          v-if="download.status === 'completed' && download.targetPath"
          @click="emit('openFile', download.targetPath!)"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-[12px] font-medium text-white transition-default hover:bg-accent-hover"
        >
          <HugeiconsIcon :icon="FileIcon" :size="13" />
          Open
        </button>

        <button
          v-if="download.status === 'completed' && download.targetPath"
          @click="emit('showInFolder', download.targetPath!)"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-default py-2 text-[12px] font-medium text-text-secondary transition-colors-fast hover:bg-surface-hover hover:text-text-primary"
        >
          <HugeiconsIcon :icon="FolderOpenIcon" :size="13" />
          Reveal
        </button>

        <button
          @click="emit('remove', download.id)"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-status-error-muted hover:text-status-error"
          title="Remove"
        >
          <HugeiconsIcon :icon="Delete02Icon" :size="14" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-enter-active {
  animation: drawer-slide-in 0.2s ease-out;
}

.drawer-leave-active {
  animation: drawer-slide-out 0.15s ease-in;
}
</style>

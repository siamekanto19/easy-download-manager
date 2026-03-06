<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Search01Icon,
  SortingDownIcon,
  Delete02Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  PauseIcon,
  FileIcon,
  FolderOpenIcon,
  TimeIcon
} from '@hugeicons/core-free-icons'
import EmptyState from '../components/ui/EmptyState.vue'
import type { DownloadHistoryRecord, HistoryOutcome } from '../../../shared/types'

const historyItems = ref<DownloadHistoryRecord[]>([])
const searchQuery = ref('')
const loaded = ref(false)
const statusFilter = ref<string>('all')
const sortOrder = ref<'newest' | 'oldest'>('newest')
const isClearing = ref(false)

type HistoryFilter = 'all' | HistoryOutcome

const filters: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'completed' as HistoryFilter, label: 'Completed' },
  { id: 'failed' as HistoryFilter, label: 'Failed' },
  { id: 'cancelled' as HistoryFilter, label: 'Cancelled' }
]

const filteredAndSorted = computed(() => {
  let items = historyItems.value
  if (statusFilter.value !== 'all') {
    items = items.filter(i => i.finalStatus === statusFilter.value)
  }
  return items.slice().sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime()
    const dateB = new Date(b.createdAt).getTime()
    return sortOrder.value === 'newest' ? dateB - dateA : dateA - dateB
  })
})

const isEmpty = computed(() => filteredAndSorted.value.length === 0)
const totalCount = computed(() => historyItems.value.length)

onMounted(async () => { await loadHistory() })

let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => handleSearch(), 300)
})

async function loadHistory(): Promise<void> {
  try {
    historyItems.value = await window.api.history.list()
    loaded.value = true
  } catch (error) {
    console.error('Failed to load history:', error)
    loaded.value = true
  }
}

async function handleSearch(): Promise<void> {
  if (searchQuery.value.trim()) {
    historyItems.value = await window.api.history.search(searchQuery.value)
  } else {
    await loadHistory()
  }
}

async function handleClearAll(): Promise<void> {
  if (isClearing.value) return
  isClearing.value = true
  try {
    await window.api.history.clear()
    historyItems.value = []
  } finally {
    isClearing.value = false
  }
}

async function handleRemoveItem(id: string): Promise<void> {
  await window.api.history.remove(id)
  historyItems.value = historyItems.value.filter(i => i.id !== id)
}

async function handleOpenFile(item: DownloadHistoryRecord): Promise<void> {
  if (item.targetPath) {
    const exists = await window.api.shell.fileExists(item.targetPath)
    if (exists) await window.api.shell.openPath(item.targetPath)
  }
}

async function handleShowInFolder(item: DownloadHistoryRecord): Promise<void> {
  if (item.targetPath) {
    const exists = await window.api.shell.fileExists(item.targetPath)
    if (exists) await window.api.shell.showItemInFolder(item.targetPath)
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getOutcomeColor(status: string): string {
  const map: Record<string, string> = {
    completed: 'text-status-success bg-status-success-muted',
    failed: 'text-status-error bg-status-error-muted',
    cancelled: 'text-status-error bg-status-error-muted',
    removed: 'text-text-secondary bg-surface-overlay',
    interrupted: 'text-status-warning bg-status-warning-muted',
    retried: 'text-status-info bg-status-info-muted'
  }
  return map[status] || 'text-text-secondary bg-surface-overlay'
}

function getStatusIconClass(status: string): string {
  const map: Record<string, string> = {
    completed: 'text-status-success',
    failed: 'text-status-error',
    cancelled: 'text-status-error',
    interrupted: 'text-status-warning'
  }
  return map[status] || 'text-text-tertiary'
}

function getHostname(url: string): string {
  try { return new globalThis.URL(url).hostname } catch { return '' }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="flex flex-col gap-2.5 px-6 py-2.5" style="border-bottom: 0.5px solid rgba(var(--glass-rgb), 0.06)">
      <div class="flex items-center gap-2">
        <!-- Search -->
        <div class="relative flex-1">
          <HugeiconsIcon :icon="Search01Icon" :size="13" class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search history..."
            class="w-full rounded-lg py-[6px] pl-8 pr-3 text-[12px] text-white/85 placeholder-white/30 outline-none transition-all duration-150 focus:ring-1 focus:ring-white/15"
            style="background: rgba(var(--glass-rgb), 0.06); border: 0.5px solid rgba(var(--glass-rgb), 0.08)"
          />
        </div>

        <!-- Sort toggle -->
        <button
          @click="sortOrder = sortOrder === 'newest' ? 'oldest' : 'newest'"
          class="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-white/50 transition-all duration-150 hover:bg-white/6 hover:text-white/70"
          :title="`Sort by ${sortOrder === 'newest' ? 'oldest first' : 'newest first'}`"
        >
          <HugeiconsIcon :icon="SortingDownIcon" :size="11" />
          {{ sortOrder === 'newest' ? 'Newest' : 'Oldest' }}
        </button>

        <!-- Clear all -->
        <button
          v-if="totalCount > 0"
          @click="handleClearAll"
          :disabled="isClearing"
          class="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-white/50 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          title="Clear all history"
        >
          <HugeiconsIcon :icon="Delete02Icon" :size="11" />
          Clear
        </button>
      </div>

      <!-- Filter tabs — pill-shaped matching downloads toolbar -->
      <div class="flex items-center gap-0.5 rounded-lg p-0.5" style="background: rgba(var(--glass-rgb), 0.04)">
        <button
          v-for="filter in filters"
          :key="filter.id"
          @click="statusFilter = filter.id"
          class="rounded-md px-2.5 py-[5px] text-[11px] font-medium transition-all duration-150"
          :class="[
            statusFilter === filter.id
              ? 'bg-white/10 text-white/85 shadow-[0_0_0_0.5px_rgba(var(--glass-rgb), 0.1)]'
              : 'text-white/40 hover:text-white/60'
          ]"
        >
          {{ filter.label }}
        </button>
        <span v-if="totalCount > 0" class="ml-auto pr-1 text-[10px] text-white/25">
          {{ filteredAndSorted.length }} {{ filteredAndSorted.length === 1 ? 'item' : 'items' }}
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <EmptyState v-if="!loaded" title="Loading..." description="Fetching your download history" />

      <EmptyState
        v-else-if="totalCount === 0 && !searchQuery"
        title="No history yet"
        description="Completed, failed, and cancelled downloads are automatically recorded here for reference."
      >
        <template #icon>
          <HugeiconsIcon :icon="TimeIcon" :size="24" class="text-text-tertiary" />
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="isEmpty && searchQuery"
        title="No results found"
        :description="`No history items match '${searchQuery}'.`"
      >
        <template #icon>
          <HugeiconsIcon :icon="Search01Icon" :size="24" class="text-text-tertiary" />
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="isEmpty && statusFilter !== 'all'"
        :title="`No ${statusFilter} items`"
        description="Try a different filter to see more history."
      />

      <!-- History rows -->
      <div v-else class="divide-y divide-border-subtle">
        <div
          v-for="item in filteredAndSorted"
          :key="item.id"
          class="group flex items-center gap-4 px-6 py-3.5 transition-colors-fast hover:bg-surface-hover"
        >
          <!-- Status icon -->
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-overlay">
            <HugeiconsIcon
              v-if="item.finalStatus === 'completed'"
              :icon="CheckmarkCircle02Icon" :size="16"
              :class="getStatusIconClass(item.finalStatus)"
            />
            <HugeiconsIcon
              v-else-if="item.finalStatus === 'failed' || item.finalStatus === 'cancelled'"
              :icon="Cancel01Icon" :size="16"
              :class="getStatusIconClass(item.finalStatus)"
            />
            <HugeiconsIcon
              v-else-if="item.finalStatus === 'interrupted'"
              :icon="PauseIcon" :size="16"
              :class="getStatusIconClass(item.finalStatus)"
            />
            <HugeiconsIcon v-else :icon="FileIcon" :size="16" class="text-text-tertiary" />
          </div>

          <!-- Info -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate text-[13px] font-medium text-text-primary">{{ item.fileName }}</p>
              <span
                :class="getOutcomeColor(item.finalStatus)"
                class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              >
                {{ item.finalStatus }}
              </span>
            </div>
            <div class="mt-0.5 flex items-center gap-2 text-[11px] text-text-tertiary">
              <span class="truncate">{{ getHostname(item.url) || item.url }}</span>
              <span v-if="item.errorMessage && item.finalStatus === 'failed'" class="truncate text-status-error">
                · {{ item.errorMessage }}
              </span>
            </div>
          </div>

          <!-- Meta -->
          <div class="shrink-0 text-right">
            <p class="text-[12px] text-text-secondary">{{ formatBytes(item.totalBytes) }}</p>
            <p class="mt-0.5 text-[11px] text-text-tertiary" :title="formatFullDate(item.createdAt)">
              {{ formatDate(item.createdAt) }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              v-if="item.finalStatus === 'completed' && item.targetPath"
              @click="handleOpenFile(item)"
              class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-active hover:text-text-primary"
              title="Open file"
            >
              <HugeiconsIcon :icon="FileIcon" :size="14" />
            </button>
            <button
              v-if="item.finalStatus === 'completed' && item.targetPath"
              @click="handleShowInFolder(item)"
              class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-active hover:text-text-primary"
              title="Show in folder"
            >
              <HugeiconsIcon :icon="FolderOpenIcon" :size="14" />
            </button>
            <button
              @click="handleRemoveItem(item.id)"
              class="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-status-error-muted hover:text-status-error"
              title="Remove from history"
            >
              <HugeiconsIcon :icon="Cancel01Icon" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

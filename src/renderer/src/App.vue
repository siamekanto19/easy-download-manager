<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AppShell from './components/app/AppShell.vue'
import AddDownloadPage from './views/AddDownloadPage.vue'
import { useSettingsStore } from './stores/settings'
import { useDownloadsStore } from './stores/downloads'
import type { DownloadProgressEvent, DownloadRecord } from '../../shared/types'

const settingsStore = useSettingsStore()
const downloadsStore = useDownloadsStore()

// Check if this window is the add-download child window
const isAddDownloadWindow = ref(window.location.hash === '#add-download')

let unsubProgress: (() => void) | null = null
let unsubStatus: (() => void) | null = null

onMounted(async () => {
  if (isAddDownloadWindow.value) {
    // Child window only needs settings for download directory default
    await settingsStore.loadSettings()
    return
  }

  // Main window: Load initial data
  await Promise.all([
    settingsStore.loadSettings(),
    downloadsStore.loadDownloads()
  ])

  // Subscribe to real-time progress updates
  unsubProgress = window.api.downloads.onProgress((event: DownloadProgressEvent) => {
    const existing = downloadsStore.downloads.find(d => d.id === event.id)
    if (existing) {
      downloadsStore.updateDownloadInList({
        ...existing,
        status: event.status,
        progressPercent: event.progressPercent,
        downloadedBytes: event.downloadedBytes,
        totalBytes: event.totalBytes,
        speedBytesPerSec: event.speedBytesPerSec,
        etaSeconds: event.etaSeconds
      })
    }
  })

  // Subscribe to status change events (new downloads, completed, failed, etc.)
  unsubStatus = window.api.downloads.onStatusChanged((event: { id: string; status: string; download: DownloadRecord }) => {
    downloadsStore.updateDownloadInList(event.download)
  })
})

onUnmounted(() => {
  if (unsubProgress) unsubProgress()
  if (unsubStatus) unsubStatus()
})
</script>

<template>
  <AddDownloadPage v-if="isAddDownloadWindow" />
  <AppShell v-else />
</template>

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DownloadRecord, DownloadFilter } from '../../../shared/types'

export const useDownloadsStore = defineStore('downloads', () => {
  const downloads = ref<DownloadRecord[]>([])
  const loaded = ref(false)

  async function loadDownloads(): Promise<void> {
    try {
      const result = await window.api.downloads.list()
      downloads.value = result
      loaded.value = true
    } catch (error) {
      console.error('Failed to load downloads:', error)
    }
  }

  function updateDownloadInList(updated: DownloadRecord): void {
    const index = downloads.value.findIndex((d) => d.id === updated.id)
    if (index !== -1) {
      downloads.value[index] = updated
    } else {
      downloads.value.unshift(updated)
    }
  }

  function removeFromList(id: string): void {
    downloads.value = downloads.value.filter((d) => d.id !== id)
  }

  function filterDownloads(filter: DownloadFilter): DownloadRecord[] {
    if (filter === 'all') return downloads.value
    const statusMap: Record<string, string[]> = {
      active: ['downloading'],
      queued: ['queued'],
      paused: ['paused'],
      completed: ['completed'],
      failed: ['failed', 'cancelled', 'interrupted']
    }
    const statuses = statusMap[filter] || []
    return downloads.value.filter((d) => statuses.includes(d.status))
  }

  const activeCount = computed(
    () => downloads.value.filter((d) => d.status === 'downloading').length
  )

  const queuedCount = computed(
    () => downloads.value.filter((d) => d.status === 'queued').length
  )

  const totalCount = computed(() => downloads.value.length)

  function removeCompletedFromList(): void {
    downloads.value = downloads.value.filter((d) => d.status !== 'completed')
  }

  const completedCount = computed(
    () => downloads.value.filter((d) => d.status === 'completed').length
  )

  return {
    downloads,
    loaded,
    loadDownloads,
    updateDownloadInList,
    removeFromList,
    removeCompletedFromList,
    filterDownloads,
    activeCount,
    queuedCount,
    completedCount,
    totalCount
  }
})

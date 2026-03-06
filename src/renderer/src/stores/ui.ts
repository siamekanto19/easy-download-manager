import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ViewName, DownloadFilter } from '../../../shared/types'

export const useUIStore = defineStore('ui', () => {
  const activeView = ref<ViewName>('downloads')
  const downloadFilter = ref<DownloadFilter>('all')
  const searchQuery = ref('')
  const sidebarCollapsed = ref(false)

  function setView(view: ViewName): void {
    activeView.value = view
  }

  function setDownloadFilter(filter: DownloadFilter): void {
    downloadFilter.value = filter
  }

  function setSearchQuery(query: string): void {
    searchQuery.value = query
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    activeView,
    downloadFilter,
    searchQuery,
    sidebarCollapsed,
    setView,
    setDownloadFilter,
    setSearchQuery,
    toggleSidebar
  }
})

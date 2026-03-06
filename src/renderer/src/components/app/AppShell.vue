<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import AppTitleBar from './AppTitleBar.vue'
import DownloadsView from '../../views/DownloadsView.vue'
import HistoryView from '../../views/HistoryView.vue'
import SettingsView from '../../views/SettingsView.vue'
import { useUIStore } from '../../stores/ui'
import { computed } from 'vue'

const ui = useUIStore()

const currentView = computed(() => ui.activeView)
</script>

<template>
  <div class="flex h-full w-full overflow-hidden bg-surface-base">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main content area -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Title bar / drag region -->
      <AppTitleBar />

      <!-- View content -->
      <main class="flex-1 overflow-hidden">
        <DownloadsView v-if="currentView === 'downloads'" />
        <HistoryView v-else-if="currentView === 'history'" />
        <SettingsView v-else-if="currentView === 'settings'" />
      </main>
    </div>
  </div>
</template>

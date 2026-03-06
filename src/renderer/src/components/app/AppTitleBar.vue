<script setup lang="ts">
import { useUIStore } from '../../stores/ui'
import { computed } from 'vue'

const ui = useUIStore()

const viewTitle = computed(() => {
  const titles: Record<string, string> = {
    downloads: 'Downloads',
    history: 'History',
    settings: 'Settings'
  }
  return titles[ui.activeView] || ''
})
</script>

<template>
  <header class="drag-region flex h-[48px] shrink-0 items-center px-6">
    <h2 class="text-[13px] font-semibold text-white/60">{{ viewTitle }}</h2>
  </header>
</template>

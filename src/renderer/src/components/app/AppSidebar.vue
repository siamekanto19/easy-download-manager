<script setup lang="ts">
import { useUIStore } from '../../stores/ui'
import { useDownloadsStore } from '../../stores/downloads'
import { computed } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Download04Icon,
  TimeIcon,
  Settings02Icon
} from '@hugeicons/core-free-icons'
import type { ViewName } from '../../../../shared/types'

const ui = useUIStore()
const downloads = useDownloadsStore()

interface NavItem {
  id: ViewName
  label: string
  icon: typeof Download04Icon
  badge?: number
}

const navItems = computed<NavItem[]>(() => [
  {
    id: 'downloads',
    label: 'Downloads',
    icon: Download04Icon,
    badge: downloads.activeCount > 0 ? downloads.activeCount : undefined
  },
  {
    id: 'history',
    label: 'History',
    icon: TimeIcon
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings02Icon
  }
])

function handleNav(view: ViewName): void {
  ui.setView(view)
}
</script>

<template>
  <nav
    class="flex w-[220px] flex-col"
    :class="{ 'w-[64px]': ui.sidebarCollapsed }"
  >
    <!-- macOS traffic light spacer + drag region -->
    <div class="drag-region h-[48px] shrink-0" />

    <!-- Navigation items — macOS sidebar style -->
    <div class="flex flex-1 flex-col gap-0.5 px-3">
      <button
        v-for="item in navItems"
        :key="item.id"
        @click="handleNav(item.id)"
        class="no-drag group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left transition-all duration-150"
        :class="[
          ui.activeView === item.id
            ? 'bg-white/10 text-white/90 shadow-[0_0_0_0.5px_rgba(var(--glass-rgb), 0.12)]'
            : 'text-white/50 hover:bg-white/5 hover:text-white/70'
        ]"
      >
        <!-- Icon -->
        <HugeiconsIcon
          :icon="item.icon"
          :size="16"
          :class="ui.activeView === item.id ? 'opacity-90' : 'opacity-50 group-hover:opacity-70'"
        />

        <!-- Label -->
        <span v-if="!ui.sidebarCollapsed" class="text-[13px] font-medium">
          {{ item.label }}
        </span>

        <!-- Badge — pill-shaped -->
        <span
          v-if="item.badge && !ui.sidebarCollapsed"
          class="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
          style="background: rgba(var(--glass-rgb), 0.1); color: rgba(255,255,255,0.6)"
        >
          {{ item.badge }}
        </span>
      </button>
    </div>

    <!-- Footer info — minimal -->
    <div v-if="!ui.sidebarCollapsed" class="px-5 py-3">
      <p class="text-[11px] text-white/25">
        {{ downloads.totalCount }} downloads
      </p>
    </div>
  </nav>
</template>

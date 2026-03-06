<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'
import { computed } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Download04Icon } from '@hugeicons/core-free-icons'
import CustomSelect from '../components/ui/CustomSelect.vue'

const settingsStore = useSettingsStore()
const settings = computed(() => settingsStore.settings)

async function selectDirectory(): Promise<void> {
  const dir = await window.api.shell.selectDirectory()
  if (dir) {
    await settingsStore.updateSetting('downloadDirectory', dir)
  }
}

async function updateSetting(key: string, value: string | number): Promise<void> {
  await settingsStore.updateSetting(key as keyof typeof settings.value, String(value))
}

async function toggleNotifications(): Promise<void> {
  const current = settings.value.notificationsEnabled
  await settingsStore.updateSetting('notificationsEnabled', String(!current))
}

const concurrencyOptions = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1)
}))

const connectionsOptions = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 8, label: '8' },
  { value: 16, label: '16' },
  { value: 32, label: '32' }
]

const duplicateOptions = [
  { value: 'rename', label: 'Auto-rename' },
  { value: 'overwrite', label: 'Overwrite' },
  { value: 'skip', label: 'Skip' }
]

const closeOptions = [
  { value: 'minimize', label: 'Minimize to tray' },
  { value: 'quit', label: 'Quit application' }
]

const themeOptions = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' }
]
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto">
    <div class="mx-auto w-full max-w-[640px] px-8 py-8">
      <!-- Section: Downloads -->
      <section class="mb-7">
        <h3 class="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/30">
          Downloads
        </h3>
        <div
          class="overflow-hidden rounded-xl"
          style="background: rgba(var(--glass-rgb), 0.04); box-shadow: 0 0 0 0.5px rgba(var(--glass-rgb), 0.08)"
        >
          <!-- Download directory -->
          <div class="flex items-center justify-between px-4 py-3.5" style="border-bottom: 0.5px solid rgba(var(--glass-rgb), 0.06)">
            <div>
              <p class="text-[13px] font-medium text-white/85">Default directory</p>
              <p class="mt-0.5 text-[11px] text-white/35">{{ settings.downloadDirectory || 'Not set' }}</p>
            </div>
            <button
              @click="selectDirectory"
              class="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white/55 transition-all duration-150 hover:text-white/75"
              style="background: rgba(var(--glass-rgb), 0.06); box-shadow: 0 0 0 0.5px rgba(var(--glass-rgb), 0.1)"
            >
              Browse
            </button>
          </div>

          <!-- Max concurrent downloads -->
          <div class="flex items-center justify-between px-4 py-3.5" style="border-bottom: 0.5px solid rgba(var(--glass-rgb), 0.06)">
            <div>
              <p class="text-[13px] font-medium text-white/85">Simultaneous downloads</p>
              <p class="mt-0.5 text-[11px] text-white/35">Maximum concurrent download tasks</p>
            </div>
            <CustomSelect
              :model-value="settings.maxConcurrentDownloads"
              :options="concurrencyOptions"
              @update:model-value="(v) => updateSetting('maxConcurrentDownloads', v)"
            />
          </div>

          <!-- Connections per download -->
          <div class="flex items-center justify-between px-4 py-3.5" style="border-bottom: 0.5px solid rgba(var(--glass-rgb), 0.06)">
            <div>
              <p class="text-[13px] font-medium text-white/85">Connections per download</p>
              <p class="mt-0.5 text-[11px] text-white/35">More connections = faster downloads</p>
            </div>
            <CustomSelect
              :model-value="settings.connectionsPerDownload"
              :options="connectionsOptions"
              @update:model-value="(v) => updateSetting('connectionsPerDownload', v)"
            />
          </div>

          <!-- Duplicate naming -->
          <div class="flex items-center justify-between px-4 py-3.5">
            <div>
              <p class="text-[13px] font-medium text-white/85">Duplicate files</p>
              <p class="mt-0.5 text-[11px] text-white/35">Behavior when file name already exists</p>
            </div>
            <CustomSelect
              :model-value="settings.duplicateNameBehavior"
              :options="duplicateOptions"
              @update:model-value="(v) => updateSetting('duplicateNameBehavior', v)"
            />
          </div>
        </div>
      </section>

      <!-- Section: Behavior -->
      <section class="mb-7">
        <h3 class="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/30">
          Behavior
        </h3>
        <div
          class="overflow-hidden rounded-xl"
          style="background: rgba(var(--glass-rgb), 0.04); box-shadow: 0 0 0 0.5px rgba(var(--glass-rgb), 0.08)"
        >
          <!-- Notifications -->
          <div class="flex items-center justify-between px-4 py-3.5" style="border-bottom: 0.5px solid rgba(var(--glass-rgb), 0.06)">
            <div>
              <p class="text-[13px] font-medium text-white/85">Notifications</p>
              <p class="mt-0.5 text-[11px] text-white/35">Desktop alerts for completed and failed downloads</p>
            </div>
            <button
              @click="toggleNotifications"
              class="relative h-[22px] w-9 rounded-full transition-colors duration-200"
              :class="settings.notificationsEnabled ? 'bg-emerald-500/60' : 'bg-white/10'"
            >
              <span
                class="absolute top-[3px] block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                :class="settings.notificationsEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'"
              />
            </button>
          </div>

          <!-- Theme -->
          <div class="flex items-center justify-between px-4 py-3.5" style="border-bottom: 0.5px solid rgba(var(--glass-rgb), 0.06)">
            <div>
              <p class="text-[13px] font-medium text-white/85">Appearance</p>
              <p class="mt-0.5 text-[11px] text-white/35">Choose light, dark, or follow system</p>
            </div>
            <CustomSelect
              :modelValue="settings.theme"
              :options="themeOptions"
              @update:modelValue="(v) => updateSetting('theme', v)"
            />
          </div>

          <!-- Close behavior -->
          <div class="flex items-center justify-between px-4 py-3.5">
            <div>
              <p class="text-[13px] font-medium text-white/85">Close button</p>
              <p class="mt-0.5 text-[11px] text-white/35">Action when the window close button is clicked</p>
            </div>
            <CustomSelect
              :model-value="settings.closeBehavior"
              :options="closeOptions"
              @update:model-value="(v) => updateSetting('closeBehavior', v)"
            />
          </div>
        </div>
      </section>

      <!-- Section: About -->
      <section>
        <h3 class="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/30">
          About
        </h3>
        <div
          class="overflow-hidden rounded-xl px-4 py-3.5"
          style="background: rgba(var(--glass-rgb), 0.04); box-shadow: 0 0 0 0.5px rgba(var(--glass-rgb), 0.08)"
        >
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl" style="background: rgba(var(--glass-rgb), 0.08)">
              <HugeiconsIcon :icon="Download04Icon" :size="18" class="text-white/60" />
            </div>
            <div>
              <p class="text-[13px] font-semibold text-white/85">Easy Download Manager</p>
              <p class="text-[11px] text-white/35">Version 1.0.0</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

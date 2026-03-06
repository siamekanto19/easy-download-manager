import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '../../../shared/types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({
    downloadDirectory: '',
    maxConcurrentDownloads: 3,
    connectionsPerDownload: 8,
    theme: 'dark',
    notificationsEnabled: true,
    duplicateNameBehavior: 'rename',
    closeBehavior: 'minimize'
  })
  const loaded = ref(false)

  async function loadSettings(): Promise<void> {
    try {
      const result = await window.api.settings.getAll()
      settings.value = result
      loaded.value = true
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  async function updateSetting(key: keyof AppSettings, value: string): Promise<void> {
    try {
      await window.api.settings.set(key, value)
      await loadSettings()
    } catch (error) {
      console.error('Failed to update setting:', error)
    }
  }

  return {
    settings,
    loaded,
    loadSettings,
    updateSetting
  }
})

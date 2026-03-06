import { app } from 'electron'
import { join } from 'path'
import { getSetting, setSetting, getAllSettings } from './database'
import type { AppSettings, SettingsKey } from '../../shared/types'

function getDefaultSettings(): AppSettings {
  return {
    downloadDirectory: join(app.getPath('downloads')),
    maxConcurrentDownloads: 3,
    connectionsPerDownload: 8,
    theme: 'system',
    notificationsEnabled: true,
    duplicateNameBehavior: 'rename',
    closeBehavior: 'minimize'
  }
}

export function seedDefaultSettings(): void {
  const defaults = getDefaultSettings()
  for (const [key, value] of Object.entries(defaults)) {
    const existing = getSetting(key)
    if (existing === null) {
      setSetting(key, String(value))
    }
  }
}

export function getAppSettings(): AppSettings {
  const raw = getAllSettings()
  const defaults = getDefaultSettings()
  return {
    downloadDirectory: raw.downloadDirectory ?? defaults.downloadDirectory,
    maxConcurrentDownloads: Number(raw.maxConcurrentDownloads) || defaults.maxConcurrentDownloads,
    connectionsPerDownload: Number(raw.connectionsPerDownload) || defaults.connectionsPerDownload,
    theme: (raw.theme as AppSettings['theme']) ?? defaults.theme,
    notificationsEnabled: raw.notificationsEnabled !== undefined
      ? raw.notificationsEnabled === 'true'
      : defaults.notificationsEnabled,
    duplicateNameBehavior:
      (raw.duplicateNameBehavior as AppSettings['duplicateNameBehavior']) ??
      defaults.duplicateNameBehavior,
    closeBehavior:
      (raw.closeBehavior as AppSettings['closeBehavior']) ?? defaults.closeBehavior
  }
}

export function updateSetting(key: SettingsKey, value: string): void {
  setSetting(key, value)
}

export function getSettingValue(key: SettingsKey): string {
  const defaults = getDefaultSettings()
  return getSetting(key) ?? String(defaults[key])
}

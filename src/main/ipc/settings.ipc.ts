import { ipcMain, nativeTheme } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { getAppSettings, updateSetting } from '../services/settings'
import type { SettingsKey } from '../../shared/types'

export function registerSettingsIPC(): void {
  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => {
    return getAppSettings()
  })

  ipcMain.handle(IPC.SETTINGS_GET, (_event, key: SettingsKey) => {
    const settings = getAppSettings()
    return settings[key]
  })

  ipcMain.handle(IPC.SETTINGS_SET, (_event, key: SettingsKey, value: string) => {
    updateSetting(key, value)

    // Apply theme change immediately
    if (key === 'theme') {
      nativeTheme.themeSource = value as 'system' | 'dark' | 'light'
    }

    return { success: true }
  })
}

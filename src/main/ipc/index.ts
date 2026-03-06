import { registerSettingsIPC } from './settings.ipc'
import { registerDownloadIPC } from './download.ipc'
import { registerShellIPC } from './shell.ipc'
import { registerHistoryIPC } from './history.ipc'

export function registerAllIPC(): void {
  registerSettingsIPC()
  registerDownloadIPC()
  registerShellIPC()
  registerHistoryIPC()
}

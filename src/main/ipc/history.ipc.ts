import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { listHistory, clearHistory, removeHistoryItem } from '../services/database'

export function registerHistoryIPC(): void {
  ipcMain.handle(
    IPC.HISTORY_LIST,
    (_event, options?: { search?: string; status?: string; limit?: number; offset?: number }) => {
      return listHistory(options || {})
    }
  )

  ipcMain.handle(IPC.HISTORY_SEARCH, (_event, query: string) => {
    return listHistory({ search: query })
  })

  ipcMain.handle(IPC.HISTORY_CLEAR, () => {
    clearHistory()
    return { success: true }
  })

  ipcMain.handle(IPC.HISTORY_REMOVE, (_event, id: string) => {
    removeHistoryItem(id)
    return { success: true }
  })
}

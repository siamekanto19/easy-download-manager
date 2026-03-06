import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { IPC } from '../../shared/ipc-channels'

export function registerShellIPC(): void {
  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, (_event, url: string) => {
    return shell.openExternal(url)
  })

  ipcMain.handle(IPC.SHELL_OPEN_PATH, (_event, path: string) => {
    return shell.openPath(path)
  })

  ipcMain.handle(IPC.SHELL_SHOW_ITEM, (_event, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle(IPC.SHELL_SELECT_DIRECTORY, async () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0] || null
  })

  ipcMain.handle(IPC.SHELL_FILE_EXISTS, (_event, path: string) => {
    return existsSync(path)
  })
}

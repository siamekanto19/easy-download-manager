import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import {
  addDownload,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  retryDownload,
  removeDownload,
  removeDownloadWithFile,
  pauseAllDownloads,
  resumeAllDownloads,
  archiveCompletedDownloads
} from '../services/download-engine'
import { listDownloads, getDownloadById } from '../services/database'
import type { AddDownloadRequest } from '../../shared/types'

export function registerDownloadIPC(): void {
  ipcMain.handle(IPC.DOWNLOAD_LIST, () => {
    return listDownloads()
  })

  ipcMain.handle(IPC.DOWNLOAD_GET, (_event, id: string) => {
    return getDownloadById(id)
  })

  ipcMain.handle(IPC.DOWNLOAD_ADD, (_event, request: AddDownloadRequest) => {
    return addDownload(request)
  })

  ipcMain.handle(IPC.DOWNLOAD_PAUSE, (_event, id: string) => {
    return pauseDownload(id)
  })

  ipcMain.handle(IPC.DOWNLOAD_RESUME, (_event, id: string) => {
    return resumeDownload(id)
  })

  ipcMain.handle(IPC.DOWNLOAD_CANCEL, (_event, id: string) => {
    return cancelDownload(id)
  })

  ipcMain.handle(IPC.DOWNLOAD_RETRY, (_event, id: string) => {
    return retryDownload(id)
  })

  ipcMain.handle(IPC.DOWNLOAD_REMOVE, (_event, id: string) => {
    return removeDownload(id)
  })

  ipcMain.handle(IPC.DOWNLOAD_REMOVE_WITH_FILE, (_event, id: string) => {
    return removeDownloadWithFile(id)
  })

  ipcMain.handle(IPC.DOWNLOAD_PAUSE_ALL, () => {
    return pauseAllDownloads()
  })

  ipcMain.handle(IPC.DOWNLOAD_RESUME_ALL, () => {
    return resumeAllDownloads()
  })

  ipcMain.handle(IPC.DOWNLOAD_ARCHIVE_COMPLETED, () => {
    return archiveCompletedDownloads()
  })
}


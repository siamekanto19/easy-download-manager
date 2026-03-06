import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  AppSettings,
  SettingsKey,
  DownloadRecord,
  DownloadHistoryRecord,
  DownloadActionResult,
  AddDownloadRequest,
  DownloadProgressEvent
} from '../shared/types'

export interface DownloadManagerAPI {
  // Settings
  settings: {
    getAll(): Promise<AppSettings>
    get(key: SettingsKey): Promise<unknown>
    set(key: SettingsKey, value: string): Promise<DownloadActionResult>
  }

  // Downloads
  downloads: {
    list(): Promise<DownloadRecord[]>
    get(id: string): Promise<DownloadRecord | null>
    add(request: AddDownloadRequest): Promise<DownloadActionResult>
    pause(id: string): Promise<DownloadActionResult>
    resume(id: string): Promise<DownloadActionResult>
    cancel(id: string): Promise<DownloadActionResult>
    retry(id: string): Promise<DownloadActionResult>
    remove(id: string): Promise<DownloadActionResult>
    removeWithFile(id: string): Promise<DownloadActionResult>
    pauseAll(): Promise<DownloadActionResult>
    resumeAll(): Promise<DownloadActionResult>
    archiveCompleted(): Promise<DownloadActionResult>
    onProgress(callback: (event: DownloadProgressEvent) => void): () => void
    onStatusChanged(
      callback: (event: { id: string; status: string; download: DownloadRecord }) => void
    ): () => void
  }

  // History
  history: {
    list(options?: {
      search?: string
      status?: string
      limit?: number
      offset?: number
    }): Promise<DownloadHistoryRecord[]>
    search(query: string): Promise<DownloadHistoryRecord[]>
    clear(): Promise<DownloadActionResult>
    remove(id: string): Promise<DownloadActionResult>
  }

  // Shell / filesystem
  shell: {
    openExternal(url: string): Promise<void>
    openPath(path: string): Promise<string>
    showItemInFolder(path: string): Promise<void>
    selectDirectory(): Promise<string | null>
    fileExists(path: string): Promise<boolean>
  }

  // Window management
  window: {
    openAddDownload(): Promise<void>
    closeSelf(): Promise<void>
  }
}

const api: DownloadManagerAPI = {
  settings: {
    getAll: () => ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
    get: (key) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: (key, value) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value)
  },

  downloads: {
    list: () => ipcRenderer.invoke(IPC.DOWNLOAD_LIST),
    get: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_GET, id),
    add: (request) => ipcRenderer.invoke(IPC.DOWNLOAD_ADD, request),
    pause: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_PAUSE, id),
    resume: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_RESUME, id),
    cancel: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_CANCEL, id),
    retry: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_RETRY, id),
    remove: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_REMOVE, id),
    removeWithFile: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_REMOVE_WITH_FILE, id),
    pauseAll: () => ipcRenderer.invoke(IPC.DOWNLOAD_PAUSE_ALL),
    resumeAll: () => ipcRenderer.invoke(IPC.DOWNLOAD_RESUME_ALL),
    archiveCompleted: () => ipcRenderer.invoke(IPC.DOWNLOAD_ARCHIVE_COMPLETED),
    onProgress: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: DownloadProgressEvent): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.DOWNLOAD_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC.DOWNLOAD_PROGRESS, handler)
    },
    onStatusChanged: (callback) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { id: string; status: string; download: DownloadRecord }
      ): void => {
        callback(data)
      }
      ipcRenderer.on(IPC.DOWNLOAD_STATUS_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.DOWNLOAD_STATUS_CHANGED, handler)
    }
  },

  history: {
    list: (options) => ipcRenderer.invoke(IPC.HISTORY_LIST, options),
    search: (query) => ipcRenderer.invoke(IPC.HISTORY_SEARCH, query),
    clear: () => ipcRenderer.invoke(IPC.HISTORY_CLEAR),
    remove: (id) => ipcRenderer.invoke(IPC.HISTORY_REMOVE, id)
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke(IPC.SHELL_OPEN_EXTERNAL, url),
    openPath: (path) => ipcRenderer.invoke(IPC.SHELL_OPEN_PATH, path),
    showItemInFolder: (path) => ipcRenderer.invoke(IPC.SHELL_SHOW_ITEM, path),
    selectDirectory: () => ipcRenderer.invoke(IPC.SHELL_SELECT_DIRECTORY),
    fileExists: (path) => ipcRenderer.invoke(IPC.SHELL_FILE_EXISTS, path)
  },

  window: {
    openAddDownload: () => ipcRenderer.invoke(IPC.WINDOW_OPEN_ADD_DOWNLOAD),
    closeSelf: () => ipcRenderer.invoke(IPC.WINDOW_CLOSE_SELF)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose API via contextBridge:', error)
  }
} else {
  // @ts-ignore fallback for non-isolated context
  window.api = api
}

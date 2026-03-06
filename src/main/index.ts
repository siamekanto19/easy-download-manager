import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { initDatabase, closeDatabase } from './services/database'
import { seedDefaultSettings, getAppSettings } from './services/settings'
import { registerAllIPC } from './ipc'
import { destroyAllDownloads, restoreInterruptedDownloads } from './services/download-engine'
import { IPC } from '../shared/ipc-channels'

const isDev = !app.isPackaged
const isMac = process.platform === 'darwin'

let mainWindow: BrowserWindow | null = null
let addDownloadWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 12 },
    roundedCorners: true,
    backgroundColor: '#000000',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function openAddDownloadWindow(): void {
  // If already open, just focus it
  if (addDownloadWindow && !addDownloadWindow.isDestroyed()) {
    addDownloadWindow.focus()
    return
  }

  addDownloadWindow = new BrowserWindow({
    width: 520,
    height: 540,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 14 },
    roundedCorners: true,
    backgroundColor: '#000000',
    parent: mainWindow || undefined,
    modal: false,
    show: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  addDownloadWindow.on('ready-to-show', () => {
    addDownloadWindow?.show()
  })

  addDownloadWindow.on('closed', () => {
    addDownloadWindow = null
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    addDownloadWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#add-download')
  } else {
    addDownloadWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'add-download'
    })
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.easy-download-manager')
  }

  // Initialize database and seed settings
  initDatabase()
  seedDefaultSettings()

  // Apply theme from settings
  const settings = getAppSettings()
  nativeTheme.themeSource = settings.theme

  // Register IPC handlers
  registerAllIPC()

  // Window management IPC
  ipcMain.handle(IPC.WINDOW_OPEN_ADD_DOWNLOAD, () => {
    openAddDownloadWindow()
  })

  ipcMain.handle(IPC.WINDOW_CLOSE_SELF, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && win !== mainWindow) {
      win.close()
    }
  })

  createWindow()

  // Restore any downloads that were interrupted by app closure
  restoreInterruptedDownloads()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  destroyAllDownloads()
  closeDatabase()
})

/// <reference types="vite/client" />

import type { DownloadManagerAPI } from '../../preload/index'

declare global {
  interface Window {
    api: DownloadManagerAPI
  }
}

export const IPC = {
  // Downloads
  DOWNLOAD_ADD: 'download:add',
  DOWNLOAD_PAUSE: 'download:pause',
  DOWNLOAD_RESUME: 'download:resume',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_RETRY: 'download:retry',
  DOWNLOAD_REMOVE: 'download:remove',
  DOWNLOAD_REMOVE_WITH_FILE: 'download:remove-with-file',
  DOWNLOAD_LIST: 'download:list',
  DOWNLOAD_GET: 'download:get',
  DOWNLOAD_PAUSE_ALL: 'download:pause-all',
  DOWNLOAD_RESUME_ALL: 'download:resume-all',
  DOWNLOAD_ARCHIVE_COMPLETED: 'download:archive-completed',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_STATUS_CHANGED: 'download:status-changed',

  // History
  HISTORY_LIST: 'history:list',
  HISTORY_SEARCH: 'history:search',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_REMOVE: 'history:remove',

  // Settings
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Shell / filesystem
  SHELL_OPEN_EXTERNAL: 'shell:open-external',
  SHELL_OPEN_PATH: 'shell:open-path',
  SHELL_SHOW_ITEM: 'shell:show-item',
  SHELL_SELECT_DIRECTORY: 'shell:select-directory',
  SHELL_FILE_EXISTS: 'shell:file-exists',

  // Window management
  WINDOW_OPEN_ADD_DOWNLOAD: 'window:open-add-download',
  WINDOW_CLOSE_SELF: 'window:close-self'
} as const

export type IPCChannel = (typeof IPC)[keyof typeof IPC]

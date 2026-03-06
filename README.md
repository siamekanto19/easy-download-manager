# Easy Download Manager

A fast, lightweight desktop download manager built with Electron, Vue 3, and TypeScript. Features multi-connection downloads, a queue system, and a polished UI with dark/light theme support.

## Features

- **Multi-connection downloads** — Split files across multiple connections for faster speeds (configurable 1–32 connections per download)
- **Download queue** — Configurable concurrent download limit with auto-start when slots open
- **Pause / Resume / Cancel / Retry** — Full download lifecycle control
- **Download history** — Searchable history with filters and sort
- **Theme support** — System, Dark, and Light modes via native OS integration
- **Add Download window** — Dedicated window for adding new downloads with URL validation and auto filename detection
- **File management** — Open downloaded files, reveal in Finder, delete from disk on removal
- **Desktop notifications** — Alerts for completed and failed downloads
- **Persistent state** — Downloads survive app restarts with automatic restoration
- **Duplicate detection** — Prevents duplicate downloads with configurable handling (rename, overwrite, skip)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Electron](https://www.electronjs.org/) 40 |
| Frontend | [Vue 3](https://vuejs.org/) (Composition API) |
| Language | TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| State | [Pinia](https://pinia.vuejs.org/) |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Downloads | [easydl](https://github.com/nicedaycode/easydl) |
| Icons | [Hugeicons](https://hugeicons.com/) |
| Build | [electron-vite](https://electron-vite.org/) + [electron-builder](https://www.electron.build/) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

The packaged app will be output to the `dist/` directory.

## Project Structure

```
src/
├── main/              # Electron main process
│   ├── services/      # Database, settings, download engine
│   └── ipc/           # IPC handlers (downloads, settings, shell, history)
├── preload/           # Preload bridge (contextBridge API)
├── renderer/          # Vue 3 frontend
│   └── src/
│       ├── assets/    # Global CSS (design tokens, light/dark themes)
│       ├── components/# Reusable UI components
│       ├── stores/    # Pinia stores (downloads, settings, UI)
│       └── views/     # Page views (Downloads, History, Settings)
└── shared/            # Shared types and IPC channel definitions
```

## License

MIT

<p align="center">
  <img src="icon.png" alt="Easy Download Manager" width="128" height="128">
</p>

<h1 align="center">Easy Download Manager</h1>

<p align="center">
  <strong>A modern, open-source download manager built with Go and React.</strong><br>
  Multi-connection segmented downloads · Pause & Resume · Beautiful UI · Native performance.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#development">Development</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## ✨ Features

### ⚡ Multi-Connection Segmented Downloads
Just like IDM — files are split into multiple segments and downloaded in parallel using HTTP byte-range requests. Each segment runs on its own connection, maximizing your bandwidth.

- Configurable **1–16 connections** per download
- **Per-segment progress bars** in the UI
- Automatic fallback to single-connection for small files or servers without range support

### 🔄 Pause & Resume
Pause active downloads and resume them later. The app detects whether the server supports resume via `Accept-Ranges` headers and only shows the pause button when it's actually supported.

### 📁 Smart File Naming
- Auto-detects filenames from `Content-Disposition` headers
- Falls back to URL path with proper URL-decoding
- Adds correct file extensions from `Content-Type` when missing
- URL probing in the Add Download dialog shows filename, file size, and resume support *before* you start

### 🎯 Download Management
- **Concurrent download slots** — configurable limit (default: 4)
- **Download queue** — excess downloads are queued and auto-started when a slot opens
- **Retry failed downloads** with one click
- **Cancel** active or queued downloads
- **Remove** with optional file deletion from disk

### 📋 Download History
- Full history of completed, failed, and cancelled downloads
- **Search** through history
- Clear individual entries or all history

### 🔔 Native Notifications
OS-level notifications when downloads complete — works on macOS, Linux, and Windows.

### 🎨 Beautiful, Modern UI
- **Dark & Light themes** with system preference detection
- Clean, minimal design with smooth animations
- **Drag & drop** URLs directly onto the app window
- **Keyboard shortcuts** for power users
- Sticky headers with scrollable content areas

### 🛠️ Configurable Settings
- Default download directory
- Max concurrent downloads (1–10)
- Connections per download (1–16)
- Toggle notifications
- Theme selection (System / Light / Dark)

---

## 📦 Installation

### macOS

Download the latest `.app` bundle from [Releases](../../releases) and drag it to your Applications folder.

### Build from Source

See [Development](#development) below.

---

## 🚀 Development

### Prerequisites

| Tool | Version |
|------|---------|
| [Go](https://go.dev/dl/) | 1.24+ |
| [Node.js](https://nodejs.org/) | 18+ |
| [Wails CLI](https://wails.io/docs/gettingstarted/installation) | v2.11+ |

Install the Wails CLI:
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### Clone & Run

```bash
git clone https://github.com/YOUR_USERNAME/easy-download-manager.git
cd easy-download-manager

# Live development with hot reload
wails dev
```

The app launches natively. Frontend changes hot-reload instantly via Vite.

### Build for Production

```bash
wails build
```

The built application is at:
```
build/bin/Easy Download Manager.app/   # macOS
build/bin/easy-download-manager        # Linux
build/bin/easy-download-manager.exe    # Windows
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Go 1.24 |
| **Desktop Framework** | [Wails v2](https://wails.io/) |
| **Frontend** | React 19, TypeScript |
| **Styling** | Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com/) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) |
| **Database** | SQLite (via [modernc.org/sqlite](https://modernc.org/sqlite)) |
| **Icons** | [Hugeicons](https://hugeicons.com/) |
| **Notifications** | [beeep](https://github.com/gen2brain/beeep) (native OS notifications) |
| **Build Tool** | [Vite](https://vitejs.dev/) |

### Project Structure

```
├── app.go                    # Main application logic & Wails bindings
├── main.go                   # Application entry point
├── internal/
│   ├── domain/               # Domain models (Download, HistoryEntry)
│   ├── downloader/
│   │   ├── downloader.go     # Single-connection HTTP downloader
│   │   ├── segmented.go      # Multi-connection segmented downloader
│   │   └── types.go          # Downloader interfaces & types
│   ├── orchestrator/         # Download lifecycle management & queue
│   ├── storage/              # SQLite repositories
│   └── services/             # Settings service
├── frontend/
│   └── src/
│       ├── components/       # Reusable UI components (shadcn/ui)
│       ├── features/         # Feature modules (download list, add dialog)
│       ├── hooks/            # Custom React hooks
│       ├── stores/           # Zustand state stores
│       └── views/            # Page-level views
└── build/                    # Build assets & platform configs
```

---

## 🔧 How Segmented Downloads Work

```
┌──────────────────────────────────────────┐
│              100 MB File                 │
├──────────┬──────────┬──────────┬─────────┤
│ Segment 0│ Segment 1│ Segment 2│Segment 3│
│  25 MB   │  25 MB   │  25 MB   │ 25 MB   │
│ conn #1  │ conn #2  │ conn #3  │ conn #4 │
└────┬─────┴────┬─────┴────┬─────┴────┬────┘
     │          │          │          │
     ▼          ▼          ▼          ▼
   HTTP       HTTP       HTTP       HTTP
  Range      Range      Range      Range
 0-25MB    25-50MB    50-75MB   75-100MB
     │          │          │          │
     └──────────┴──────────┴──────────┘
                    │
              Merge on disk
                    │
                    ▼
             Final file.zip
```

1. **Probe** — HEAD request checks `Accept-Ranges: bytes` and `Content-Length`
2. **Segment** — File split into N equal byte ranges
3. **Download** — Each segment uses its own HTTP connection with `Range` header
4. **Merge** — Segments concatenated in order to produce the final file
5. **Fallback** — Single-connection for files < 1 MB or servers without range support

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Ideas for Contribution
- [ ] Browser extension for intercepting downloads
- [ ] Download speed limiting / bandwidth throttling
- [ ] Download scheduling
- [ ] Torrent / magnet link support
- [ ] Windows & Linux packaging (`.msi`, `.deb`, `.AppImage`)
- [ ] Auto-update mechanism
- [ ] Download categories & tags

---

## 📄 License

This project is open source. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ using <a href="https://wails.io">Wails</a>, <a href="https://go.dev">Go</a>, and <a href="https://react.dev">React</a>
</p>

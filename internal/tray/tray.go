package tray

import (
	"fmt"
	"sync"

	"fyne.io/systray"
)

// TrayManager manages the macOS menu bar icon and download progress display.
type TrayManager struct {
	mu          sync.Mutex
	downloads   map[string]*downloadInfo
	menuItems   map[string]*systray.MenuItem
	mShow       *systray.MenuItem
	mQuit       *systray.MenuItem
	icon        []byte
	onShow      func()
	onQuit      func()
	ready       bool
}

type downloadInfo struct {
	fileName string
	percent  float64
	speed    int64
	status   string
}

// NewTrayManager creates a new system tray manager.
func NewTrayManager(icon []byte, onShow func(), onQuit func()) *TrayManager {
	return &TrayManager{
		downloads: make(map[string]*downloadInfo),
		menuItems: make(map[string]*systray.MenuItem),
		icon:      icon,
		onShow:    onShow,
		onQuit:    onQuit,
	}
}

// Run starts the systray. This MUST be called from the main goroutine on macOS,
// or via systray.Run which handles the thread locking.
func (t *TrayManager) Run() {
	systray.Run(t.onReady, t.onExit)
}

// RunAsync starts systray in a way compatible with running alongside Wails.
func (t *TrayManager) RunAsync() {
	go systray.Run(t.onReady, t.onExit)
}

func (t *TrayManager) onReady() {
	systray.SetIcon(t.icon)
	systray.SetTooltip("Easy Download Manager")

	// Static menu items
	mTitle := systray.AddMenuItem("Easy Download Manager", "")
	mTitle.Disable()

	systray.AddSeparator()

	t.mu.Lock()
	t.mShow = systray.AddMenuItem("Show Window", "Bring the application to the front")
	t.mQuit = systray.AddMenuItem("Quit", "Quit the application")
	t.ready = true
	t.mu.Unlock()

	// Handle clicks
	go func() {
		for {
			select {
			case <-t.mShow.ClickedCh:
				if t.onShow != nil {
					t.onShow()
				}
			case <-t.mQuit.ClickedCh:
				if t.onQuit != nil {
					t.onQuit()
				}
			}
		}
	}()
}

func (t *TrayManager) onExit() {
	// Cleanup
}

// UpdateDownloadProgress updates or adds a download's progress in the tray menu.
func (t *TrayManager) UpdateDownloadProgress(id, fileName string, percent float64, speedBPS int64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if !t.ready {
		return
	}

	info, exists := t.downloads[id]
	if !exists {
		info = &downloadInfo{fileName: fileName, status: "downloading"}
		t.downloads[id] = info
	}

	info.fileName = fileName
	info.percent = percent
	info.speed = speedBPS

	label := t.formatMenuLabel(info)

	menuItem, hasMenu := t.menuItems[id]
	if !hasMenu {
		// Insert before the separator (after title)
		menuItem = systray.AddMenuItem(label, fileName)
		menuItem.Disable() // Info only, not clickable
		t.menuItems[id] = menuItem
	} else {
		menuItem.SetTitle(label)
	}

	t.updateTooltip()
}

// CompleteDownload marks a download as complete in the tray.
func (t *TrayManager) CompleteDownload(id, fileName string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if !t.ready {
		return
	}

	// Remove from active downloads
	delete(t.downloads, id)
	if menuItem, ok := t.menuItems[id]; ok {
		menuItem.Hide()
		delete(t.menuItems, id)
	}

	t.updateTooltip()
}

// RemoveDownload removes a download from the tray menu.
func (t *TrayManager) RemoveDownload(id string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if !t.ready {
		return
	}

	delete(t.downloads, id)
	if menuItem, ok := t.menuItems[id]; ok {
		menuItem.Hide()
		delete(t.menuItems, id)
	}

	t.updateTooltip()
}

func (t *TrayManager) formatMenuLabel(info *downloadInfo) string {
	pct := int(info.percent)
	if info.speed > 0 {
		return fmt.Sprintf("↓ %s — %d%% (%s/s)", truncateStr(info.fileName, 25), pct, formatBytes(info.speed))
	}
	return fmt.Sprintf("↓ %s — %d%%", truncateStr(info.fileName, 25), pct)
}

func (t *TrayManager) updateTooltip() {
	count := len(t.downloads)
	if count == 0 {
		systray.SetTooltip("Easy Download Manager")
	} else if count == 1 {
		systray.SetTooltip("Easy Download Manager — 1 active download")
	} else {
		systray.SetTooltip(fmt.Sprintf("Easy Download Manager — %d active downloads", count))
	}
}

func truncateStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-1] + "…"
}

func formatBytes(b int64) string {
	const (
		kb = 1024
		mb = kb * 1024
		gb = mb * 1024
	)
	switch {
	case b >= gb:
		return fmt.Sprintf("%.1f GB", float64(b)/float64(gb))
	case b >= mb:
		return fmt.Sprintf("%.1f MB", float64(b)/float64(mb))
	case b >= kb:
		return fmt.Sprintf("%.0f KB", float64(b)/float64(kb))
	default:
		return fmt.Sprintf("%d B", b)
	}
}

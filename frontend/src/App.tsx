import { Sidebar } from "@/components/layout/Sidebar";
import { Toolbar } from "@/components/layout/Toolbar";
import { ContentPane } from "@/components/layout/ContentPane";
import { DownloadsView } from "@/views/DownloadsView";
import { HistoryView } from "@/views/HistoryView";
import { SettingsView } from "@/views/SettingsView";
import { useAppStore } from "@/stores/app-store";
import { useDownloadEvents } from "@/hooks/use-download-events";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { DropOverlay } from "@/components/DropOverlay";

function App() {
  const currentView = useAppStore((s) => s.currentView);

  useDownloadEvents();
  useKeyboardShortcuts();

  const viewMap = {
    downloads: <DownloadsView />,
    history: <HistoryView />,
    settings: <SettingsView />,
  } as const;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Toolbar />
        <ContentPane>{viewMap[currentView]}</ContentPane>
      </div>
      <DropOverlay />
    </div>
  );
}

export default App;

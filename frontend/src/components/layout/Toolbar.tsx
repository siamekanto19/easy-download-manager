import { useAppStore, type AppView } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, SearchingIcon } from "@hugeicons/core-free-icons";

const viewTitles: Record<AppView, string> = {
  downloads: "Downloads",
  history: "History",
  settings: "Settings",
};

export function Toolbar() {
  const { currentView, searchQuery, setSearchQuery, setAddDialogOpen } = useAppStore();

  return (
    <header className="wails-drag flex items-center h-16 px-6 bg-background">
      <h1 className="text-lg font-semibold text-foreground select-none">
        {viewTitles[currentView]}
      </h1>

      <div className="flex-1" />

      {currentView !== "settings" && (
        <div className="relative mr-3" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <HugeiconsIcon
            icon={SearchingIcon}
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="w-[240px] h-10 pl-10 text-sm"
          />
        </div>
      )}

      {currentView === "downloads" && (
        <Button
          size="lg"
          onClick={() => setAddDialogOpen(true)}
          className="gap-2 cursor-default"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <HugeiconsIcon icon={PlusSignIcon} size={18} />
          Add Download
        </Button>
      )}
    </header>
  );
}

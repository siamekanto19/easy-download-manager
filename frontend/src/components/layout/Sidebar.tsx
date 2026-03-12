import { cn } from "@/lib/utils";
import { useAppStore, type AppView } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InboxDownloadIcon,
  TimeScheduleIcon,
  DashboardSquareSettingIcon,
} from "@hugeicons/core-free-icons";

const navItems: { view: AppView; label: string; icon: typeof InboxDownloadIcon }[] = [
  { view: "downloads", label: "Downloads", icon: InboxDownloadIcon },
  { view: "history", label: "History", icon: TimeScheduleIcon },
  { view: "settings", label: "Settings", icon: DashboardSquareSettingIcon },
];

export function Sidebar() {
  const { currentView, setView } = useAppStore();

  return (
    <aside className="wails-drag flex flex-col shrink-0 w-[240px] min-w-[240px] bg-sidebar text-sidebar-foreground">
      {/* Traffic light clearance */}
      <div className="h-14 shrink-0" />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {navItems.map(({ view, label, icon }) => {
          const isActive = currentView === view;
          return (
            <Tooltip key={view}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="lg"
                  className={cn(
                    "w-full justify-start gap-3 cursor-default text-sm",
                    isActive && "font-semibold"
                  )}
                  onClick={() => setView(view)}
                >
                  <HugeiconsIcon icon={icon} size={20} />
                  {label}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4">
        <p className="text-xs text-muted-foreground select-none">v0.1.0</p>
      </div>
    </aside>
  );
}

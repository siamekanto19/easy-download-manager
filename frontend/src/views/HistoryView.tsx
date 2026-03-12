import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn, formatBytes } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  TimeScheduleIcon,
  DeleteThrowIcon,
  EarthIcon,
  FolderOpenIcon,
  FileExportIcon,
} from "@hugeicons/core-free-icons";
import {
  GetHistory,
  DeleteHistoryEntry,
  ClearHistory,
  OpenFile,
  RevealInFolder,
} from "../../wailsjs/go/main/App";
import { useAppStore } from "@/stores/app-store";

interface HistoryEntry {
  id: string;
  downloadId: string;
  url: string;
  fileName: string;
  targetPath: string;
  finalStatus: string;
  totalBytes: number;
  startedAt: string | null;
  endedAt: string | null;
  attemptNumber: number;
  actionSummary: string;
  errorMessage: string;
  createdAt: string;
}

type StatusKey = "completed" | "failed" | "cancelled" | "interrupted" | "removed" | "retried";

const statusVariants: Record<StatusKey, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  completed: { label: "Completed", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
  interrupted: { label: "Interrupted", variant: "outline" },
  removed: { label: "Removed", variant: "outline" },
  retried: { label: "Retried", variant: "outline" },
};

export function HistoryView() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const searchQuery = useAppStore((s) => s.searchQuery);

  const loadHistory = async () => {
    try {
      const data = await GetHistory();
      setEntries((data as unknown as HistoryEntry[]) ?? []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.fileName.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  const handleDelete = async (id: string) => {
    try {
      await DeleteHistoryEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete history entry:", err);
    }
  };

  const handleClearAll = async () => {
    try {
      await ClearHistory();
      setEntries([]);
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  const handleOpen = (path: string) => {
    if (path) OpenFile(path).catch(console.error);
  };

  const handleReveal = (path: string) => {
    if (path) RevealInFolder(path).catch(console.error);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-muted mb-6">
          <HugeiconsIcon icon={TimeScheduleIcon} size={36} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          No History
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Completed and failed downloads will be recorded here for reference.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Clear All */}
      <div className="flex items-center justify-between px-6 py-3">
        <p className="text-sm text-muted-foreground">
          {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-default"
            >
              Clear All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all history?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove all download history entries. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-default">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearAll}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-default"
              >
                Clear All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {filteredEntries.map((entry) => {
          const sv = statusVariants[entry.finalStatus as StatusKey] ?? { label: entry.finalStatus, variant: "outline" as const };
          let hostname = "";
          try { hostname = new URL(entry.url).hostname; } catch { hostname = entry.url; }

          const endedDate = entry.endedAt ? new Date(entry.endedAt) : null;

          return (
            <div
              key={entry.id}
              className="group px-4 py-4 hover:bg-muted/50 transition-colors rounded-xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {entry.fileName}
                    </h3>
                    <Badge variant={sv.variant} className="shrink-0">
                      {sv.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HugeiconsIcon icon={EarthIcon} size={16} className="shrink-0" />
                    <span className="truncate max-w-[200px]">{hostname}</span>
                    {entry.totalBytes > 0 && (
                      <>
                        <span>·</span>
                        <span className="shrink-0">{formatBytes(entry.totalBytes)}</span>
                      </>
                    )}
                    {endedDate && (
                      <>
                        <span>·</span>
                        <span className="shrink-0">{formatRelativeTime(endedDate)}</span>
                      </>
                    )}
                  </div>

                  {entry.errorMessage && (
                    <p className="mt-1.5 text-sm text-destructive truncate">
                      {entry.errorMessage}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {entry.targetPath && entry.finalStatus === "completed" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-default h-9 w-9"
                          onClick={() => handleOpen(entry.targetPath)}
                        >
                          <HugeiconsIcon icon={FileExportIcon} size={18} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Open File</TooltipContent>
                    </Tooltip>
                  )}
                  {entry.targetPath && entry.finalStatus === "completed" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-default h-9 w-9"
                          onClick={() => handleReveal(entry.targetPath)}
                        >
                          <HugeiconsIcon icon={FolderOpenIcon} size={18} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Reveal in Folder</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("cursor-default h-9 w-9 hover:text-destructive hover:bg-destructive/10")}
                        onClick={() => handleDelete(entry.id)}
                      >
                        <HugeiconsIcon icon={DeleteThrowIcon} size={18} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Remove</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return "just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)}d ago`;
  return date.toLocaleDateString();
}

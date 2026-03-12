import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatBytes, formatSpeed, formatETA, extractHostname } from "@/lib/utils";
import type { Download } from "@/stores/download-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CancelDownload,
  RemoveDownload,
  RemoveDownloadAndFile,
  StartDownload,
  PauseDownload,
  RetryDownload,
  OpenFile,
  RevealInFolder,
} from "../../../wailsjs/go/main/App";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CancelCircleIcon,
  PlayIcon,
  PauseIcon,
  RefreshIcon,
  DeleteThrowIcon,
  EarthIcon,
  FileExportIcon,
  FolderOpenIcon,
  CopyIcon,
} from "@hugeicons/core-free-icons";

interface DownloadRowProps {
  download: Download;
}

type StatusKey = "queued" | "downloading" | "paused" | "completed" | "failed" | "cancelled" | "interrupted";

const statusVariants: Record<StatusKey, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  queued: { label: "Queued", variant: "secondary" },
  downloading: { label: "Downloading", variant: "default" },
  paused: { label: "Paused", variant: "outline" },
  completed: { label: "Completed", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
  interrupted: { label: "Interrupted", variant: "outline" },
};

export function DownloadRow({ download }: DownloadRowProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteFile, setDeleteFile] = useState(false);

  const sv = statusVariants[download.status as StatusKey] ?? { label: "Unknown", variant: "outline" as const };
  const isActive = download.status === "downloading";
  const isPaused = download.status === "paused";
  const isCompleted = download.status === "completed";
  const isFailed = download.status === "failed";
  const isCancelled = download.status === "cancelled";
  const isInterrupted = download.status === "interrupted";
  const isQueued = download.status === "queued";
  const showProgress = isActive || isPaused;
  const hostname = extractHostname(download.url);

  const handleStart = () => StartDownload(download.id).catch(console.error);
  const handlePause = () => PauseDownload(download.id).catch(console.error);
  const handleCancel = () => CancelDownload(download.id).catch(console.error);
  const handleRetry = () => RetryDownload(download.id).catch(console.error);
  const handleRemoveClick = () => {
    setDeleteFile(false);
    setShowDeleteDialog(true);
  };
  const handleConfirmRemove = () => {
    if (deleteFile) {
      RemoveDownloadAndFile(download.id).catch(console.error);
    } else {
      RemoveDownload(download.id).catch(console.error);
    }
    setShowDeleteDialog(false);
  };
  const handleOpen = () => {
    if (download.targetPath) OpenFile(download.targetPath).catch(console.error);
  };
  const handleReveal = () => {
    if (download.targetPath) RevealInFolder(download.targetPath).catch(console.error);
  };
  const handleCopyURL = () => {
    navigator.clipboard.writeText(download.url).catch(console.error);
  };

  return (
    <>
      <div className="group px-4 py-4 hover:bg-muted/50 transition-colors rounded-xl mx-3 cursor-default">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <h3 className="text-sm font-medium text-foreground truncate">
                {download.fileName}
              </h3>
              <Badge variant={sv.variant} className="shrink-0">
                {sv.label}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon icon={EarthIcon} size={16} className="shrink-0" />
              <span className="truncate max-w-[200px]">{hostname}</span>
              {download.totalBytes > 0 && (
                <>
                  <span>·</span>
                  <span className="shrink-0">
                    {formatBytes(download.downloadedBytes)} / {formatBytes(download.totalBytes)}
                  </span>
                </>
              )}
              {isActive && download.speedBytesPerSec > 0 && (
                <>
                  <span>·</span>
                  <span className="text-foreground font-medium shrink-0">
                    {formatSpeed(download.speedBytesPerSec)}
                  </span>
                  <span>·</span>
                  <span className="shrink-0">{formatETA(download.etaSeconds)}</span>
                </>
              )}
            </div>

            {showProgress && (
              <div className="mt-3 space-y-2">
                {/* Main progress bar */}
                <Progress
                  value={Math.min(download.progressPercent, 100)}
                  className={cn("h-2", isPaused && "opacity-50")}
                />

                {/* Per-segment progress bars */}
                {download.segments && download.segments.length > 1 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      {download.segments.map((seg) => (
                        <div key={seg.index} className="flex-1 min-w-0">
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/70 transition-all duration-300"
                              style={{ width: `${Math.min(seg.percent, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {download.segments.length} segments · {download.segments.filter(s => s.percent >= 100).length} complete
                    </p>
                  </div>
                )}
              </div>
            )}

            {download.errorMessage && isFailed && (
              <p className="mt-2 text-sm text-destructive truncate">
                {download.errorMessage}
              </p>
            )}
          </div>

          {/* Hover Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {(isQueued || isPaused) && (
              <ActionButton icon={PlayIcon} label={isPaused ? "Resume" : "Start"} onClick={handleStart} />
            )}
            {isActive && download.canResume && (
              <ActionButton icon={PauseIcon} label="Pause" onClick={handlePause} />
            )}
            {isActive && (
              <ActionButton icon={CancelCircleIcon} label="Cancel" onClick={handleCancel} />
            )}
            {(isFailed || isInterrupted || isCancelled) && (
              <ActionButton icon={RefreshIcon} label="Retry" onClick={handleRetry} />
            )}
            {isCompleted && download.targetPath && (
              <ActionButton icon={FileExportIcon} label="Open File" onClick={handleOpen} />
            )}
            {isCompleted && download.targetPath && (
              <ActionButton icon={FolderOpenIcon} label="Reveal in Folder" onClick={handleReveal} />
            )}
            <ActionButton icon={CopyIcon} label="Copy URL" onClick={handleCopyURL} />
            {(isCompleted || isFailed || isCancelled || isInterrupted) && (
              <ActionButton icon={DeleteThrowIcon} label="Remove" onClick={handleRemoveClick} destructive />
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove download?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-medium text-foreground">{download.fileName}</span> from your download list.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isCompleted && download.targetPath && (
            <div className="flex items-center gap-3 py-1">
              <Checkbox
                id={`delete-file-${download.id}`}
                checked={deleteFile}
                onCheckedChange={(v) => setDeleteFile(v === true)}
              />
              <label htmlFor={`delete-file-${download.id}`} className="text-sm text-muted-foreground cursor-pointer select-none">
                Also delete the file from disk
              </label>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-default">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-default"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: typeof PlayIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "cursor-default h-9 w-9",
            destructive && "hover:text-destructive hover:bg-destructive/10"
          )}
          onClick={onClick}
        >
          <HugeiconsIcon icon={icon} size={18} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

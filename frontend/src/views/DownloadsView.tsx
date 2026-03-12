import { useDownloadStore } from "@/stores/download-store";
import { useAppStore } from "@/stores/app-store";
import { DownloadList } from "@/features/download-list/DownloadList";
import { AddDownloadDialog } from "@/features/add-download/AddDownloadDialog";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { InboxDownloadIcon } from "@hugeicons/core-free-icons";

export function DownloadsView() {
  const downloads = useDownloadStore((s) => s.downloads);
  const { addDialogOpen, setAddDialogOpen } = useAppStore();

  if (downloads.length === 0 && !addDialogOpen) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-muted mb-6">
            <HugeiconsIcon icon={InboxDownloadIcon} size={36} className="text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No Downloads Yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Add a URL to start downloading. Your downloads will appear here with live progress.
          </p>
          <Button size="lg" className="mt-8 gap-2 cursor-default" onClick={() => setAddDialogOpen(true)}>
            <HugeiconsIcon icon={InboxDownloadIcon} size={18} />
            Add Your First Download
          </Button>
        </div>
        <AddDownloadDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
      </>
    );
  }

  return (
    <>
      <DownloadList />
      <AddDownloadDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
    </>
  );
}

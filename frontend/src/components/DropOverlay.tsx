import { useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { HugeiconsIcon } from "@hugeicons/react";
import { InboxDownloadIcon } from "@hugeicons/core-free-icons";
import { AddDownload, GetDefaultDownloadDir } from "../../wailsjs/go/main/App";

/**
 * Full-window drag & drop overlay. Drop a URL or text containing a URL
 * to instantly add it as a download.
 */
export function DropOverlay() {
  const [isDragging, setIsDragging] = useState(false);
  const { setAddDialogOpen } = useAppStore();

  const isValidURL = (text: string): string | null => {
    const trimmed = text.trim();
    // Try to find a URL in the text
    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      try {
        new URL(urlMatch[0]);
        return urlMatch[0];
      } catch {
        return null;
      }
    }
    return null;
  };

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only dismiss if we're leaving the window
    if (e.relatedTarget === null) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const text =
        e.dataTransfer?.getData("text/uri-list") ||
        e.dataTransfer?.getData("text/plain") ||
        "";

      const url = isValidURL(text);
      if (url) {
        try {
          const dir = await GetDefaultDownloadDir();
          await AddDownload(url, dir, "", true);
        } catch (err) {
          console.error("Failed to add dropped URL:", err);
        }
      } else {
        // Open dialog so user can paste manually
        setAddDialogOpen(true);
      }
    },
    [setAddDialogOpen]
  );

  useEffect(() => {
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-12 rounded-2xl bg-primary/5 border-2 border-dashed border-primary/30">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10">
          <HugeiconsIcon icon={InboxDownloadIcon} size={36} className="text-primary" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Drop URL to Download</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Drop a link here to start downloading
          </p>
        </div>
      </div>
    </div>
  );
}

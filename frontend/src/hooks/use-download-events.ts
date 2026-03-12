import { useEffect } from "react";
import { useDownloadStore, type Download } from "@/stores/download-store";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { GetAllDownloads } from "../../wailsjs/go/main/App";

/**
 * Hook that sets up Wails event listeners for download progress and status updates.
 * Should be called once at the app root level.
 */
export function useDownloadEvents() {
  const { setDownloads, addDownload, updateProgress, updateStatus, removeDownload } =
    useDownloadStore();

  useEffect(() => {
    // Load existing downloads — cast from Wails-generated types to our store types
    GetAllDownloads()
      .then((downloads) => {
        if (downloads) {
          setDownloads(downloads as unknown as Download[]);
        }
      })
      .catch(console.error);

    // Listen for new downloads
    EventsOn("download:added", (data: unknown) => {
      addDownload(data as Download);
    });

    // Listen for progress updates
    EventsOn("download:progress", (data: unknown) => {
      const d = data as {
        id: string;
        downloadedBytes: number;
        totalBytes: number;
        progressPercent: number;
        speedBytesPerSec: number;
        etaSeconds: number;
        segments?: Array<{
          index: number;
          startByte: number;
          endByte: number;
          downloadedBytes: number;
          totalBytes: number;
          percent: number;
        }>;
      };
      updateProgress(d.id, d.downloadedBytes, d.totalBytes, d.progressPercent, d.speedBytesPerSec, d.etaSeconds, d.segments);
    });

    // Listen for status changes
    EventsOn("download:status", (data: unknown) => {
      const d = data as { id: string; status: string; errorMessage: string };
      updateStatus(d.id, d.status as Download["status"], d.errorMessage);
    });

    // Listen for removals
    EventsOn("download:removed", (data: unknown) => {
      const d = data as { id: string };
      removeDownload(d.id);
    });

    return () => {
      EventsOff("download:added");
      EventsOff("download:progress");
      EventsOff("download:status");
      EventsOff("download:removed");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

import { create } from "zustand";

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export interface SegmentProgress {
  index: number;
  startByte: number;
  endByte: number;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface Download {
  id: string;
  url: string;
  originalUrl: string;
  fileName: string;
  outputDirectory: string;
  targetPath: string;
  tempPath: string;
  status: DownloadStatus;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  sourceHost: string;
  mimeType: string;
  canResume: boolean;
  resumable: boolean;
  errorMessage: string;
  segments?: SegmentProgress[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastUpdatedAt: string;
}

export type StatusFilter = "all" | DownloadStatus;

interface DownloadState {
  downloads: Download[];
  statusFilter: StatusFilter;
  setDownloads: (downloads: Download[]) => void;
  addDownload: (download: Download) => void;
  updateDownload: (id: string, updates: Partial<Download>) => void;
  removeDownload: (id: string) => void;
  updateProgress: (
    id: string,
    downloadedBytes: number,
    totalBytes: number,
    progressPercent: number,
    speedBytesPerSec: number,
    etaSeconds: number,
    segments?: SegmentProgress[]
  ) => void;
  updateStatus: (id: string, status: DownloadStatus, errorMessage?: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  filteredDownloads: () => Download[];
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: [],
  statusFilter: "all",

  setDownloads: (downloads) => set({ downloads }),

  addDownload: (download) =>
    set((state) => ({ downloads: [download, ...state.downloads] })),

  updateDownload: (id, updates) =>
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),

  removeDownload: (id) =>
    set((state) => ({
      downloads: state.downloads.filter((d) => d.id !== id),
    })),

  updateProgress: (id, downloadedBytes, totalBytes, progressPercent, speedBytesPerSec, etaSeconds, segments) =>
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id
          ? { ...d, downloadedBytes, totalBytes, progressPercent, speedBytesPerSec, etaSeconds, segments }
          : d
      ),
    })),

  updateStatus: (id, status, errorMessage = "") =>
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, status, errorMessage, speedBytesPerSec: 0, etaSeconds: 0 } : d
      ),
    })),

  setStatusFilter: (filter) => set({ statusFilter: filter }),

  filteredDownloads: () => {
    const { downloads, statusFilter } = get();
    if (statusFilter === "all") return downloads;
    return downloads.filter((d) => d.status === statusFilter);
  },
}));

import { useDownloadStore } from "@/stores/download-store";
import { DownloadRow } from "./DownloadRow";
import { StatusFilter } from "./StatusFilter";
import { useAppStore } from "@/stores/app-store";

export function DownloadList() {
  const { filteredDownloads } = useDownloadStore();
  const searchQuery = useAppStore((s) => s.searchQuery);

  let downloads = filteredDownloads();

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    downloads = downloads.filter(
      (d) =>
        d.fileName.toLowerCase().includes(q) ||
        d.url.toLowerCase().includes(q) ||
        d.sourceHost.toLowerCase().includes(q)
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky filter bar */}
      <div className="shrink-0">
        <StatusFilter />
      </div>

      {/* Scrollable download list */}
      <div className="flex-1 overflow-y-auto pb-4">
        {downloads.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {searchQuery.trim()
                ? "No downloads match your search."
                : "No downloads in this category."}
            </p>
          </div>
        ) : (
          downloads.map((dl) => <DownloadRow key={dl.id} download={dl} />)
        )}
      </div>
    </div>
  );
}

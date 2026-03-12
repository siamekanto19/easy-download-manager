import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDownloadStore, type StatusFilter as StatusFilterType } from "@/stores/download-store";

const filters: { label: string; value: StatusFilterType }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "downloading" },
  { label: "Queued", value: "queued" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

export function StatusFilter() {
  const { statusFilter, setStatusFilter, downloads } = useDownloadStore();

  const counts: Record<string, number> = { all: downloads.length };
  for (const d of downloads) {
    counts[d.status] = (counts[d.status] ?? 0) + 1;
  }

  return (
    <div className="flex items-center gap-1 px-5 py-3">
      {filters.map((f) => {
        const isActive = statusFilter === f.value;
        const count = counts[f.value] ?? 0;
        return (
          <Button
            key={f.value}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            className={cn("gap-1.5 cursor-default", isActive && "font-semibold")}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
            {count > 0 && (
              <span className={cn(
                "text-xs tabular-nums",
                isActive ? "text-foreground/70" : "text-muted-foreground"
              )}>
                {count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

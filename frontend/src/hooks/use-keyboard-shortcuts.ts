import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";

/**
 * Global keyboard shortcuts for the application.
 * ⌘N / Ctrl+N → Open Add Download dialog
 */
export function useKeyboardShortcuts() {
  const { setAddDialogOpen, currentView } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // ⌘N → Add Download (only on downloads view)
      if (meta && e.key === "n" && currentView === "downloads") {
        e.preventDefault();
        setAddDialogOpen(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setAddDialogOpen, currentView]);
}

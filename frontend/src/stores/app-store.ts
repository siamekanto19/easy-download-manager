export type AppView = "downloads" | "history" | "settings";

interface AppState {
  currentView: AppView;
  searchQuery: string;
  addDialogOpen: boolean;
  setView: (view: AppView) => void;
  setSearchQuery: (query: string) => void;
  setAddDialogOpen: (open: boolean) => void;
}

import { create } from "zustand";

export const useAppStore = create<AppState>((set) => ({
  currentView: "downloads",
  searchQuery: "",
  addDialogOpen: false,
  setView: (view) => set({ currentView: view }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setAddDialogOpen: (open) => set({ addDialogOpen: open }),
}));


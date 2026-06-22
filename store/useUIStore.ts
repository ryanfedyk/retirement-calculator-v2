"use client";
import { create } from "zustand";

/** Transient UI state (not persisted). */
export const useUIStore = create<{
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  /** The shared "Your finances" overlay — openable from anywhere in the app. */
  financesOpen: boolean;
  setFinancesOpen: (v: boolean) => void;
}>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  financesOpen: false,
  setFinancesOpen: (v) => set({ financesOpen: v }),
}));

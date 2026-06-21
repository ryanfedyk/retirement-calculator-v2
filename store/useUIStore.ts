"use client";
import { create } from "zustand";

/** Transient UI state (not persisted). */
export const useUIStore = create<{
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
}>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
}));

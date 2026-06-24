"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DollarMode } from "@/engine/calculator";

/**
 * UI state. Most of it is transient (overlay open/closed), but the dollar
 * display basis is a deliberate, global user preference, so it's persisted to
 * localStorage and rehydrated on load — every chart, on the home screen and the
 * detail view alike, reads it from here.
 */
export const useUIStore = create<{
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  /** The shared "Your finances" overlay — openable from anywhere in the app. */
  financesOpen: boolean;
  setFinancesOpen: (v: boolean) => void;
  /** Global money basis: today's dollars (real) vs. future dollars (nominal). */
  dollarMode: DollarMode;
  setDollarMode: (v: DollarMode) => void;
  /** Scenario being exported as a plain-text report (null = the modal is closed). */
  reportScenarioId: string | null;
  openReport: (scenarioId: string) => void;
  closeReport: () => void;
}>()(
  persist(
    (set) => ({
      settingsOpen: false,
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      financesOpen: false,
      setFinancesOpen: (v) => set({ financesOpen: v }),
      dollarMode: "today",
      setDollarMode: (v) => set({ dollarMode: v }),
      reportScenarioId: null,
      openReport: (scenarioId) => set({ reportScenarioId: scenarioId }),
      closeReport: () => set({ reportScenarioId: null }),
    }),
    {
      name: "horizon-ui",
      storage: createJSONStorage(() => localStorage),
      // Only the durable preference persists; overlay flags stay transient.
      partialize: (s) => ({ dollarMode: s.dollarMode }),
    },
  ),
);

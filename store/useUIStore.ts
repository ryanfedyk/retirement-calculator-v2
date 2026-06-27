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
  /** Mobile only: whether a scenario deep-dive is open (vs. the scenarios hub).
   *  Persisted so a refresh keeps you where you were. Desktop now always lands in
   *  the primary scenario and uses `compareOpen` for the comparison destination. */
  scenarioOpen: boolean;
  setScenarioOpen: (v: boolean) => void;
  /** Desktop: whether the full-screen "Compare scenarios" destination is open.
   *  Transient — the app always lands in the primary scenario, not in compare. */
  compareOpen: boolean;
  setCompareOpen: (v: boolean) => void;
  /** Remembered last view (Trajectory/Reclaim) per scenario, so returning to a
   *  scenario lands you where you left it. */
  viewByScenario: Record<string, "financial" | "forecasting">;
  setScenarioView: (id: string, v: "financial" | "forecasting") => void;
  /** Desktop only: whether the "Scenario plan" side panel is expanded. Collapsed
   *  by default (transient) — opened from the side rail or the levers card. */
  planPanelOpen: boolean;
  setPlanPanelOpen: (v: boolean) => void;
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
      scenarioOpen: false,
      setScenarioOpen: (v) => set({ scenarioOpen: v }),
      compareOpen: false,
      setCompareOpen: (v) => set({ compareOpen: v }),
      viewByScenario: {},
      setScenarioView: (id, v) => set((s) => ({ viewByScenario: { ...s.viewByScenario, [id]: v } })),
      planPanelOpen: false,
      setPlanPanelOpen: (v) => set({ planPanelOpen: v }),
      dollarMode: "today",
      setDollarMode: (v) => set({ dollarMode: v }),
      reportScenarioId: null,
      openReport: (scenarioId) => set({ reportScenarioId: scenarioId }),
      closeReport: () => set({ reportScenarioId: null }),
    }),
    {
      name: "horizon-ui",
      storage: createJSONStorage(() => localStorage),
      // The durable preferences persist (money basis, mobile's open scenario, and
      // the per-scenario last view); transient overlay/report/compare flags do not.
      partialize: (s) => ({ dollarMode: s.dollarMode, scenarioOpen: s.scenarioOpen, viewByScenario: s.viewByScenario }),
    },
  ),
);

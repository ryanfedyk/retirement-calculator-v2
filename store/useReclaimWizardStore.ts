"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Guided-wizard inputs for the Reclaim tab that have no home in the editor
 * stores. Right now that's the Perfect Day *blend*: retirement is a mix of days,
 * so the wizard asks how much presence each kind of day has — a 0–100 weight the
 * user sets by dragging. The blend is read relative to the total, so it's a
 * feeling, not a budget. Persisted so the reveal shows your blend on return.
 * (Perfect Year's picks live in the year plan itself — no separate store.)
 */
type State = {
  /** archetype id → presence 0..100 */
  dayWeights: Record<string, number>;
  setDayWeight: (id: string, w: number) => void;
  resetDayWeights: () => void;
};

export const useReclaimWizardStore = create<State>()(
  persist(
    (set) => ({
      dayWeights: {},
      setDayWeight: (id, w) =>
        set((s) => ({ dayWeights: { ...s.dayWeights, [id]: Math.max(0, Math.min(100, Math.round(w))) } })),
      resetDayWeights: () => set({ dayWeights: {} }),
    }),
    { name: "horizon-reclaim-wizard", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

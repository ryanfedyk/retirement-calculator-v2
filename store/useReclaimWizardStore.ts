"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Guided-wizard inputs for the Reclaim tab that have no home in the editor
 * stores. Right now that's the Perfect Day *allocation*: retirement isn't one
 * kind of day, it's a blend, so the wizard asks the user to divide a 7-day week
 * across the kinds of day — a hard budget that forces real prioritization.
 * Persisted so the reveal shows your blend again on return. (Perfect Year's
 * picks live in the year plan itself, so they need no separate store.)
 */
const WEEK_DAYS = 7;

type State = {
  /** archetype id → days-per-week 0..7 */
  dayWeights: Record<string, number>;
  setDayWeight: (id: string, w: number) => void;
  resetDayWeights: () => void;
};

export const useReclaimWizardStore = create<State>()(
  persist(
    (set) => ({
      dayWeights: {},
      setDayWeight: (id, w) =>
        set((s) => ({ dayWeights: { ...s.dayWeights, [id]: Math.max(0, Math.min(WEEK_DAYS, Math.round(w))) } })),
      resetDayWeights: () => set({ dayWeights: {} }),
    }),
    { name: "horizon-reclaim-wizard", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

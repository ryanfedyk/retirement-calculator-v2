"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Guided-wizard inputs for the Reclaim tab that have no home in the editor
 * stores. Right now that's the Perfect Day *allocation*: retirement is a blend,
 * and a day holds several things, so the wizard asks the user to spread ~14
 * "blocks" of a week across the kinds of day — roomy enough to cover it all with
 * precision, while leaning harder on what matters gives the blend its shape.
 * Persisted so the reveal shows your blend again on return. (Perfect Year's
 * picks live in the year plan itself, so they need no separate store.)
 */
const WEEK_BLOCKS = 14;

type State = {
  /** archetype id → emphasis blocks 0..14 */
  dayWeights: Record<string, number>;
  setDayWeight: (id: string, w: number) => void;
  resetDayWeights: () => void;
};

export const useReclaimWizardStore = create<State>()(
  persist(
    (set) => ({
      dayWeights: {},
      setDayWeight: (id, w) =>
        set((s) => ({ dayWeights: { ...s.dayWeights, [id]: Math.max(0, Math.min(WEEK_BLOCKS, Math.round(w))) } })),
      resetDayWeights: () => set({ dayWeights: {} }),
    }),
    { name: "horizon-reclaim-wizard", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

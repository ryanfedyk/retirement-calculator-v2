"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Guided-wizard inputs for the Reclaim tab that have no home in the editor
 * stores. Right now that's the Perfect Day *weighting*: retirement isn't one
 * kind of day, it's a blend, so the wizard asks how much of your weeks each
 * archetype makes up (0 = not me … 3 = most days) rather than a binary pick.
 * Persisted so the reveal shows your blend again on return. (Perfect Year's
 * picks live in the year plan itself, so they need no separate store.)
 */
type State = {
  /** archetype id → weight 0..3 */
  dayWeights: Record<string, number>;
  setDayWeight: (id: string, w: number) => void;
  resetDayWeights: () => void;
};

export const useReclaimWizardStore = create<State>()(
  persist(
    (set) => ({
      dayWeights: {},
      setDayWeight: (id, w) =>
        set((s) => ({ dayWeights: { ...s.dayWeights, [id]: Math.max(0, Math.min(3, w)) } })),
      resetDayWeights: () => set({ dayWeights: {} }),
    }),
    { name: "horizon-reclaim-wizard", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

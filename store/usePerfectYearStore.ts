"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * The user's "perfect year" — adventure/experience ids placed on each month
 * (0 = January … 11 = December). Persisted to localStorage so the year they
 * map out sticks around between visits.
 */
type YearPlan = Record<number, string[]>;

const EMPTY: YearPlan = {};

export const usePerfectYearStore = create<{
  plan: YearPlan;
  add: (month: number, id: string) => void;
  remove: (month: number, id: string) => void;
  clear: () => void;
}>()(
  persist(
    (set) => ({
      plan: EMPTY,
      add: (month, id) =>
        set((s) => {
          const cur = s.plan[month] ?? [];
          if (cur.includes(id)) return {};
          return { plan: { ...s.plan, [month]: [...cur, id] } };
        }),
      remove: (month, id) =>
        set((s) => ({ plan: { ...s.plan, [month]: (s.plan[month] ?? []).filter((x) => x !== id) } })),
      clear: () => set({ plan: {} }),
    }),
    { name: "horizon-perfectyear", storage: createJSONStorage(() => localStorage) },
  ),
);

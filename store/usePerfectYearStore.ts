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

type YearState = {
  plan: YearPlan;
  /** True once an auto-draft (or any content) exists, so we never re-seed. */
  seeded?: boolean;
  add: (month: number, id: string) => void;
  remove: (month: number, id: string) => void;
  clear: () => void;
  /** Replace the whole plan with a drafted year (auto-seed on empty / rebuild). */
  applySeed: (plan: YearPlan) => void;
};

export const usePerfectYearStore = create<YearState>()(
  persist(
    (set) => ({
      plan: EMPTY,
      seeded: false,
      add: (month, id) =>
        set((s) => {
          const cur = s.plan[month] ?? [];
          if (cur.includes(id)) return {};
          return { plan: { ...s.plan, [month]: [...cur, id] } };
        }),
      remove: (month, id) =>
        set((s) => ({ plan: { ...s.plan, [month]: (s.plan[month] ?? []).filter((x) => x !== id) } })),
      clear: () => set({ plan: {} }),
      applySeed: (plan) => set({ plan, seeded: true }),
    }),
    {
      name: "horizon-perfectyear",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // v1: add the `seeded` flag — existing plans count as seeded so we never
      // overwrite them; empty plans stay unseeded to receive a draft on open.
      migrate: (persisted: unknown) => {
        const s = persisted as YearState;
        if (s && typeof s === "object" && s.seeded === undefined) {
          s.seeded = !!(s.plan && Object.keys(s.plan).length > 0);
        }
        return s;
      },
    },
  ),
);

"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DayBlock } from "@/lib/perfectDay";

/**
 * The user's "perfect day" — activity ids per time block. Persisted to
 * localStorage so the day they build sticks around between visits.
 */
type Blocks = Record<DayBlock, string[]>;

const EMPTY: Blocks = { morning: [], afternoon: [], evening: [] };

export const usePerfectDayStore = create<{
  blocks: Blocks;
  add: (block: DayBlock, id: string) => void;
  remove: (block: DayBlock, id: string) => void;
  clear: () => void;
}>()(
  persist(
    (set) => ({
      blocks: EMPTY,
      add: (block, id) =>
        set((s) => (s.blocks[block].includes(id) ? {} : { blocks: { ...s.blocks, [block]: [...s.blocks[block], id] } })),
      remove: (block, id) =>
        set((s) => ({ blocks: { ...s.blocks, [block]: s.blocks[block].filter((x) => x !== id) } })),
      clear: () => set({ blocks: { morning: [], afternoon: [], evening: [] } }),
    }),
    { name: "horizon-perfectday", storage: createJSONStorage(() => localStorage) },
  ),
);

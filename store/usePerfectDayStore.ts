"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { emptyBlocks, DAY_NAME_SUGGESTIONS, type DayBlock, type PerfectDayItem } from "@/lib/perfectDay";

/**
 * The user's "perfect days" — people sketch several (a slow day, an adventurous
 * day, a creative day), and an AI culmination finds the throughline. Each day
 * holds activity ids per time block. Persisted to localStorage; v0 (a single
 * `blocks` map) is migrated into the first named day.
 */
const DEFAULT_DAY_ID = "day-1";

const freshDay = (id: string, name: string): PerfectDayItem => ({ id, name, blocks: emptyBlocks() });

// Math.random is fine here — these ids are only ever minted in client click
// handlers, never during SSR (the default day uses a fixed id for hydration).
const genId = () => `day-${Math.random().toString(36).slice(2, 9)}`;

type State = {
  days: PerfectDayItem[];
  activeId: string;
  // Active-day editing
  add: (block: DayBlock, id: string) => void;
  remove: (block: DayBlock, id: string) => void;
  clear: () => void;
  // Day management
  addDay: () => void;
  removeDay: (id: string) => void;
  renameDay: (id: string, name: string) => void;
  setActive: (id: string) => void;
};

const mapActive = (s: State, fn: (d: PerfectDayItem) => PerfectDayItem) => ({
  days: s.days.map((d) => (d.id === s.activeId ? fn(d) : d)),
});

export const usePerfectDayStore = create<State>()(
  persist(
    (set) => ({
      days: [freshDay(DEFAULT_DAY_ID, "My perfect day")],
      activeId: DEFAULT_DAY_ID,

      add: (block, id) =>
        set((s) => mapActive(s, (d) =>
          d.blocks[block].includes(id) ? d : { ...d, blocks: { ...d.blocks, [block]: [...d.blocks[block], id] } })),
      remove: (block, id) =>
        set((s) => mapActive(s, (d) => ({ ...d, blocks: { ...d.blocks, [block]: d.blocks[block].filter((x) => x !== id) } }))),
      clear: () =>
        set((s) => mapActive(s, (d) => ({ ...d, blocks: emptyBlocks() }))),

      addDay: () =>
        set((s) => {
          const id = genId();
          const name = DAY_NAME_SUGGESTIONS[s.days.length % DAY_NAME_SUGGESTIONS.length];
          return { days: [...s.days, freshDay(id, name)], activeId: id };
        }),
      removeDay: (id) =>
        set((s) => {
          const remaining = s.days.filter((d) => d.id !== id);
          if (remaining.length === 0) {
            const fresh = freshDay(DEFAULT_DAY_ID, "My perfect day");
            return { days: [fresh], activeId: fresh.id };
          }
          const activeId = s.activeId === id ? remaining[0].id : s.activeId;
          return { days: remaining, activeId };
        }),
      renameDay: (id, name) =>
        set((s) => ({ days: s.days.map((d) => (d.id === id ? { ...d, name } : d)) })),
      setActive: (id) => set({ activeId: id }),
    }),
    {
      name: "horizon-perfectday",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // v0 stored a single { blocks } map — fold it into the first named day.
      migrate: (persisted: unknown, version: number) => {
        if (version === 0 && persisted && typeof persisted === "object") {
          const blocks = (persisted as { blocks?: PerfectDayItem["blocks"] }).blocks ?? emptyBlocks();
          return { days: [{ id: DEFAULT_DAY_ID, name: "My perfect day", blocks }], activeId: DEFAULT_DAY_ID };
        }
        return persisted as State;
      },
    },
  ),
);

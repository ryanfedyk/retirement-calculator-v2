"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AdventureBlueprint } from "@/types/horizon";

/**
 * Pursuits generated on demand by the AI (or that the user could add by hand),
 * kept alongside the curated catalog so the Perfect Year explorer isn't limited
 * to a fixed list. Persisted so an AI-suggested idea a user placed on their year
 * still resolves (concept, why, first step) on the next visit.
 */
type State = {
  pursuits: AdventureBlueprint[];
  addMany: (items: AdventureBlueprint[]) => void;
  clear: () => void;
};

export const useCustomPursuitStore = create<State>()(
  persist(
    (set) => ({
      pursuits: [],
      addMany: (items) =>
        set((s) => {
          const have = new Set(s.pursuits.map((p) => p.concept.toLowerCase().trim()));
          const fresh = items.filter((p) => p.concept && !have.has(p.concept.toLowerCase().trim()));
          return fresh.length ? { pursuits: [...s.pursuits, ...fresh] } : {};
        }),
      clear: () => set({ pursuits: [] }),
    }),
    { name: "horizon-custom-pursuits", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

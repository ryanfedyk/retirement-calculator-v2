"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";
import { DEFAULT_SNAPSHOT, DEFAULT_SIM_CONFIG } from "@/config/sharedConfig";

interface FinancialStore {
  snapshot:  FinancialSnapshot;
  config:    SimulationConfiguration;
  livePrice: number;

  // Top-level
  updateSnapshot: (updates: Partial<FinancialSnapshot>) => void;
  updateConfig:   (updates: Partial<SimulationConfiguration>) => void;

  // Nested — mirrors the original prototype's API
  updateNestedConfig: <K extends keyof SimulationConfiguration>(
    section: K,
    updates: Partial<SimulationConfiguration[K]> | SimulationConfiguration[K]
  ) => void;
  updateNestedSnapshot: <K extends keyof FinancialSnapshot>(
    section: K,
    updates: Partial<FinancialSnapshot[K]> | FinancialSnapshot[K]
  ) => void;

  // Convenience aliases (kept for backward compat)
  updateCareerPath:        (updates: Partial<SimulationConfiguration["career_path"]>)        => void;
  updateIncomeProfile:     (updates: Partial<SimulationConfiguration["income_profile"]>)     => void;
  updateMarketAssumptions: (updates: Partial<SimulationConfiguration["market_assumptions"]>) => void;
  updateSpending:          (updates: Partial<SimulationConfiguration["spending"]>)           => void;

  setLivePrice:    (price: number) => void;
  resetToDefaults: () => void;
}

export const useFinancialStore = create<FinancialStore>()(
  persist(
    (set) => ({
      snapshot:  DEFAULT_SNAPSHOT,
      config:    DEFAULT_SIM_CONFIG,
      livePrice: 0,

      updateSnapshot: (updates) =>
        set((s) => ({ snapshot: { ...s.snapshot, ...updates } })),

      updateConfig: (updates) =>
        set((s) => ({ config: { ...s.config, ...updates } })),

      updateNestedConfig: (section, updates) =>
        set((s) => {
          const current = s.config[section];
          let merged: typeof current;
          if (updates === null || typeof updates !== "object" || Array.isArray(updates)) {
            merged = updates as typeof current;
          } else {
            merged = { ...(current as object), ...(updates as object) } as typeof current;
          }
          return { config: { ...s.config, [section]: merged } };
        }),

      updateNestedSnapshot: (section, updates) =>
        set((s) => {
          const current = s.snapshot[section];
          let merged: typeof current;
          if (updates === null || typeof updates !== "object" || Array.isArray(updates)) {
            merged = updates as typeof current;
          } else {
            merged = { ...(current as object), ...(updates as object) } as typeof current;
          }
          return { snapshot: { ...s.snapshot, [section]: merged } };
        }),

      // Convenience aliases
      updateCareerPath: (updates) =>
        set((s) => ({ config: { ...s.config, career_path: { ...s.config.career_path, ...updates } } })),

      updateIncomeProfile: (updates) =>
        set((s) => ({ config: { ...s.config, income_profile: { ...s.config.income_profile, ...updates } } })),

      updateMarketAssumptions: (updates) =>
        set((s) => ({ config: { ...s.config, market_assumptions: { ...s.config.market_assumptions, ...updates } } })),

      updateSpending: (updates) =>
        set((s) => ({ config: { ...s.config, spending: { ...s.config.spending, ...updates } } })),

      setLivePrice: (price) => set({ livePrice: price }),

      resetToDefaults: () => set({ snapshot: DEFAULT_SNAPSHOT, config: DEFAULT_SIM_CONFIG }),
    }),
    {
      name:    "horizon-financial-v7",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

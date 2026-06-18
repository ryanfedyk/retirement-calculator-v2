"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";
import {
  DEFAULT_SNAPSHOT,
  DEFAULT_SIM_CONFIG,
  DEFAULT_PROFILE,
  buildLifeEvents,
  type UserProfile,
} from "@/config/sharedConfig";

/** The persisted, cloud-syncable slice of state. */
export interface HorizonState {
  profile:  UserProfile;
  snapshot: FinancialSnapshot;
  config:   SimulationConfiguration;
}

interface FinancialStore extends HorizonState {
  livePrice: number;

  // Profile
  updateProfile: (updates: Partial<UserProfile>) => void;

  /**
   * Set the user's children and infer the dependents-driven parts of the plan:
   * the empty-nest spending phase (enabled + dated to when the youngest turns
   * 18) and auto-generated college-cost life events. User-added life events and
   * other settings are preserved.
   */
  setChildren: (children: UserProfile["children"]) => void;

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

  /** Bulk-replace the persisted slice — used by cloud sync on login. */
  hydrate: (state: Partial<HorizonState>) => void;
}

/** Keep config.children (consumed by the engine) in sync with profile.children. */
function projectChildren(profile: UserProfile): SimulationConfiguration["children"] {
  return profile.children.map((c) => ({ birthYear: c.birthYear }));
}

export const useFinancialStore = create<FinancialStore>()(
  persist(
    (set) => ({
      profile:   DEFAULT_PROFILE,
      snapshot:  DEFAULT_SNAPSHOT,
      config:    DEFAULT_SIM_CONFIG,
      livePrice: 0,

      updateProfile: (updates) =>
        set((s) => {
          const profile = { ...s.profile, ...updates };
          return {
            profile,
            // mirror children into the sim config so the engine sees them
            config: { ...s.config, children: projectChildren(profile) },
          };
        }),

      setChildren: (children) =>
        set((s) => {
          const profile = { ...s.profile, children };
          const hasKids = children.length > 0;

          // Empty nest = when the youngest child turns 18 (last one leaves home).
          const youngestBirthYear = hasKids ? Math.max(...children.map((c) => c.birthYear)) : 0;
          const emptyNest = hasKids
            ? { use_empty_nest: true, empty_nest_year: youngestBirthYear + 18 }
            : { use_empty_nest: false };

          // Regenerate auto college-cost events; keep user-added ones untouched.
          const manualEvents = (s.config.life_events ?? []).filter((e) => !e.auto);
          const collegeEvents = buildLifeEvents(children);

          return {
            profile,
            config: {
              ...s.config,
              children: projectChildren(profile),
              spending: { ...s.config.spending, ...emptyNest },
              life_events: [...manualEvents, ...collegeEvents],
            },
          };
        }),

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

      resetToDefaults: () =>
        set({ profile: DEFAULT_PROFILE, snapshot: DEFAULT_SNAPSHOT, config: DEFAULT_SIM_CONFIG }),

      hydrate: (state) =>
        set((s) => {
          const profile = state.profile ?? s.profile;
          const config  = state.config ?? s.config;
          return {
            profile,
            snapshot: state.snapshot ?? s.snapshot,
            // ensure children projection is consistent after a cloud load
            config: { ...config, children: projectChildren(profile) },
          };
        }),
    }),
    {
      name:    "horizon-financial-v8",
      storage: createJSONStorage(() => localStorage),
      // Persist only the cloud-syncable slice; livePrice is transient.
      partialize: (s) => ({ profile: s.profile, snapshot: s.snapshot, config: s.config }),
    }
  )
);

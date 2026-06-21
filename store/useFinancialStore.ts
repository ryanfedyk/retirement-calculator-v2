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

/** A named scenario — its own plan `config`, sharing the profile & balance sheet. */
export interface Scenario {
  id: string;
  name: string;
  config: SimulationConfiguration;
}

/** The persisted, cloud-syncable slice of state. */
export interface HorizonState {
  profile:  UserProfile;
  snapshot: FinancialSnapshot;
  config:   SimulationConfiguration;   // mirror of the active scenario's config
  scenarios: Scenario[];
  activeScenarioId: string;
}

interface FinancialStore extends HorizonState {
  livePrice: number;

  // Profile
  updateProfile: (updates: Partial<UserProfile>) => void;
  setChildren: (children: UserProfile["children"]) => void;

  // Top-level
  updateSnapshot: (updates: Partial<FinancialSnapshot>) => void;
  updateConfig:   (updates: Partial<SimulationConfiguration>) => void;

  // Nested
  updateNestedConfig: <K extends keyof SimulationConfiguration>(
    section: K,
    updates: Partial<SimulationConfiguration[K]> | SimulationConfiguration[K]
  ) => void;
  updateNestedSnapshot: <K extends keyof FinancialSnapshot>(
    section: K,
    updates: Partial<FinancialSnapshot[K]> | FinancialSnapshot[K]
  ) => void;

  // Convenience aliases
  updateCareerPath:        (updates: Partial<SimulationConfiguration["career_path"]>)        => void;
  updateIncomeProfile:     (updates: Partial<SimulationConfiguration["income_profile"]>)     => void;
  updateMarketAssumptions: (updates: Partial<SimulationConfiguration["market_assumptions"]>) => void;
  updateSpending:          (updates: Partial<SimulationConfiguration["spending"]>)           => void;

  // Scenarios
  addScenario:      (name?: string) => void;   // new from defaults
  duplicateScenario:(name?: string) => void;   // clone the active scenario
  renameScenario:   (id: string, name: string) => void;
  deleteScenario:   (id: string) => void;
  setActiveScenario:(id: string) => void;

  setLivePrice:    (price: number) => void;
  resetToDefaults: () => void;
  hydrate: (state: Partial<HorizonState>) => void;
}

/** Keep config.children (consumed by the engine) in sync with profile.children. */
function projectChildren(profile: UserProfile): SimulationConfiguration["children"] {
  return profile.children.map((c) => ({ birthYear: c.birthYear }));
}

const newId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/** Set the active config AND mirror it into the active scenario entry. */
function writeConfig(s: HorizonState, config: SimulationConfiguration) {
  return {
    config,
    scenarios: s.scenarios.map((sc) => (sc.id === s.activeScenarioId ? { ...sc, config } : sc)),
  };
}

function makeDefaultScenarios(config: SimulationConfiguration): { scenarios: Scenario[]; activeScenarioId: string } {
  const id = newId();
  return { scenarios: [{ id, name: "My Plan", config }], activeScenarioId: id };
}

export const useFinancialStore = create<FinancialStore>()(
  persist(
    (set) => {
      const seed = makeDefaultScenarios(DEFAULT_SIM_CONFIG);
      return {
      profile:   DEFAULT_PROFILE,
      snapshot:  DEFAULT_SNAPSHOT,
      config:    DEFAULT_SIM_CONFIG,
      scenarios: seed.scenarios,
      activeScenarioId: seed.activeScenarioId,
      livePrice: 0,

      updateProfile: (updates) =>
        set((s) => {
          const profile = { ...s.profile, ...updates };
          return { profile, ...writeConfig(s, { ...s.config, children: projectChildren(profile) }) };
        }),

      setChildren: (children) =>
        set((s) => {
          const profile = { ...s.profile, children };
          const hasKids = children.length > 0;
          const hadKids = s.profile.children.length > 0;

          const youngestBirthYear = hasKids ? Math.max(...children.map((c) => c.birthYear)) : 0;
          const emptyNestSpend =
            hasKids && !hadKids
              ? Math.round(s.config.spending.monthly_lifestyle * 0.85)
              : s.config.spending.empty_nest_monthly_spend;
          const emptyNest = hasKids
            ? { use_empty_nest: true, empty_nest_year: youngestBirthYear + 18, empty_nest_monthly_spend: emptyNestSpend, ...(hadKids ? {} : { empty_nest_linked: true }) }
            : { use_empty_nest: false };

          const manualEvents = (s.config.life_events ?? []).filter((e) => !e.auto);
          const collegeEvents = buildLifeEvents(children);

          return {
            profile,
            ...writeConfig(s, {
              ...s.config,
              children: projectChildren(profile),
              spending: { ...s.config.spending, ...emptyNest },
              life_events: [...manualEvents, ...collegeEvents],
            }),
          };
        }),

      updateSnapshot: (updates) =>
        set((s) => ({ snapshot: { ...s.snapshot, ...updates } })),

      updateConfig: (updates) =>
        set((s) => writeConfig(s, { ...s.config, ...updates })),

      updateNestedConfig: (section, updates) =>
        set((s) => {
          const current = s.config[section];
          let merged: typeof current;
          if (updates === null || typeof updates !== "object" || Array.isArray(updates)) {
            merged = updates as typeof current;
          } else {
            merged = { ...(current as object), ...(updates as object) } as typeof current;
          }
          return writeConfig(s, { ...s.config, [section]: merged });
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

      updateCareerPath: (updates) =>
        set((s) => writeConfig(s, { ...s.config, career_path: { ...s.config.career_path, ...updates } })),
      updateIncomeProfile: (updates) =>
        set((s) => writeConfig(s, { ...s.config, income_profile: { ...s.config.income_profile, ...updates } })),
      updateMarketAssumptions: (updates) =>
        set((s) => writeConfig(s, { ...s.config, market_assumptions: { ...s.config.market_assumptions, ...updates } })),
      updateSpending: (updates) =>
        set((s) => writeConfig(s, { ...s.config, spending: { ...s.config.spending, ...updates } })),

      // ── Scenarios ────────────────────────────────────────────────────────
      addScenario: (name) =>
        set((s) => {
          const id = newId();
          const config = structuredClone(DEFAULT_SIM_CONFIG);
          config.birth_year = s.profile.birthYear;
          config.children = projectChildren(s.profile);
          const sc: Scenario = { id, name: name || `Scenario ${s.scenarios.length + 1}`, config };
          return { scenarios: [...s.scenarios, sc], activeScenarioId: id, config };
        }),

      duplicateScenario: (name) =>
        set((s) => {
          const id = newId();
          const active = s.scenarios.find((x) => x.id === s.activeScenarioId);
          const baseName = active?.name ?? "Scenario";
          const config = structuredClone(s.config);
          const sc: Scenario = { id, name: name || `Copy of ${baseName}`, config };
          return { scenarios: [...s.scenarios, sc], activeScenarioId: id, config };
        }),

      renameScenario: (id, name) =>
        set((s) => ({ scenarios: s.scenarios.map((x) => (x.id === id ? { ...x, name } : x)) })),

      deleteScenario: (id) =>
        set((s) => {
          if (s.scenarios.length <= 1) return {}; // never delete the last one
          const remaining = s.scenarios.filter((x) => x.id !== id);
          if (id !== s.activeScenarioId) return { scenarios: remaining };
          const next = remaining[0];
          const config = { ...next.config, birth_year: s.profile.birthYear, children: projectChildren(s.profile) };
          return {
            scenarios: remaining.map((x) => (x.id === next.id ? { ...x, config } : x)),
            activeScenarioId: next.id,
            config,
          };
        }),

      setActiveScenario: (id) =>
        set((s) => {
          const sc = s.scenarios.find((x) => x.id === id);
          if (!sc) return {};
          // Keep shared identity consistent across scenarios.
          const config = { ...sc.config, birth_year: s.profile.birthYear, children: projectChildren(s.profile) };
          return {
            activeScenarioId: id,
            config,
            scenarios: s.scenarios.map((x) => (x.id === id ? { ...x, config } : x)),
          };
        }),

      setLivePrice: (price) => set({ livePrice: price }),

      resetToDefaults: () =>
        set(() => {
          const seeded = makeDefaultScenarios(DEFAULT_SIM_CONFIG);
          return { profile: DEFAULT_PROFILE, snapshot: DEFAULT_SNAPSHOT, config: DEFAULT_SIM_CONFIG, ...seeded };
        }),

      hydrate: (state) =>
        set((s) => {
          const profile = state.profile ?? s.profile;
          let scenarios = (state.scenarios && state.scenarios.length) ? state.scenarios : null;
          let activeScenarioId = state.activeScenarioId ?? s.activeScenarioId;

          if (!scenarios) {
            // Back-compat: a single-config doc → wrap as one scenario.
            const cfg = state.config ?? s.config;
            const seeded = makeDefaultScenarios(cfg);
            scenarios = seeded.scenarios;
            activeScenarioId = seeded.activeScenarioId;
          }
          const active = scenarios.find((x) => x.id === activeScenarioId) ?? scenarios[0];
          activeScenarioId = active.id;
          const config = { ...active.config, children: projectChildren(profile) };
          scenarios = scenarios.map((x) => (x.id === activeScenarioId ? { ...x, config } : x));

          return { profile, snapshot: state.snapshot ?? s.snapshot, scenarios, activeScenarioId, config };
        }),
      };
    },
    {
      name:    "horizon-financial-v9",
      version: 9,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        profile: s.profile, snapshot: s.snapshot, config: s.config,
        scenarios: s.scenarios, activeScenarioId: s.activeScenarioId,
      }),
      migrate: (persisted: any) => {
        if (persisted && (!persisted.scenarios || !persisted.scenarios.length)) {
          const config = persisted.config ?? DEFAULT_SIM_CONFIG;
          const seeded = makeDefaultScenarios(config);
          persisted.scenarios = seeded.scenarios;
          persisted.activeScenarioId = seeded.activeScenarioId;
        }
        return persisted;
      },
    }
  )
);

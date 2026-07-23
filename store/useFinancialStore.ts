"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";
import {
  DEFAULT_SNAPSHOT,
  DEFAULT_SIM_CONFIG,
  DEFAULT_PROFILE,
  buildLifeEvents,
  yearOfISO,
  isoDate,
  type UserProfile,
} from "@/config/sharedConfig";

/**
 * Sections that live in the shared **baseline** ("the real you") rather than
 * being owned outright by each scenario. A scenario starts fully linked to the
 * baseline; editing one of these fields inside a scenario forks just that field
 * (its dotted path is recorded in `Scenario.unlinked`), while editing the
 * baseline (in Settings) flows into every scenario that hasn't forked it.
 *
 * `life_events` is shared too but, being a list, links/forks as a whole unit
 * under the single path "life_events".
 */
export const SHARED_SCALAR_SECTIONS = [
  "income_profile",
  "market_assumptions",
  "spending",
  "tax_assumptions",
  "social_security",
  "medicare",
] as const;
export type SharedScalarSection = (typeof SHARED_SCALAR_SECTIONS)[number];
export type SharedSection = SharedScalarSection | "life_events";

/** The shared baseline: master values for the linked sections. */
export type Baseline = Pick<SimulationConfiguration, SharedSection>;

const isSharedScalar = (s: string): s is SharedScalarSection =>
  (SHARED_SCALAR_SECTIONS as readonly string[]).includes(s);

/** A named scenario — its own plan `config`, sharing the profile & balance sheet.
 *  `unlinked` lists the baseline field paths this scenario has overridden. */
export interface Scenario {
  id: string;
  name: string;
  config: SimulationConfiguration;
  unlinked: string[];
}

/** One monthly snapshot of the primary plan — net worth + spendable + where the
 *  projected FI date sat at that moment. Accumulates over time so the app can
 *  show your real trajectory and how your FI target has drifted. Figures are in
 *  the model's real (today's) dollars as of the recording month. */
export interface PlanHistoryPoint {
  id: string;             // stable key: "auto-2026-07" for the monthly point, a uuid for manual captures
  ym: string;             // "2026-07" — the calendar month of capture
  recordedAt: string;     // ISO timestamp of capture
  netWorth: number;       // total net worth at capture
  spendable: number;      // after-tax spendable assets
  swrTarget: number;      // the FI Number at capture
  fiDate: string | null;  // projected FI date ("Mon YYYY"), or null if not reached
  scenarioName: string;   // the primary scenario this reflects
  manual?: boolean;       // true for an on-demand capture (distinct point); auto monthly otherwise
}

/** Stable key for a history point — legacy points (pre-id) fall back to the month. */
const historyKey = (p: Pick<PlanHistoryPoint, "id" | "ym">) => p.id || `auto-${p.ym}`;

/** The persisted, cloud-syncable slice of state. */
export interface HorizonState {
  profile:  UserProfile;
  snapshot: FinancialSnapshot;
  baseline: Baseline;                  // shared "real you" defaults
  config:   SimulationConfiguration;   // mirror of the active scenario's (effective) config
  scenarios: Scenario[];
  activeScenarioId: string;
  /** The user's "home" scenario — what the app lands in, marked across the UI. */
  primaryScenarioId: string;
  /** Monthly snapshots of the primary plan, oldest first. */
  planHistory: PlanHistoryPoint[];
}

interface FinancialStore extends HorizonState {
  livePrice: number;

  // Profile
  updateProfile: (updates: Partial<UserProfile>) => void;
  setChildren: (children: UserProfile["children"]) => void;

  // Top-level
  updateSnapshot: (updates: Partial<FinancialSnapshot>) => void;
  updateConfig:   (updates: Partial<SimulationConfiguration>) => void;

  // Nested — edits the active scenario. Shared sections fork the touched fields.
  updateNestedConfig: <K extends keyof SimulationConfiguration>(
    section: K,
    updates: Partial<SimulationConfiguration[K]> | SimulationConfiguration[K]
  ) => void;
  updateNestedSnapshot: <K extends keyof FinancialSnapshot>(
    section: K,
    updates: Partial<FinancialSnapshot[K]> | FinancialSnapshot[K]
  ) => void;

  // Baseline — edits the shared master and flows into every linked scenario.
  updateBaseline: <K extends SharedSection>(
    section: K,
    updates: Partial<Baseline[K]> | Baseline[K]
  ) => void;
  /** Equity-comp setup (whether you hold company equity + the ticker) is a shared
   *  fact, not a per-scenario lever, so it's written uniformly to every scenario. */
  setEquityComp: (updates: { use_equity_comp?: boolean; concentrated_symbol?: string }) => void;
  /** Re-link a forked field/section on the active scenario back to the baseline. */
  resetToBaseline: (path: string) => void;
  /** Adopt the shared sections of `config` as the baseline (used at onboarding). */
  seedBaseline: (config: SimulationConfiguration) => void;

  // Convenience aliases (active scenario; shared sections fork)
  updateCareerPath:        (updates: Partial<SimulationConfiguration["career_path"]>)        => void;
  updateIncomeProfile:     (updates: Partial<SimulationConfiguration["income_profile"]>)     => void;
  updateMarketAssumptions: (updates: Partial<SimulationConfiguration["market_assumptions"]>) => void;
  updateSpending:          (updates: Partial<SimulationConfiguration["spending"]>)           => void;

  // Scenarios
  addScenario:      (name?: string) => void;   // new, inheriting the baseline
  duplicateScenario:(name?: string) => void;   // clone the active scenario (forks and all)
  renameScenario:   (id: string, name: string) => void;
  deleteScenario:   (id: string) => void;
  setActiveScenario:(id: string) => void;
  /** Mark a scenario as the primary "home" plan. */
  setPrimaryScenario:(id: string) => void;
  /** Create a scenario from the baseline, apply a tweak, and switch to it. */
  buildScenarioFromBaseline: (name: string, section: keyof SimulationConfiguration, patch: Record<string, unknown>) => void;
  /** Add a scenario from a fully-formed config (e.g. an offshoot of an existing scenario) and switch to it. */
  addScenarioFromConfig: (name: string, config: SimulationConfiguration, unlinked?: string[]) => void;

  setLivePrice:    (price: number) => void;
  /** Persist last-known live prices onto the snapshot's holdings (and the
   *  concentrated position), so a later quote outage doesn't value everything at
   *  $0 and wreck net worth / the FI date. Only writes changed prices. */
  cacheLivePrices: (prices: Record<string, number>) => void;
  /** Record/refresh the primary plan's snapshot for the CURRENT month (one point
   *  per month). Powers the plan-history trail in Finances. */
  recordHistoryPoint: (pt: Omit<PlanHistoryPoint, "id" | "ym" | "recordedAt" | "manual">) => void;
  /** Append a DISTINCT, timestamped snapshot on demand (not deduped by month), so
   *  the trail can be denser than monthly. */
  addManualSnapshot: (pt: Omit<PlanHistoryPoint, "id" | "ym" | "recordedAt" | "manual">) => void;
  /** Remove a history point by its id (used to drop a manual capture). */
  removeHistoryPoint: (id: string) => void;
  resetToDefaults: () => void;
  hydrate: (state: Partial<HorizonState>) => void;
}

/** Union two history series by point id (monthly points share one id per month;
 *  manual captures each have their own), keeping the earliest capture per id (so a
 *  device that recorded it first wins) and sorting oldest → newest by time. */
function mergeHistory(a: PlanHistoryPoint[], b: PlanHistoryPoint[]): PlanHistoryPoint[] {
  const byId = new Map<string, PlanHistoryPoint>();
  for (const p of [...a, ...b]) {
    const key = historyKey(p);
    const existing = byId.get(key);
    if (!existing || p.recordedAt < existing.recordedAt) byId.set(key, p);
  }
  return Array.from(byId.values()).sort((x, y) => x.recordedAt.localeCompare(y.recordedAt)).slice(-240);
}

/** Keep config.children (consumed by the engine) in sync with profile.children.
 *  Profile stores full birthdays; the engine works in whole years. */
function projectChildren(profile: UserProfile): SimulationConfiguration["children"] {
  return profile.children.map((c) => ({ birthYear: yearOfISO(c.birthDate) }));
}

const newId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/** Pull the shared sections out of a full config to seed a baseline. */
function pickShared(config: SimulationConfiguration): Baseline {
  return {
    income_profile:     config.income_profile,
    market_assumptions: config.market_assumptions,
    spending:           config.spending,
    tax_assumptions:    config.tax_assumptions,
    social_security:    config.social_security,
    medicare:           config.medicare,
    life_events:        config.life_events ?? [],
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Keys touched by an update — used to record which baseline fields a scenario forks. */
function patchKeys(updates: unknown): string[] {
  return isObj(updates) ? Object.keys(updates) : [];
}

/** Merge a section update onto its current value (object merge, or replace for arrays/scalars). */
function mergeSection<T>(current: T, updates: Partial<T> | T): T {
  if (!isObj(updates)) return updates as T;
  return { ...(current as object), ...(updates as object) } as T;
}

/** Diff a scenario's shared sections against the baseline → the paths it has forked. */
function diffUnlinked(config: SimulationConfiguration, baseline: Baseline): string[] {
  const out: string[] = [];
  for (const sec of SHARED_SCALAR_SECTIONS) {
    const a = (config[sec] ?? {}) as Record<string, unknown>;
    const b = (baseline[sec] ?? {}) as Record<string, unknown>;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`${sec}.${k}`);
    }
  }
  if (JSON.stringify(config.life_events ?? []) !== JSON.stringify(baseline.life_events ?? [])) {
    out.push("life_events");
  }
  return out;
}

/** Set the active config AND mirror it into the active scenario entry (per-scenario sections). */
function writeConfig(s: HorizonState, config: SimulationConfiguration) {
  return {
    config,
    scenarios: s.scenarios.map((sc) => (sc.id === s.activeScenarioId ? { ...sc, config } : sc)),
  };
}

/** Fork the given paths on the active scenario and write the new section value there only. */
function forkActive<K extends keyof SimulationConfiguration>(
  s: HorizonState,
  section: K,
  mergedSection: SimulationConfiguration[K],
  paths: string[],
) {
  const config = { ...s.config, [section]: mergedSection };
  return {
    config,
    scenarios: s.scenarios.map((sc) =>
      sc.id === s.activeScenarioId
        ? { ...sc, config, unlinked: Array.from(new Set([...sc.unlinked, ...paths])) }
        : sc
    ),
  };
}

function makeDefaultScenarios(config: SimulationConfiguration): { scenarios: Scenario[]; activeScenarioId: string } {
  const id = newId();
  return { scenarios: [{ id, name: "My Plan", config, unlinked: [] }], activeScenarioId: id };
}

/** Build a fresh scenario config from the baseline + generic per-scenario defaults. */
export function configFromBaseline(baseline: Baseline, profile: UserProfile): SimulationConfiguration {
  const config = structuredClone(DEFAULT_SIM_CONFIG);
  for (const sec of SHARED_SCALAR_SECTIONS) {
    (config[sec] as unknown) = structuredClone(baseline[sec]);
  }
  config.life_events = structuredClone(baseline.life_events ?? []);
  config.birth_year = yearOfISO(profile.birthDate);
  config.children = projectChildren(profile);
  config.career_path = { ...config.career_path, exit_year: profile.retirementYear };
  return config;
}

export const useFinancialStore = create<FinancialStore>()(
  persist(
    (set) => {
      const seed = makeDefaultScenarios(DEFAULT_SIM_CONFIG);
      return {
      profile:   DEFAULT_PROFILE,
      snapshot:  DEFAULT_SNAPSHOT,
      baseline:  pickShared(DEFAULT_SIM_CONFIG),
      config:    DEFAULT_SIM_CONFIG,
      scenarios: seed.scenarios,
      activeScenarioId: seed.activeScenarioId,
      primaryScenarioId: seed.activeScenarioId,
      planHistory: [],
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

          const youngestBirthYear = hasKids ? Math.max(...children.map((c) => yearOfISO(c.birthDate))) : 0;
          const emptyNestSpend =
            hasKids && !hadKids
              ? Math.round(s.baseline.spending.monthly_lifestyle * 0.85)
              : s.baseline.spending.empty_nest_monthly_spend;
          const emptyNest: Partial<SimulationConfiguration["spending"]> = hasKids
            ? { use_empty_nest: true, empty_nest_year: youngestBirthYear + 18, empty_nest_monthly_spend: emptyNestSpend, ...(hadKids ? {} : { empty_nest_linked: true }) }
            : { use_empty_nest: false };

          // College costs & the empty-nest phase are baseline facts derived from the
          // family — they flow into every scenario that hasn't forked them.
          const manualEvents = (s.baseline.life_events ?? []).filter((e) => !e.auto);
          const collegeEvents = buildLifeEvents(children);
          const life_events = [...manualEvents, ...collegeEvents];
          const spending = { ...s.baseline.spending, ...emptyNest };
          const baseline: Baseline = { ...s.baseline, life_events, spending };
          const spendKeys = Object.keys(emptyNest);

          const scenarios = s.scenarios.map((sc) => {
            const cfg: SimulationConfiguration = { ...sc.config, children: projectChildren(profile) };
            if (!sc.unlinked.includes("life_events")) cfg.life_events = life_events;
            const sp = { ...cfg.spending };
            for (const k of spendKeys) {
              if (!sc.unlinked.includes(`spending.${k}`)) (sp as Record<string, unknown>)[k] = (spending as Record<string, unknown>)[k];
            }
            cfg.spending = sp;
            return { ...sc, config: cfg };
          });
          const active = scenarios.find((x) => x.id === s.activeScenarioId) ?? scenarios[0];
          return { profile, baseline, scenarios, config: active.config };
        }),

      updateSnapshot: (updates) =>
        set((s) => ({ snapshot: { ...s.snapshot, ...updates } })),

      updateConfig: (updates) =>
        set((s) => writeConfig(s, { ...s.config, ...updates })),

      updateNestedConfig: (section, updates) =>
        set((s) => {
          const merged = mergeSection(s.config[section], updates);
          const config = { ...s.config, [section]: merged };
          const key = section as string;
          // Shared sections: editing inside a scenario forks the touched fields.
          if (isSharedScalar(key)) {
            const paths = patchKeys(updates).map((k) => `${key}.${k}`);
            return forkActive(s, section, merged, paths.length ? paths : [key]);
          }
          if (key === "life_events") {
            return forkActive(s, section, merged, ["life_events"]);
          }
          // Per-scenario section.
          return writeConfig(s, config);
        }),

      updateNestedSnapshot: (section, updates) =>
        set((s) => ({ snapshot: { ...s.snapshot, [section]: mergeSection(s.snapshot[section], updates) } })),

      updateBaseline: (section, updates) =>
        set((s) => {
          const merged = mergeSection(s.baseline[section], updates) as Baseline[typeof section];
          const baseline: Baseline = { ...s.baseline, [section]: merged };
          const keys = patchKeys(updates);
          const scenarios = s.scenarios.map((sc) => {
            if (section === "life_events") {
              if (sc.unlinked.includes("life_events")) return sc;
              return { ...sc, config: { ...sc.config, life_events: structuredClone(merged as SimulationConfiguration["life_events"]) } };
            }
            const sectionObj = { ...(sc.config[section as keyof SimulationConfiguration] as object) } as Record<string, unknown>;
            const src = merged as Record<string, unknown>;
            for (const k of keys) {
              if (!sc.unlinked.includes(`${section}.${k}`)) sectionObj[k] = src[k];
            }
            return { ...sc, config: { ...sc.config, [section]: sectionObj } };
          });
          const active = scenarios.find((x) => x.id === s.activeScenarioId) ?? scenarios[0];
          return { baseline, scenarios, config: active.config };
        }),

      setEquityComp: (updates) =>
        set((s) => {
          const scenarios = s.scenarios.map((sc) => ({ ...sc, config: { ...sc.config, ...updates } }));
          const active = scenarios.find((x) => x.id === s.activeScenarioId) ?? scenarios[0];
          return { scenarios, config: active.config };
        }),

      seedBaseline: (config) =>
        set((s) => {
          const baseline = pickShared(config);
          const scenarios = s.scenarios.map((sc) => {
            const cfg: SimulationConfiguration = { ...sc.config };
            for (const sec of SHARED_SCALAR_SECTIONS) {
              const src = baseline[sec] as Record<string, unknown>;
              const dst = { ...(cfg[sec] as object) } as Record<string, unknown>;
              for (const k of Object.keys(src)) {
                if (!sc.unlinked.includes(`${sec}.${k}`)) dst[k] = src[k];
              }
              (cfg[sec] as unknown) = dst;
            }
            if (!sc.unlinked.includes("life_events")) cfg.life_events = structuredClone(baseline.life_events ?? []);
            return { ...sc, config: cfg };
          });
          const active = scenarios.find((x) => x.id === s.activeScenarioId) ?? scenarios[0];
          return { baseline, scenarios, config: active.config };
        }),

      resetToBaseline: (path) =>
        set((s) => {
          const active = s.scenarios.find((x) => x.id === s.activeScenarioId);
          if (!active || !active.unlinked.includes(path)) return {};
          const [section, key] = path.split(".");
          const sec = section as keyof SimulationConfiguration;
          let mergedSection: unknown;
          if (key) {
            const baseVal = (s.baseline[section as SharedScalarSection] as Record<string, unknown>)[key];
            mergedSection = { ...(s.config[sec] as object), [key]: baseVal };
          } else {
            mergedSection = structuredClone(s.baseline[section as SharedSection]);
          }
          const config = { ...s.config, [sec]: mergedSection };
          const unlinked = active.unlinked.filter((p) => p !== path);
          return {
            config,
            scenarios: s.scenarios.map((x) => (x.id === active.id ? { ...x, config, unlinked } : x)),
          };
        }),

      updateCareerPath: (updates) =>
        set((s) => writeConfig(s, { ...s.config, career_path: { ...s.config.career_path, ...updates } })),
      updateIncomeProfile: (updates) =>
        set((s) => forkActive(s, "income_profile", { ...s.config.income_profile, ...updates }, patchKeys(updates).map((k) => `income_profile.${k}`))),
      updateMarketAssumptions: (updates) =>
        set((s) => forkActive(s, "market_assumptions", { ...s.config.market_assumptions, ...updates }, patchKeys(updates).map((k) => `market_assumptions.${k}`))),
      updateSpending: (updates) =>
        set((s) => forkActive(s, "spending", { ...s.config.spending, ...updates }, patchKeys(updates).map((k) => `spending.${k}`))),

      // ── Scenarios ────────────────────────────────────────────────────────
      addScenario: (name) =>
        set((s) => {
          const id = newId();
          const config = configFromBaseline(s.baseline, s.profile);
          // Equity-comp setup is a shared fact — carry it into every new scenario.
          config.use_equity_comp = s.config.use_equity_comp;
          config.concentrated_symbol = s.config.concentrated_symbol;
          const sc: Scenario = { id, name: name || `Scenario ${s.scenarios.length + 1}`, config, unlinked: [] };
          return { scenarios: [...s.scenarios, sc], activeScenarioId: id, config };
        }),

      duplicateScenario: (name) =>
        set((s) => {
          const id = newId();
          const active = s.scenarios.find((x) => x.id === s.activeScenarioId);
          const baseName = active?.name ?? "Scenario";
          const config = structuredClone(s.config);
          const sc: Scenario = { id, name: name || `Copy of ${baseName}`, config, unlinked: [...(active?.unlinked ?? [])] };
          return { scenarios: [...s.scenarios, sc], activeScenarioId: id, config };
        }),

      buildScenarioFromBaseline: (name, section, patch) =>
        set((s) => {
          const id = newId();
          const config = configFromBaseline(s.baseline, s.profile);
          config.use_equity_comp = s.config.use_equity_comp;
          config.concentrated_symbol = s.config.concentrated_symbol;
          const merged = mergeSection(config[section], patch as Partial<SimulationConfiguration[typeof section]>);
          (config[section] as unknown) = merged;
          // A tweak to a shared section forks just those fields in the new scenario.
          const unlinked = isSharedScalar(section as string)
            ? Object.keys(patch).map((k) => `${String(section)}.${k}`)
            : String(section) === "life_events" ? ["life_events"] : [];
          const sc: Scenario = { id, name, config, unlinked };
          return { scenarios: [...s.scenarios, sc], activeScenarioId: id, config };
        }),

      addScenarioFromConfig: (name, cfg, unlinked = []) =>
        set((s) => {
          const id = newId();
          const config = { ...structuredClone(cfg), birth_year: yearOfISO(s.profile.birthDate), children: projectChildren(s.profile) };
          const sc: Scenario = { id, name, config, unlinked: Array.from(new Set(unlinked)) };
          return { scenarios: [...s.scenarios, sc], activeScenarioId: id, config };
        }),

      renameScenario: (id, name) =>
        set((s) => ({ scenarios: s.scenarios.map((x) => (x.id === id ? { ...x, name } : x)) })),

      deleteScenario: (id) =>
        set((s) => {
          if (s.scenarios.length <= 1) return {}; // never delete the last one
          const remaining = s.scenarios.filter((x) => x.id !== id);
          // If the primary was deleted, promote the first remaining plan to primary.
          const primaryScenarioId = id === s.primaryScenarioId ? remaining[0].id : s.primaryScenarioId;
          if (id !== s.activeScenarioId) return { scenarios: remaining, primaryScenarioId };
          const next = remaining[0];
          const config = { ...next.config, birth_year: yearOfISO(s.profile.birthDate), children: projectChildren(s.profile) };
          return {
            scenarios: remaining.map((x) => (x.id === next.id ? { ...x, config } : x)),
            activeScenarioId: next.id,
            primaryScenarioId,
            config,
          };
        }),

      setActiveScenario: (id) =>
        set((s) => {
          const sc = s.scenarios.find((x) => x.id === id);
          if (!sc) return {};
          const config = { ...sc.config, birth_year: yearOfISO(s.profile.birthDate), children: projectChildren(s.profile) };
          return {
            activeScenarioId: id,
            config,
            scenarios: s.scenarios.map((x) => (x.id === id ? { ...x, config } : x)),
          };
        }),

      setPrimaryScenario: (id) =>
        set((s) => (s.scenarios.some((x) => x.id === id) ? { primaryScenarioId: id } : {})),

      setLivePrice: (price) => set({ livePrice: price }),

      cacheLivePrices: (prices) =>
        set((s) => {
          let changed = false;
          const other = (s.snapshot.other_investments ?? []).map((inv) => {
            const p = prices[(inv.symbol ?? "").toUpperCase()];
            if (p && p > 0 && p !== inv.current_price) { changed = true; return { ...inv, current_price: p }; }
            return inv;
          });
          const concSym = s.config.use_equity_comp ? (s.config.concentrated_symbol ?? "").toUpperCase() : "";
          const gp = concSym ? prices[concSym] : undefined;
          let share_counts = s.snapshot.share_counts;
          if (gp && gp > 0 && gp !== share_counts.live_stock_price) {
            share_counts = { ...share_counts, live_stock_price: gp };
            changed = true;
          }
          if (!changed) return {};
          return { snapshot: { ...s.snapshot, other_investments: other, share_counts } };
        }),

      recordHistoryPoint: (pt) =>
        set((s) => {
          const now = new Date();
          const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const id = `auto-${ym}`;
          // The auto point is one per month; find it (matching legacy points that
          // predate ids by their month too), leaving any manual captures alone.
          const idx = s.planHistory.findIndex((h) => historyKey(h) === id);
          // The current (in-progress) month refreshes to the latest values each
          // session — so a snapshot taken before prices loaded self-corrects —
          // while past months stay locked as recorded. Keep the original capture
          // time for the month.
          if (idx >= 0) {
            const next = s.planHistory.slice();
            next[idx] = { ...pt, id, ym, manual: false, recordedAt: s.planHistory[idx].recordedAt };
            return { planHistory: next };
          }
          const point: PlanHistoryPoint = { ...pt, id, ym, manual: false, recordedAt: now.toISOString() };
          return { planHistory: [...s.planHistory, point].slice(-240) };
        }),

      addManualSnapshot: (pt) =>
        set((s) => {
          const now = new Date();
          const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          // A distinct, timestamped capture — never deduped by month, so you can
          // build a denser-than-monthly trail on demand.
          const point: PlanHistoryPoint = { ...pt, id: newId(), ym, manual: true, recordedAt: now.toISOString() };
          return { planHistory: [...s.planHistory, point].slice(-240) };
        }),

      removeHistoryPoint: (id) =>
        set((s) => ({ planHistory: s.planHistory.filter((h) => historyKey(h) !== id) })),

      resetToDefaults: () =>
        set(() => {
          const seeded = makeDefaultScenarios(DEFAULT_SIM_CONFIG);
          return { profile: DEFAULT_PROFILE, snapshot: DEFAULT_SNAPSHOT, baseline: pickShared(DEFAULT_SIM_CONFIG), config: DEFAULT_SIM_CONFIG, ...seeded, primaryScenarioId: seeded.activeScenarioId, planHistory: [] };
        }),

      hydrate: (state) =>
        set((s) => {
          const profile = state.profile ?? s.profile;
          let scenarios = (state.scenarios && state.scenarios.length) ? state.scenarios.map((sc) => ({ ...sc, unlinked: sc.unlinked ?? [] })) : null;
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
          // The active scenario seeds the baseline; other scenarios record their
          // divergence from it as forks so existing differences are preserved.
          const baseline = state.baseline ?? pickShared(active.config);
          scenarios = scenarios.map((sc) =>
            sc.id === activeScenarioId
              ? { ...sc, unlinked: state.baseline ? sc.unlinked : [] }
              : { ...sc, unlinked: state.baseline ? sc.unlinked : diffUnlinked(sc.config, baseline) }
          );
          const config = { ...active.config, children: projectChildren(profile) };
          const primaryScenarioId = scenarios.some((x) => x.id === state.primaryScenarioId)
            ? state.primaryScenarioId! : activeScenarioId;
          const planHistory = mergeHistory(state.planHistory ?? [], s.planHistory ?? []);
          return { profile, snapshot: state.snapshot ?? s.snapshot, baseline, scenarios, activeScenarioId, primaryScenarioId, planHistory, config };
        }),
      };
    },
    {
      name:    "horizon-financial-v10",
      version: 13,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        profile: s.profile, snapshot: s.snapshot, baseline: s.baseline, config: s.config,
        scenarios: s.scenarios, activeScenarioId: s.activeScenarioId, primaryScenarioId: s.primaryScenarioId,
        planHistory: s.planHistory,
      }),
      migrate: (persisted: unknown) => {
        const p = persisted as Partial<HorizonState> & { config?: SimulationConfiguration };

        // v11: birth years → full birthdays (ISO). Old data only had a year (and a
        // month for kids); default the missing day to the 1st so nothing breaks.
        const prof = p?.profile as (UserProfile & { birthYear?: number }) | undefined;
        if (prof) {
          const legacy = prof as unknown as { birthYear?: number; birthDate?: string };
          if (legacy.birthDate == null && legacy.birthYear != null) prof.birthDate = isoDate(legacy.birthYear);
          delete legacy.birthYear;
          if (Array.isArray(prof.children)) {
            prof.children = prof.children.map((c) => {
              const k = c as { name: string; birthDate?: string; birthYear?: number; birthMonth?: number };
              return { name: k.name, birthDate: k.birthDate ?? isoDate(k.birthYear ?? new Date().getFullYear() - 8, k.birthMonth ?? 0) };
            });
          }
        }
        if (p && (!p.scenarios || !p.scenarios.length)) {
          const config = p.config ?? DEFAULT_SIM_CONFIG;
          const seeded = makeDefaultScenarios(config);
          p.scenarios = seeded.scenarios;
          p.activeScenarioId = seeded.activeScenarioId;
        }
        if (p && p.scenarios) {
          // Derive the baseline from the active scenario and capture each other
          // scenario's existing divergence as forks.
          const active = p.scenarios.find((x) => x.id === p.activeScenarioId) ?? p.scenarios[0];
          const baseline = p.baseline ?? pickShared(active.config);
          p.baseline = baseline;
          p.scenarios = p.scenarios.map((sc) => ({
            ...sc,
            unlinked: sc.unlinked ?? (sc.id === active.id ? [] : diffUnlinked(sc.config, baseline)),
          }));
          // v12: introduce the primary scenario — default to the active one.
          const pp = p as Partial<HorizonState>;
          if (!pp.primaryScenarioId || !p.scenarios.some((x) => x.id === pp.primaryScenarioId)) {
            pp.primaryScenarioId = active.id;
          }
        }
        // v13: reset the plan-history trail recorded before the live-price fix.
        // Holdings could be snapshotted at $0 before quotes loaded, and past
        // values aren't reconstructable (only outputs were stored) — so clear it
        // once; it rebuilds correctly from the next monthly snapshot.
        (p as Partial<HorizonState>).planHistory = [];
        return p;
      },
    }
  )
);

import type { SimulationConfiguration, FinancialSnapshot } from "@/engine/calculator";

/** The shape of a stored user doc (users/{uid}) that the brief reads from. */
export interface StoredPlanDoc {
  snapshot: FinancialSnapshot;
  config?: SimulationConfiguration;                 // mirror of the ACTIVE scenario — not what the brief uses
  scenarios?: { id: string; config: SimulationConfiguration }[];
  primaryScenarioId?: string;
}

/**
 * The brief is ALWAYS built from the user's PRIMARY scenario — their canonical
 * "home" plan — not whichever scenario is active in the UI (top-level `config`
 * mirrors the active one). The balance sheet (`snapshot`) is shared across
 * scenarios. Matches how planHistory and the safe-FI recorder already select the
 * plan. Falls back to the active-config mirror only if scenarios are missing.
 */
export function selectPrimaryPlan(doc: StoredPlanDoc): { config: SimulationConfiguration; snapshot: FinancialSnapshot } | null {
  const scenarios = doc.scenarios ?? [];
  const primary = scenarios.find((s) => s.id === doc.primaryScenarioId) ?? scenarios[0];
  const config = primary?.config ?? doc.config;
  if (!config || !doc.snapshot) return null;
  return { config, snapshot: doc.snapshot };
}

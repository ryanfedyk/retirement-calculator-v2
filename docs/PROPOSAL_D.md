# Proposal D — Named, Comparable Scenarios

## Vision
Keep several named scenarios — *"Retire 2032," "Sabbatical + bridge," "Lean FIRE," "Work to 60"* — that share your real facts but each carry their own plan levers. The Financial tab models the **active** scenario (the Proposal B levers edit it), you can **overlay scenarios on one chart to compare**, and the active scenario drives the **Forecasting tab**.

## Core split: Facts vs. Plan
**Shared across all scenarios** (your reality):
- `profile` (name, birth year, children, partner age)
- `snapshot` (current cash, 401k, Roth, holdings, debts, 529s)
- Tax / Social Security / Medicare facts

**Per-scenario** (the plan you're modeling):
- `career_path` (exit year, sabbatical/jump/bridge + durations)
- `income_profile` (salary, bonus, equity, additional & partner income, contributions)
- `market_assumptions` (returns, inflation, employer-stock growth)
- `spending` (monthly, mortgage/rent, healthcare, empty-nest)
- `divestment_strategy`, `life_events`, equity-comp/ticker

## Data model & store
```ts
HorizonState {
  profile;                  // shared facts
  snapshot;                 // shared balance sheet
  scenarios: { id; name; config: SimulationConfiguration }[];
  activeScenarioId: string;
  config;                   // mirror of the active scenario's config (engine/UI read this)
}
```
- The engine still consumes one `SimulationConfiguration`, so the top-level `config` mirrors the active scenario; config setters write through to the active scenario entry.
- On switch, the shared identity (`birth_year`, `children`) is re-projected from `profile` so the engine stays consistent with shared facts.

## Migration
- Bump the persist key with a migrate fn: wrap the existing single `config` as one scenario `{ name: "My Plan", config }`, set it active. Same transform on cloud-doc load so existing accounts upgrade seamlessly.

## UI
- **Scenario switcher** near the chart header on the Financial tab: select active, **+ New**, **Duplicate**, **Rename**, **Delete**.
- **Compare mode** (Phase 2): multi-select scenarios → overlay trajectories with a legend; side-by-side FI dates.
- **Forecasting tab**: reads the active scenario; show a "Scenario: X" chip.

## Phasing
- **Phase 1 (MVP):** scenarios in the store + migration + switcher (create/duplicate/rename/delete); active scenario drives everything. Profile + balance sheet shared; tax/SS/Medicare per-scenario for now.
- **Phase 1.5:** promote tax/SS/Medicare to shared facts.
- **Phase 2:** compare/overlay on the chart + side-by-side FI cards.
- **Phase 3:** per-scenario asset overrides, share/export, "what changed vs. baseline" diff.

## Risks
- The migration must not lose existing user data (mitigated by version bump + tested transform).
- Config read/write must consistently route through the active scenario.

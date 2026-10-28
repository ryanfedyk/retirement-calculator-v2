import { describe, it, expect, beforeEach } from "vitest";

// The store persists through localStorage; shim a minimal one for Node.
const mem = new Map<string, string>();
// @ts-expect-error minimal shim
globalThis.localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

import { useFinancialStore } from "@/store/useFinancialStore";

const activeGr = () => useFinancialStore.getState().config.market_assumptions.goog_growth_rate;
const baselineGr = () => useFinancialStore.getState().baseline.market_assumptions.goog_growth_rate;
const activeUnlinked = () => {
  const s = useFinancialStore.getState();
  return s.scenarios.find((x) => x.id === s.activeScenarioId)!.unlinked;
};

describe("Your Finances edits apply to the active scenario (updateBaselineAndApply)", () => {
  beforeEach(() => {
    mem.clear();
    useFinancialStore.setState(useFinancialStore.getInitialState(), true);
  });

  it("propagates to an unforked scenario", () => {
    useFinancialStore.getState().updateBaselineAndApply("market_assumptions", { goog_growth_rate: 6 });
    expect(baselineGr()).toBe(6);
    expect(activeGr()).toBe(6);
  });

  it("applies to the active scenario EVEN when that path was forked (the reported bug)", () => {
    // User nudged the scenario-level "GOOG Return" lever → forked the path at 10%.
    useFinancialStore.getState().updateMarketAssumptions({ goog_growth_rate: 10 });
    expect(activeGr()).toBe(10);
    expect(activeUnlinked()).toContain("market_assumptions.goog_growth_rate");

    // User edits the finances "Expected Return (%)" → now actually takes effect.
    useFinancialStore.getState().updateBaselineAndApply("market_assumptions", { goog_growth_rate: 6 });
    expect(baselineGr()).toBe(6);
    expect(activeGr()).toBe(6); // the on-screen plan moves
    expect(activeUnlinked()).not.toContain("market_assumptions.goog_growth_rate"); // re-linked
  });

  it("only re-links the edited path, leaving other forks on the active scenario intact", () => {
    // Fork two different paths.
    useFinancialStore.getState().updateMarketAssumptions({ goog_growth_rate: 10 });
    useFinancialStore.getState().updateSpending({ monthly_lifestyle: 3000 });
    expect(activeUnlinked()).toEqual(
      expect.arrayContaining(["market_assumptions.goog_growth_rate", "spending.monthly_lifestyle"]),
    );

    // Editing the growth rate must not disturb the spending fork.
    useFinancialStore.getState().updateBaselineAndApply("market_assumptions", { goog_growth_rate: 6 });
    expect(activeGr()).toBe(6);
    expect(useFinancialStore.getState().config.spending.monthly_lifestyle).toBe(3000);
    expect(activeUnlinked()).toContain("spending.monthly_lifestyle");
    expect(activeUnlinked()).not.toContain("market_assumptions.goog_growth_rate");
  });

  it("plain updateBaseline (Settings) still respects an existing fork", () => {
    useFinancialStore.getState().updateMarketAssumptions({ goog_growth_rate: 10 });
    useFinancialStore.getState().updateBaseline("market_assumptions", { goog_growth_rate: 6 });
    expect(baselineGr()).toBe(6);
    expect(activeGr()).toBe(10); // unchanged — Settings respects overrides
  });
});

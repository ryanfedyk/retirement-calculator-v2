import { describe, it, expect } from "vitest";
import { buildScenarioReport } from "@/lib/scenarioReport";
import { runSimulation } from "@/engine/calculator";
import { DEFAULT_SIM_CONFIG, DEFAULT_SNAPSHOT } from "@/config/sharedConfig";

const snap = () => structuredClone(DEFAULT_SNAPSHOT);
const cfg = () => structuredClone(DEFAULT_SIM_CONFIG);

describe("buildScenarioReport", () => {
  it("produces a self-contained report with the key sections", () => {
    const text = buildScenarioReport({
      scenarioName: "Base Plan",
      snapshot: snap(),
      config: cfg(),
      liveGoogPrice: 180,
      includeMonteCarlo: false,
    });
    expect(text).toContain('# Retirement plan: "Base Plan"');
    expect(text).toContain("## 9. Financial-independence test");
    expect(text).toContain("FI_number     = net_need / 0.04");
    expect(text).toContain("monthly = (1 + r/100)^(1/12) − 1");
    expect(text).toContain("## 10. Results");
  });

  it("reports an FI number that matches the engine's (25 × net need)", () => {
    const c = cfg();
    const s = snap();
    const traj = runSimulation(s, c, 180);
    const today = traj[0];
    const text = buildScenarioReport({
      scenarioName: "X",
      snapshot: s,
      config: c,
      liveGoogPrice: 180,
      includeMonteCarlo: false,
    });
    // The headline FI number is formatted with thousands separators.
    const expected = `$${Math.round(today.swrTarget).toLocaleString("en-US")}`;
    expect(text).toContain(expected);
  });

  it("includes the Monte Carlo section only when requested", () => {
    const withMc = buildScenarioReport({ scenarioName: "X", snapshot: snap(), config: cfg(), includeMonteCarlo: true });
    const without = buildScenarioReport({ scenarioName: "X", snapshot: snap(), config: cfg(), includeMonteCarlo: false });
    expect(withMc).toContain("Sequence-of-returns risk (Monte Carlo)");
    expect(without).not.toContain("Sequence-of-returns risk (Monte Carlo)");
  });
});

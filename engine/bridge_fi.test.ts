import { describe, it, expect } from "vitest";
import { runMonteCarlo, findMonteCarloFiYears } from "@/engine/montecarlo";
import { findCashflowFiPoint } from "@/engine/calculator";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";
import { DEFAULT_SIM_CONFIG, DEFAULT_SNAPSHOT } from "@/config/sharedConfig";

const YEAR = new Date().getFullYear();

function setup(): { snap: FinancialSnapshot; cfg: SimulationConfiguration } {
  const snap = structuredClone(DEFAULT_SNAPSHOT);
  snap.liquid_assets.cash_savings = 900_000;
  snap.retirement_assets.k401 = 500_000;

  const cfg = structuredClone(DEFAULT_SIM_CONFIG);
  cfg.birth_year = YEAR - 50;
  cfg.career_path.exit_year = YEAR + 1;
  cfg.income_profile.gross_annual_salary = 200_000;
  cfg.spending.monthly_lifestyle = 7_000;
  cfg.spending.healthcare_premium = 1_200;
  return { snap, cfg };
}

function withBridge(cfg: SimulationConfiguration): SimulationConfiguration {
  const c = structuredClone(cfg);
  c.career_path.use_bridge = true;
  c.career_path.bridge_duration = 6;
  c.income_profile.bridge_gross_annual = 150_000;
  return c;
}

const safeYear = (snap: FinancialSnapshot, cfg: SimulationConfiguration) =>
  findMonteCarloFiYears(snap, cfg, 0, { probabilities: [0.9], runsPerYear: 150 }).thresholds[0]?.year ?? null;
const baseYear = (snap: FinancialSnapshot, cfg: SimulationConfiguration) => {
  const p = findCashflowFiPoint(snap, cfg, 0);
  return p ? Number(p.date.split(" ")[1]) : null;
};

describe("bridge job now flows through the FI calculations", () => {
  it("runMonteCarlo success rate reflects a bridge job (unchanged — already worked)", () => {
    const { snap, cfg } = setup();
    expect(runMonteCarlo(snap, withBridge(cfg), 0, { runs: 300 }).successRate)
      .toBeGreaterThan(runMonteCarlo(snap, cfg, 0, { runs: 300 }).successRate);
  });

  it("deterministic base FI year is earlier once a bridge job is planned", () => {
    const { snap, cfg } = setup();
    const noBridge = baseYear(snap, cfg);
    const bridge = baseYear(snap, withBridge(cfg));
    expect(noBridge).not.toBeNull();
    expect(bridge).not.toBeNull();
    expect(bridge!).toBeLessThan(noBridge!);
  });

  it("headline safe-FI year (Monte Carlo) is earlier once a bridge job is planned", () => {
    const { snap, cfg } = setup();
    const noBridge = safeYear(snap, cfg);
    const bridge = safeYear(snap, withBridge(cfg));
    expect(noBridge).not.toBeNull();
    expect(bridge).not.toBeNull();
    expect(bridge!).toBeLessThan(noBridge!);
  });
});

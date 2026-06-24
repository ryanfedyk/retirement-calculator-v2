import { describe, it, expect } from "vitest";
import { runSimulation } from "@/engine/calculator";
import { runMonteCarlo } from "@/engine/montecarlo";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";
import { DEFAULT_SIM_CONFIG, DEFAULT_SNAPSHOT } from "@/config/sharedConfig";

const baseConfig = (): SimulationConfiguration => structuredClone(DEFAULT_SIM_CONFIG);
const baseSnap = (): FinancialSnapshot => structuredClone(DEFAULT_SNAPSHOT);
const YEAR = new Date().getFullYear();

// A retiree funded by a single cash bucket with no other moving parts, so Monte
// Carlo behavior is easy to reason about.
function retiree(opts: { cash?: number; spend?: number } = {}): { snap: FinancialSnapshot; cfg: SimulationConfiguration } {
  const cfg = baseConfig();
  cfg.birth_year = YEAR - 60;
  cfg.career_path.exit_year = YEAR;
  cfg.career_path.use_sabbatical = false;
  cfg.career_path.use_jump = false;
  cfg.career_path.use_bridge = false;
  cfg.income_profile.gross_annual_salary = 0;
  cfg.spending.monthly_lifestyle = opts.spend ?? 3_000;
  cfg.spending.healthcare_premium = 0;
  cfg.spending.mortgage_payment = 0;
  cfg.medicare.monthly_premium = 0;
  cfg.market_assumptions.volatility_drag = 0;
  const snap = baseSnap();
  snap.liquid_assets.cash_savings = opts.cash ?? 2_000_000;
  return { snap, cfg };
}

describe("runMonteCarlo", () => {
  it("is reproducible for a given seed", () => {
    const { snap, cfg } = retiree();
    const a = runMonteCarlo(snap, cfg, 200, { runs: 80, seed: 42 });
    const b = runMonteCarlo(snap, cfg, 200, { runs: 80, seed: 42 });
    expect(a.successRate).toBe(b.successRate);
    expect(a.bands).toEqual(b.bands);
  });

  it("returns a success rate in [0,1] and ordered percentile bands", () => {
    const { snap, cfg } = retiree();
    const res = runMonteCarlo(snap, cfg, 200, { runs: 120, seed: 7 });
    expect(res.successRate).toBeGreaterThanOrEqual(0);
    expect(res.successRate).toBeLessThanOrEqual(1);
    expect(res.bands.length).toBeGreaterThan(0);
    for (const b of res.bands) {
      expect(b.p10).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p90);
    }
  });

  it("collapses to the deterministic path at zero volatility", () => {
    // No drag, single cash bucket → the zero-vol MC return equals the engine's
    // deterministic real return for every asset, so the median band should track
    // the deterministic net worth and the band should have no spread.
    const { snap, cfg } = retiree({ spend: 0 });
    const mc = runMonteCarlo(snap, cfg, 200, { runs: 30, seed: 1, volatilityPct: 0, sampleEvery: 12 });
    const det = runSimulation(snap, cfg, 200);
    for (const band of mc.bands) {
      expect(band.p90 - band.p10).toBeLessThan(1); // no dispersion
      expect(band.p50).toBeCloseTo(det[band.monthIndex].totalNetWorth, -1);
    }
  });

  it("widens the outcome band as volatility rises", () => {
    const { snap, cfg } = retiree();
    const lo = runMonteCarlo(snap, cfg, 200, { runs: 200, seed: 5, volatilityPct: 5 });
    const hi = runMonteCarlo(snap, cfg, 200, { runs: 200, seed: 5, volatilityPct: 25 });
    const spread = (r: typeof lo) => { const b = r.bands[r.bands.length - 1]; return b.p90 - b.p10; };
    expect(spread(hi)).toBeGreaterThan(spread(lo));
  });

  it("does not re-apply volatility drag to the random mean (that's σ's job)", () => {
    // The deterministic engine subtracts volatility_drag; Monte Carlo must NOT,
    // or returns are double-penalized. So the drag knob has no effect on the MC
    // outcome — two plans differing only in volatility_drag are identical here.
    const a = retiree({ cash: 1_100_000, spend: 4_500 });
    const b = retiree({ cash: 1_100_000, spend: 4_500 });
    a.cfg.market_assumptions.volatility_drag = 0;
    b.cfg.market_assumptions.volatility_drag = 3;
    const ra = runMonteCarlo(a.snap, a.cfg, 200, { runs: 150, seed: 11 });
    const rb = runMonteCarlo(b.snap, b.cfg, 200, { runs: 150, seed: 11 });
    expect(rb.successRate).toBe(ra.successRate);
  });

  it("rates an over-funded plan safe and an over-spending plan risky", () => {
    const safe = retiree({ cash: 5_000_000, spend: 3_000 });   // ~0.7% withdrawal
    const risky = retiree({ cash: 700_000, spend: 6_000 });    // ~10% withdrawal
    const safeRes = runMonteCarlo(safe.snap, safe.cfg, 200, { runs: 200, seed: 3 });
    const riskyRes = runMonteCarlo(risky.snap, risky.cfg, 200, { runs: 200, seed: 3 });
    expect(safeRes.successRate).toBeGreaterThan(0.95);
    expect(riskyRes.successRate).toBeLessThan(safeRes.successRate);
    expect(riskyRes.successRate).toBeLessThan(0.5);
  });
});

// ── Monte Carlo / sequence-of-returns risk ────────────────────────────────────
//
// The deterministic projection applies one smooth real return every month, which
// hides the single biggest risk in retirement: the ORDER of returns. A retiree
// who hits a bad first decade can run out even when the long-run average is fine.
//
// This runs the same engine many times over randomized real-return sequences and
// reports the spread of outcomes (P10 / P50 / P90 net-worth bands) plus a success
// probability — the share of paths that never deplete spendable assets in
// retirement. Returns are drawn once per year (a bad year is bad for all 12
// months), holding the draw flat across the year, which is the standard way to
// capture sequence risk. The draw drives the whole diversified portfolio; the
// concentrated employer position keeps its own growth assumption (see
// runSimulation's marketReturnPath).

import { runSimulation, findCashflowFiPoint } from "./calculator";
import type { FinancialSnapshot, SimulationConfiguration } from "./calculator";

export interface MonteCarloBand {
  monthIndex: number;
  date: string;
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloResult {
  runs: number;
  successRate: number;          // fraction of paths that never deplete in retirement
  bands: MonteCarloBand[];      // net-worth percentile bands (sampled over time)
  medianFinalNetWorth: number;  // P50 spendable assets at the end of the horizon
}

export interface MonteCarloOptions {
  runs?: number;          // number of simulated paths (default 400)
  seed?: number;          // PRNG seed for reproducibility (default fixed)
  volatilityPct?: number; // annual std-dev of real returns; default config value or 15
  sampleEvery?: number;   // months between band samples (default 12)
}

// mulberry32 — a tiny, fast, seedable PRNG. Deterministic given a seed so Monte
// Carlo runs are reproducible (important for tests and stable UI between renders).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard-normal sample via the Box–Muller transform.
function makeNormal(rand: () => number): () => number {
  return () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.round((p / 100) * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

const PATH_MONTHS = 1001; // ≥ the engine's max monthsToSimulate

export function runMonteCarlo(
  snapshot: FinancialSnapshot,
  config: SimulationConfiguration,
  livePrice: number,
  opts: MonteCarloOptions = {}
): MonteCarloResult {
  const runs = Math.max(1, Math.floor(opts.runs ?? 400));
  const seed = opts.seed ?? 0x9e3779b9;
  const sampleEvery = Math.max(1, Math.floor(opts.sampleEvery ?? 12));

  // Reconcile the two models so they target the SAME expected real return.
  //
  // The deterministic engine compounds at a GEOMETRIC real rate:
  //     geo = toReal(market_return_rate − volatility_drag)
  // The Monte Carlo draws are ARITHMETIC; over time their variance drags the
  // realized geometric mean down by ≈ σ²/2 (the "volatility drag" that emerges on
  // its own from sequence risk). If we drew with an arithmetic mean of
  // toReal(market_return_rate) — i.e. WITHOUT the drag — the MC would compound at
  // geo + drag − σ²/2, i.e. a DIFFERENT (more optimistic) rate than the
  // deterministic path whenever drag ≠ σ²/2. That mismatch is a real bug: the two
  // projections would disagree on the same portfolio.
  //
  // Fix: pin the MC's arithmetic mean to the deterministic geometric target plus
  // the variance drag, so the drawn paths compound to `geo` in expectation and the
  // deterministic projection lands on the MC median.
  const infl = config.market_assumptions.inflation_rate || 0;
  const nominalMean = Math.max(0, config.market_assumptions.market_return_rate);
  const drag = Math.max(0, config.market_assumptions.volatility_drag || 0);
  const geoRealPct = ((1 + Math.max(0, nominalMean - drag) / 100) / (1 + infl / 100) - 1) * 100;
  const sdPct = opts.volatilityPct ?? config.market_assumptions.return_volatility ?? 15;
  const sigma = sdPct / 100;
  const meanRealPct = geoRealPct + (sigma * sigma / 2) * 100; // arithmetic mean s.t. geometric ≈ geoRealPct

  const rand = mulberry32(seed);
  const normal = makeNormal(rand);

  const years = Math.ceil(PATH_MONTHS / 12);
  const byMonth = new Map<number, number[]>(); // month index → net worth across runs
  const dates = new Map<number, string>();
  const finals: number[] = [];
  let successes = 0;

  for (let r = 0; r < runs; r++) {
    // One real-return draw per year, held flat across that year's 12 months.
    const path = new Array<number>(PATH_MONTHS);
    for (let y = 0; y < years; y++) {
      // A normal draw can technically fall below −100% (an impossible annual
      // return that would drive the portfolio negative). At σ=15% that's a ~7-sigma
      // event, but clamp the floor at −95% so no drawn path is mathematically
      // impossible. (No upper clamp — big positive years are fine.)
      const annual = Math.max(-95, meanRealPct + sdPct * normal());
      for (let m = 0; m < 12; m++) {
        const idx = y * 12 + m;
        if (idx < PATH_MONTHS) path[idx] = annual;
      }
    }

    const traj = runSimulation(snapshot, config, livePrice, path);

    // Success = the actual investable ACCOUNT balances never deplete once retired.
    // Use gross investableAssets (real account balances the cash-flow engine draws
    // from), NOT the after-tax spendable valuation — that's a valuation overlay, and
    // failure means "couldn't fund an expense", i.e. the real balances ran out. This
    // also matches assessPlan's deterministic depletion test, so the deterministic
    // and Monte Carlo FI dates use one consistent definition of "ran out".
    let depleted = false;
    for (const p of traj) {
      if (p.currentPhase === "RETIRED" && p.investableAssets <= 0) {
        depleted = true;
        break;
      }
    }
    if (!depleted) successes++;
    finals.push(traj[traj.length - 1].investableAfterTax);

    for (let i = 0; i < traj.length; i += sampleEvery) {
      let bucket = byMonth.get(i);
      if (!bucket) {
        bucket = [];
        byMonth.set(i, bucket);
        dates.set(i, traj[i].date);
      }
      bucket.push(traj[i].totalNetWorth);
    }
  }

  const bands: MonteCarloBand[] = [...byMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([monthIndex, vals]) => {
      vals.sort((a, b) => a - b);
      return {
        monthIndex,
        date: dates.get(monthIndex)!,
        p10: percentile(vals, 10),
        p50: percentile(vals, 50),
        p90: percentile(vals, 90),
      };
    });

  finals.sort((a, b) => a - b);
  return {
    runs,
    successRate: successes / runs,
    bands,
    medianFinalNetWorth: percentile(finals, 50),
  };
}

export interface MonteCarloFiResult {
  /** The deterministic (base-case) FI year — the median-path reference. */
  baseYear: number | null;
  /** Earliest exit YEAR whose Monte Carlo success rate meets each probability. */
  thresholds: { p: number; year: number | null }[];
  /** The actual success rate at each candidate exit year scanned — so the reader
   *  sees 88% vs 97% vs 99.7%, not just which rounded threshold was crossed. */
  scanned: { year: number; successRate: number }[];
  /** Simulations run per candidate year (so the reported precision is auditable). */
  runsPerYear: number;
}

/**
 * Confidence-graded FI dates: alongside the single deterministic FI date, the
 * earliest retirement year that funds the plan to age 100 in at least 90% / 95% /
 * 99% of simulated market paths. A deterministic date answers "does it work under
 * the base-case return?"; this answers "how sure am I?" — usually the far more
 * decision-relevant question.
 *
 * Efficiency: a probability-graded date can't precede the median-path (base-case)
 * date — higher confidence must survive worse sequences, needing a later exit — so
 * we scan UPWARD from the base year, run Monte Carlo per candidate exit with a
 * FIXED seed (every year sees the same return paths, so success rates are directly
 * comparable and monotonic), and stop the moment the strictest threshold is met.
 */
export function findMonteCarloFiYears(
  snapshot: FinancialSnapshot,
  config: SimulationConfiguration,
  livePrice = 0,
  opts: { probabilities?: number[]; runsPerYear?: number; seed?: number } = {},
): MonteCarloFiResult {
  const probs = (opts.probabilities ?? [0.9, 0.95, 0.99]).slice().sort((a, b) => a - b);
  const runs  = Math.max(1, Math.floor(opts.runsPerYear ?? 500));
  const seed  = opts.seed ?? 0x1234567;
  const startYear = new Date().getFullYear();
  const maxYear   = (config.birth_year || 1985) + 75;

  const basePt = findCashflowFiPoint(snapshot, config, livePrice);
  const baseYear = basePt ? Number(basePt.date.split(" ")[1]) : null;

  const results = probs.map((p) => ({ p, year: null as number | null }));
  const scanned: { year: number; successRate: number }[] = [];
  // If the plan never reaches FI even on the deterministic median path, it can't
  // reach any confidence threshold either — skip the (potentially long) scan.
  if (baseYear == null) return { baseYear: null, thresholds: results, scanned, runsPerYear: runs };

  // Scan upward from the base year, capped so a marginal plan that never reaches
  // 99% doesn't scan decades (and keeps report generation bounded). If a threshold
  // isn't met within this window it's reported as "not within horizon".
  const scanTo = Math.min(maxYear, baseYear + 15);
  for (let yr = Math.max(startYear, baseYear); yr <= scanTo; yr++) {
    const cfg: SimulationConfiguration = {
      ...structuredClone(config),
      career_path: { ...config.career_path, exit_year: yr, use_sabbatical: false, use_jump: false, use_bridge: false },
    };
    const { successRate } = runMonteCarlo(snapshot, cfg, livePrice, { runs, seed });
    scanned.push({ year: yr, successRate });
    for (const r of results) if (r.year == null && successRate >= r.p) r.year = yr;
    if (results.every((r) => r.year != null)) break;
  }
  return { baseYear, thresholds: results, scanned, runsPerYear: runs };
}

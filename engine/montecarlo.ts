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

import { runSimulation } from "./calculator";
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

  // Mean for the random draws = the ARITHMETIC expected real return, NOT the
  // deterministic engine's drag-adjusted rate. In a stochastic model the
  // geometric "volatility drag" emerges on its own from the variance of the
  // draws (≈ σ²/2 over time); subtracting `volatility_drag` here as well would
  // double-penalize returns and understate the success rate. So deflate the raw
  // expected return by inflation and let σ generate the drag.
  const infl = config.market_assumptions.inflation_rate || 0;
  const nominalMean = Math.max(0, config.market_assumptions.market_return_rate);
  const meanRealPct = ((1 + nominalMean / 100) / (1 + infl / 100) - 1) * 100;
  const sdPct = opts.volatilityPct ?? config.market_assumptions.return_volatility ?? 15;

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
      const annual = meanRealPct + sdPct * normal();
      for (let m = 0; m < 12; m++) {
        const idx = y * 12 + m;
        if (idx < PATH_MONTHS) path[idx] = annual;
      }
    }

    const traj = runSimulation(snapshot, config, livePrice, path);

    // Success = spendable assets never hit zero once retired.
    let depleted = false;
    for (const p of traj) {
      if (p.currentPhase === "RETIRED" && p.investableAfterTax <= 0) {
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

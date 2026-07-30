"use client";
import { useEffect, useState } from "react";
import { findMonteCarloFiYears } from "@/engine/montecarlo";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";

export interface SafeFiYear {
  /** Earliest full-retirement YEAR whose Monte-Carlo success rate meets the target
   *  probability (default 90%) — a date you can actually plan around, not the
   *  arithmetic earliest. null when no year in the horizon clears the bar. */
  year: number | null;
  /** The deterministic (median-path) FI year, for reference. */
  baseYear: number | null;
  /** True while the (debounced) scan is running and no value is known yet. */
  loading: boolean;
}

/**
 * The headline FI date, made trustworthy. The deterministic cash-flow FI date is
 * the earliest month you could retire under ONE smooth return path — it ignores
 * the ORDER of returns, so an early date can be a coin flip. This finds the
 * earliest year that survives at least `probability` of randomized market paths
 * (default 90%), so the date the app shows is one you can safely plan around.
 *
 * The scan runs many simulations, so it lives OFF the render path in a debounced
 * effect and keeps its last answer while recomputing — the dashboard never freezes
 * on a keystroke, and the number settles a beat after you stop editing.
 */
export function useSafeFiYear(
  snapshot: FinancialSnapshot,
  config: SimulationConfiguration,
  liveGoogPrice: number,
  probability = 0.9,
  runsPerYear = 120,
): SafeFiYear {
  const [state, setState] = useState<SafeFiYear>({ year: null, baseYear: null, loading: true });

  const key = JSON.stringify([probability, runsPerYear, Math.round(liveGoogPrice), config, snapshot]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    let cancelled = false;
    const t = setTimeout(() => {
      const res = findMonteCarloFiYears(snapshot, config, liveGoogPrice, { probabilities: [probability], runsPerYear });
      if (cancelled) return;
      setState({ year: res.thresholds[0]?.year ?? null, baseYear: res.baseYear, loading: false });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

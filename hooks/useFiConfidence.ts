"use client";
import { useEffect, useState } from "react";
import { runMonteCarlo } from "@/engine/montecarlo";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";

const MMM = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface FiConfidence {
  /** Monte-Carlo success rate (%) for FULLY retiring at the FI date, or null when
   *  there's no FI date / it hasn't been computed yet. */
  pct: number | null;
  /** True while the (debounced) simulation is running. */
  loading: boolean;
}

/**
 * How safe is the headline FI date, really? The deterministic cash-flow FI date is
 * the earliest month you could retire under ONE smooth return path — it ignores the
 * order of returns, which is the biggest risk in early retirement. This runs a
 * Monte-Carlo at that exact date (retire fully, randomized return sequences) and
 * returns the share of paths that never deplete, so the headline can carry an
 * honest "≈X% safe" cue instead of reading as a guarantee.
 *
 * The simulation (~200 lifetime paths) is real work, so it runs OFF the render path
 * in a debounced effect — the card shows the last value (or a "checking…" state)
 * and updates a beat later, rather than freezing the dashboard on every keystroke.
 */
export function useFiConfidence(
  snapshot: FinancialSnapshot,
  config: SimulationConfiguration,
  liveGoogPrice: number,
  fiDate: string | null | undefined,
  runs = 200,
): FiConfidence {
  const [state, setState] = useState<FiConfidence>({ pct: null, loading: false });

  // A stable key so we don't re-run on unrelated re-renders — only when an input
  // that actually moves the number changes.
  const key = fiDate
    ? JSON.stringify([fiDate, runs, Math.round(liveGoogPrice), config, snapshot])
    : "";

  useEffect(() => {
    if (!fiDate) { setState({ pct: null, loading: false }); return; }
    const parts = fiDate.split(" ");
    const fiYear = Number(parts[1]);
    const fiMonth = Math.max(0, MMM.indexOf(parts[0]));
    if (!fiYear) { setState({ pct: null, loading: false }); return; }

    setState((s) => ({ pct: s.pct, loading: true }));
    let cancelled = false;
    const t = setTimeout(() => {
      // Retire FULLY at the FI date — drop any sabbatical/jump/bridge so the odds
      // describe "stop working at this date", matching how the FI date is read.
      const cfg: SimulationConfiguration = {
        ...config,
        career_path: { ...config.career_path, exit_year: fiYear, exit_month: fiMonth, use_sabbatical: false, use_jump: false, use_bridge: false },
      };
      const mc = runMonteCarlo(snapshot, cfg, liveGoogPrice, { runs });
      if (!cancelled) setState({ pct: Math.round(mc.successRate * 100), loading: false });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

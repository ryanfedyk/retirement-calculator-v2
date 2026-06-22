"use client";
/**
 * useScenarioSuggestions — the "What if…" engine. Derives a handful of tweaks
 * from the active scenario (leave sooner/later, trim spend, cooler markets),
 * previews each one's impact on the FI date, and exposes a `build()` that turns
 * a suggestion into a real, named scenario (clone active → apply → switch).
 *
 * Shared by the Scenarios hub (desktop) and the mobile scenario bar.
 */
import { useMemo } from "react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulation, continuousFiMonth, type SimulationConfiguration } from "@/engine/calculator";
import { C } from "@/config/colors";
import type { LivePrices } from "@/hooks/useLivePrices";

const fmtK = (v: number) => `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
const fmtM = (a: number) => {
  if (a >= 1_000_000) { const m = a / 1_000_000; return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`; }
  if (a >= 1_000) return `$${(a / 1_000).toFixed(0)}k`;
  return `$${Math.round(a)}`;
};
const signM = (v: number) => `${v >= 0 ? "+" : "−"}${fmtM(Math.abs(v))}`;
const fiMonthToDate = (m: number) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + Math.round(m), 1); };
const fmtDate = (d: Date) => d.toLocaleString("default", { month: "short", year: "numeric" });

type Section = "career_path" | "spending" | "market_assumptions";
interface Spec { title: string; section: Section; patch: Record<string, number> }

export interface Suggestion {
  title: string;
  /** Absolute projected FI date, e.g. "Mar 2032" / "30+ yrs" */
  fiDate: string;
  /** e.g. "4 mo earlier" / "no change" / "—" */
  fiDelta: string;
  fiColor: string;
  /** Signed net-worth delta at the horizon vs the active scenario, e.g. "+$1.2M" */
  nwDelta: string;
  nwColor: string;
  /** Label for the horizon year, e.g. "Net worth ’55" */
  nwLabel: string;
  /** Create the scenario: clones the active one, applies the tweak, switches to it. */
  build: () => void;
}

export function useScenarioSuggestions(livePrices: LivePrices): Suggestion[] {
  const { config, snapshot, duplicateScenario, updateNestedConfig } = useFinancialStore();

  const liveGoogPrice = (livePrices["GOOG"] ?? livePrices["GOOGL"])?.price ?? 0;
  const enrichedSnapshot = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map((inv) => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  const specs = useMemo<Spec[]>(() => {
    const exit = config.career_path.exit_year;
    const spend = config.spending.monthly_lifestyle;
    const ret = config.market_assumptions.market_return_rate;
    const list: Spec[] = [
      { title: `Leave in ${exit - 1}`, section: "career_path", patch: { exit_year: exit - 1 } },
      { title: `Work through ${exit + 1}`, section: "career_path", patch: { exit_year: exit + 1 } },
      { title: `Spend ${fmtK(Math.max(0, spend - 1000))}/mo`, section: "spending", patch: { monthly_lifestyle: Math.max(0, spend - 1000) } },
      { title: `Markets cool to ${(ret - 2).toFixed(0)}%`, section: "market_assumptions", patch: { market_return_rate: ret - 2 } },
    ];
    return list;
  }, [config]);

  return useMemo(() => {
    const nwLabel = `Net worth ’${String(new Date().getFullYear() + 30).slice(2)}`;
    const baseTraj = runSimulation(enrichedSnapshot, config, liveGoogPrice);
    const baseFi = continuousFiMonth(baseTraj);
    const baseFinal = baseTraj[baseTraj.length - 1]?.totalNetWorth ?? 0;

    return specs.map((s) => {
      const tweaked: SimulationConfiguration = { ...config, [s.section]: { ...(config[s.section] as object), ...s.patch } } as SimulationConfiguration;
      const traj = runSimulation(enrichedSnapshot, tweaked, liveGoogPrice);
      const fi = continuousFiMonth(traj);
      const finalNW = traj[traj.length - 1]?.totalNetWorth ?? 0;

      const dMonths = baseFi != null && fi != null ? Math.round(baseFi - fi) : null;
      const earlier = (dMonths ?? 0) > 0;
      const dMoney = finalNW - baseFinal;

      return {
        title: s.title,
        fiDate: fi != null ? fmtDate(fiMonthToDate(fi)) : "30+ yrs",
        fiDelta: dMonths == null ? "—" : dMonths === 0 ? "no change" : `${Math.abs(dMonths)} mo ${earlier ? "earlier" : "later"}`,
        fiColor: dMonths == null || dMonths === 0 ? C.inkFaint : earlier ? C.tealDark : C.warm,
        nwDelta: Math.abs(dMoney) < 1000 ? "≈ same" : signM(dMoney),
        nwColor: Math.abs(dMoney) < 1000 ? C.inkSoft : dMoney > 0 ? C.tealDark : C.warm,
        nwLabel,
        build: () => { duplicateScenario(s.title); updateNestedConfig(s.section, s.patch); },
      };
    });
  }, [specs, config, enrichedSnapshot, liveGoogPrice, duplicateScenario, updateNestedConfig]);
}

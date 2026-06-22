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

type Section = "career_path" | "spending" | "market_assumptions";
interface Spec { title: string; section: Section; patch: Record<string, number> }

export interface Suggestion {
  title: string;
  /** e.g. "4 mo earlier" / "no change" / "—" */
  fiDelta: string;
  fiColor: string;
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
    const baseFi = continuousFiMonth(runSimulation(enrichedSnapshot, config, liveGoogPrice));
    return specs.map((s) => {
      const tweaked: SimulationConfiguration = { ...config, [s.section]: { ...(config[s.section] as object), ...s.patch } } as SimulationConfiguration;
      const fi = continuousFiMonth(runSimulation(enrichedSnapshot, tweaked, liveGoogPrice));
      const dMonths = baseFi != null && fi != null ? Math.round(baseFi - fi) : null;
      const earlier = (dMonths ?? 0) > 0;
      return {
        title: s.title,
        fiDelta: dMonths == null ? "—" : dMonths === 0 ? "no change" : `${Math.abs(dMonths)} mo ${earlier ? "earlier" : "later"}`,
        fiColor: dMonths == null || dMonths === 0 ? C.inkFaint : earlier ? C.tealDark : C.warm,
        build: () => { duplicateScenario(s.title); updateNestedConfig(s.section, s.patch); },
      };
    });
  }, [specs, config, enrichedSnapshot, liveGoogPrice, duplicateScenario, updateNestedConfig]);
}

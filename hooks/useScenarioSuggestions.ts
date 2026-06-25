"use client";
/**
 * useScenarioSuggestions — the "Ideas to try" engine. Takes the scenario you're
 * currently looking at and spins off a diverse set of what-ifs (retire a year
 * sooner/later, take a sabbatical, change careers, trim spending, buy a second
 * home, cooler/hotter markets, move to a no-tax state…). Each previews its
 * impact on the FI date and ending net worth, and `build()` turns it into a real
 * scenario — a true offshoot of the one you started from.
 *
 * Consumed by the Scenarios hub.
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

const NO_TAX_STATES = new Set(["AK", "FL", "NH", "NV", "SD", "TN", "TX", "WA", "WY", "NONE"]);

/** A what-if applied to a cloned config, plus the baseline paths it forks. */
interface Idea {
  title: string;
  apply: (cfg: SimulationConfiguration) => void;
  /** Shared-baseline leaf paths this idea overrides (so the offshoot stays linked elsewhere). */
  unlink: string[];
  /** Only offer the idea when it actually differs from the current scenario. */
  when?: (cfg: SimulationConfiguration) => boolean;
}

export interface Suggestion {
  title: string;
  /** Absolute projected FI date, e.g. "Mar 2032" / "30+ yrs" */
  fiDate: string;
  /** e.g. "4 mo earlier" / "no change" / "—" */
  fiDelta: string;
  fiColor: string;
  /** Signed net-worth delta at the horizon vs the source scenario, e.g. "+$1.2M" */
  nwDelta: string;
  nwColor: string;
  /** Label for the horizon year, e.g. "Net worth ’55" */
  nwLabel: string;
  /** Create the scenario: an offshoot of the active one with this tweak applied. */
  build: () => void;
}

export function useScenarioSuggestions(livePrices: LivePrices): Suggestion[] {
  const { config, scenarios, activeScenarioId, snapshot, addScenarioFromConfig } = useFinancialStore();

  // Offshoots riff off the scenario you're currently in.
  const baseUnlinked = useMemo(
    () => scenarios.find((x) => x.id === activeScenarioId)?.unlinked ?? [],
    [scenarios, activeScenarioId],
  );

  const liveGoogPrice = (livePrices["GOOG"] ?? livePrices["GOOGL"])?.price ?? 0;
  const enrichedSnapshot = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map((inv) => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  const ideas = useMemo<Idea[]>(() => {
    const cp = config.career_path;
    const spend = config.spending.monthly_lifestyle;
    const ret = config.market_assumptions.market_return_rate;
    const salary = config.income_profile.gross_annual_salary;
    const trimmed = Math.round(spend * 0.85);
    const thisYear = new Date().getFullYear();

    const list: Idea[] = [
      { title: "Retire 1 year earlier", unlink: [], apply: (c) => { c.career_path.exit_year -= 1; } },
      { title: "Retire 1 year later",   unlink: [], apply: (c) => { c.career_path.exit_year += 1; } },
      {
        title: "Take a sabbatical", unlink: [], when: () => !cp.use_sabbatical,
        apply: (c) => { c.career_path.use_sabbatical = true; c.career_path.sabbatical_duration = 1; },
      },
      {
        title: "Change careers", unlink: ["income_profile.jump_gross_annual", "income_profile.jump_bonus_rate"],
        when: () => !cp.use_jump,
        apply: (c) => {
          c.career_path.use_jump = true;
          c.career_path.jump_duration = 5;
          c.income_profile.jump_gross_annual = Math.round(salary * 0.7);
          c.income_profile.jump_bonus_rate = 5;
        },
      },
      {
        title: `Trim spending to ${fmtK(trimmed)}/mo`, unlink: ["spending.monthly_lifestyle"],
        when: () => trimmed < spend,
        apply: (c) => { c.spending.monthly_lifestyle = trimmed; },
      },
      {
        title: "Buy a second home", unlink: ["life_events", "spending.monthly_lifestyle"],
        apply: (c) => {
          c.life_events = [...(c.life_events ?? []), { name: "Second home", year: thisYear + 3, cost: 250_000, auto: false }];
          c.spending.monthly_lifestyle += 1_200; // carrying costs (taxes, upkeep, insurance)
        },
      },
      {
        title: "Markets cool to 6%", unlink: ["market_assumptions.market_return_rate"],
        when: () => ret > 6,
        apply: (c) => { c.market_assumptions.market_return_rate = 6; },
      },
      {
        title: "Markets heat up to 10%", unlink: ["market_assumptions.market_return_rate"],
        when: () => ret < 10,
        apply: (c) => { c.market_assumptions.market_return_rate = 10; },
      },
      {
        title: "Move to a no-tax state", unlink: ["tax_assumptions.state_of_residence"],
        when: () => !NO_TAX_STATES.has(config.tax_assumptions.state_of_residence),
        apply: (c) => { c.tax_assumptions.state_of_residence = "FL"; },
      },
    ];
    return list.filter((i) => !i.when || i.when(config));
  }, [config]);

  return useMemo(() => {
    const nwLabel = `Net worth ’${String(new Date().getFullYear() + 30).slice(2)}`;
    const baseTraj = runSimulation(enrichedSnapshot, config, liveGoogPrice);
    const baseFi = continuousFiMonth(baseTraj);
    const baseFinal = baseTraj[baseTraj.length - 1]?.totalNetWorth ?? 0;

    return ideas.map((idea) => {
      const tweaked = structuredClone(config);
      idea.apply(tweaked);
      const traj = runSimulation(enrichedSnapshot, tweaked, liveGoogPrice);
      const fi = continuousFiMonth(traj);
      const finalNW = traj[traj.length - 1]?.totalNetWorth ?? 0;

      const dMonths = baseFi != null && fi != null ? Math.round(baseFi - fi) : null;
      const earlier = (dMonths ?? 0) > 0;
      const dMoney = finalNW - baseFinal;

      return {
        title: idea.title,
        fiDate: fi != null ? fmtDate(fiMonthToDate(fi)) : "30+ yrs",
        fiDelta: dMonths == null ? "—" : dMonths === 0 ? "no change" : `${Math.abs(dMonths)} mo ${earlier ? "earlier" : "later"}`,
        fiColor: dMonths == null || dMonths === 0 ? C.inkFaint : earlier ? C.tealDark : C.warm,
        nwDelta: Math.abs(dMoney) < 1000 ? "≈ same" : signM(dMoney),
        nwColor: Math.abs(dMoney) < 1000 ? C.inkSoft : dMoney > 0 ? C.tealDark : C.warm,
        nwLabel,
        build: () => addScenarioFromConfig(idea.title, tweaked, [...baseUnlinked, ...idea.unlink]),
      };
    });
  }, [ideas, config, enrichedSnapshot, liveGoogPrice, baseUnlinked, addScenarioFromConfig]);
}

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
/** Human duration from a month count, e.g. 14 → "1y 2m", 8 → "8mo". */
const fmtDur = (months: number) => {
  const a = Math.abs(months);
  const y = Math.floor(a / 12), mo = a % 12;
  if (y && mo) return `${y}y ${mo}m`;
  if (y) return `${y}y`;
  return `${mo}mo`;
};

const NO_TAX_STATES = new Set(["AK", "FL", "NH", "NV", "SD", "TN", "TX", "WA", "WY", "NONE"]);

/** A what-if applied to a cloned config, plus the baseline paths it forks. */
interface Idea {
  title: string;
  /** Plain-language summary of exactly what this changes (shown on the card). */
  detail: string;
  apply: (cfg: SimulationConfiguration) => void;
  /** Shared-baseline leaf paths this idea overrides (so the offshoot stays linked elsewhere). */
  unlink: string[];
  /** Only offer the idea when it actually differs from the current scenario. */
  when?: (cfg: SimulationConfiguration) => boolean;
}

export interface Suggestion {
  title: string;
  /** Plain-language summary of what the idea changes. */
  detail: string;
  /** The "time" axis of the trade-off — freedom reached sooner/later, e.g.
   * "1y 2m sooner" / "8mo later" / "no change". */
  timeDelta: string;
  /** Evocative life-hours framing of the time axis, e.g. "10,200 hrs reclaimed". */
  timeHours: string;
  timeColor: string;
  /** The "money" axis — net-worth trade-off at the horizon, e.g. "−$420k". */
  nwDelta: string;
  nwColor: string;
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
    const exit = cp.exit_year;
    const trimmed = Math.round(spend * 0.85);
    const passionSalary = Math.round(salary * 0.7);
    const bridgeSalary = Math.round(salary * 0.4);
    const thisYear = new Date().getFullYear();

    const list: Idea[] = [
      { title: "Reclaim a year", detail: `Leave a year earlier — exit ${exit - 1}`, unlink: [], apply: (c) => { c.career_path.exit_year -= 1; } },
      { title: "Trade a year for security", detail: `Work one more year — exit ${exit + 1}`, unlink: [], apply: (c) => { c.career_path.exit_year += 1; } },
      {
        title: "Take a gap year to travel", detail: "A 1-year sabbatical + $40k of travel, then a bridge role back to work",
        unlink: ["life_events", "income_profile.bridge_gross_annual"], when: () => !cp.use_sabbatical,
        apply: (c) => {
          c.career_path.use_sabbatical = true;
          c.career_path.sabbatical_duration = 1;
          c.life_events = [...(c.life_events ?? []), { name: "Gap-year travel", year: thisYear + 1, cost: 40_000, auto: false }];
          // A sabbatical returns to work, not straight to retirement — ease back
          // in with a bridge role unless a jump/bridge is already modeled.
          if (!c.career_path.use_jump && !c.career_path.use_bridge) {
            c.career_path.use_bridge = true;
            c.career_path.bridge_duration = 3;
            c.income_profile.bridge_gross_annual = bridgeSalary;
          }
        },
      },
      {
        title: "Follow your passion", detail: `Switch to an encore career at ~${fmtK(passionSalary)}/yr for 5 years`,
        unlink: ["income_profile.jump_gross_annual", "income_profile.jump_bonus_rate"],
        when: () => !cp.use_jump,
        apply: (c) => {
          c.career_path.use_jump = true;
          c.career_path.jump_duration = 5;
          c.income_profile.jump_gross_annual = passionSalary;
          c.income_profile.jump_bonus_rate = 5;
        },
      },
      {
        title: "Take a bridge job", detail: `A 3-year part-time bridge role at ~${fmtK(bridgeSalary)}/yr before fully retiring`,
        unlink: ["income_profile.bridge_gross_annual"],
        when: () => !cp.use_bridge,
        apply: (c) => {
          c.career_path.use_bridge = true;
          c.career_path.bridge_duration = 3;
          c.income_profile.bridge_gross_annual = bridgeSalary;
        },
      },
      {
        title: "Simplify your lifestyle", detail: `Trim spending 15% — to ${fmtK(trimmed)}/mo`, unlink: ["spending.monthly_lifestyle"],
        when: () => trimmed < spend,
        apply: (c) => { c.spending.monthly_lifestyle = trimmed; },
      },
      {
        title: "Buy a vacation cabin", detail: "A $250k purchase in 3 years plus ~$1.2k/mo upkeep", unlink: ["life_events", "spending.monthly_lifestyle"],
        apply: (c) => {
          c.life_events = [...(c.life_events ?? []), { name: "Vacation cabin", year: thisYear + 3, cost: 250_000, auto: false }];
          c.spending.monthly_lifestyle += 1_200; // carrying costs (taxes, upkeep, insurance)
        },
      },
      {
        title: "Relocate somewhere tax-friendly", detail: "Move to a state with no income tax", unlink: ["tax_assumptions.state_of_residence"],
        when: () => !NO_TAX_STATES.has(config.tax_assumptions.state_of_residence),
        apply: (c) => { c.tax_assumptions.state_of_residence = "FL"; },
      },
      {
        title: "Weather a cooler market", detail: "Stress-test with 6% market returns", unlink: ["market_assumptions.market_return_rate"],
        when: () => ret > 6,
        apply: (c) => { c.market_assumptions.market_return_rate = 6; },
      },
      {
        title: "Ride a booming market", detail: "Model a strong run — 10% market returns", unlink: ["market_assumptions.market_return_rate"],
        when: () => ret < 10,
        apply: (c) => { c.market_assumptions.market_return_rate = 10; },
      },
    ];
    // Drop ideas that don't differ from the current scenario, and ones you've
    // already turned into a scenario (built ideas are named after the idea).
    const existingNames = new Set(scenarios.map((s) => s.name));
    return list.filter((i) => (!i.when || i.when(config)) && !existingNames.has(i.title));
  }, [config, scenarios]);

  return useMemo(() => {
    const baseTraj = runSimulation(enrichedSnapshot, config, liveGoogPrice);
    const baseFi = continuousFiMonth(baseTraj);
    const baseFinal = baseTraj[baseTraj.length - 1]?.totalNetWorth ?? 0;

    return ideas.map((idea) => {
      const tweaked = structuredClone(config);
      idea.apply(tweaked);
      const traj = runSimulation(enrichedSnapshot, tweaked, liveGoogPrice);
      const fi = continuousFiMonth(traj);
      const finalNW = traj[traj.length - 1]?.totalNetWorth ?? 0;

      // The trade-off: TIME (freedom reached sooner/later) vs MONEY (ending
      // net worth). Time is the months your FI date shifts; we also surface it
      // as "hours of life" — every month sooner is ~730 hours back.
      const dMonths = baseFi != null && fi != null ? Math.round(baseFi - fi) : null;
      const earlier = (dMonths ?? 0) > 0;
      const dMoney = finalNW - baseFinal;
      const hours = dMonths ? Math.round((Math.abs(dMonths) * 730.5) / 100) * 100 : 0;

      return {
        title: idea.title,
        detail: idea.detail,
        timeDelta: dMonths == null ? "—" : dMonths === 0 ? "no change" : `${fmtDur(dMonths)} ${earlier ? "sooner" : "later"}`,
        timeHours: dMonths && hours ? `${hours.toLocaleString()} hrs ${earlier ? "reclaimed" : "traded"}` : "",
        timeColor: dMonths == null || dMonths === 0 ? C.inkFaint : earlier ? C.tealDark : C.warm,
        nwDelta: Math.abs(dMoney) < 1000 ? "≈ same" : signM(dMoney),
        nwColor: Math.abs(dMoney) < 1000 ? C.inkSoft : dMoney > 0 ? C.tealDark : C.warm,
        build: () => addScenarioFromConfig(idea.title, tweaked, [...baseUnlinked, ...idea.unlink]),
      };
    });
  }, [ideas, config, enrichedSnapshot, liveGoogPrice, baseUnlinked, addScenarioFromConfig]);
}

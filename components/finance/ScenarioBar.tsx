"use client";
/**
 * ScenarioBar — the global scenario builder. Sits as a full-width band just
 * under the countdown strip so switching, creating, and exploring scenarios is
 * a top-level action rather than something buried in the right panel.
 *
 * It folds together two things that used to live apart:
 *   • the scenario switcher (pick / new / duplicate / rename / delete), and
 *   • the "What if…" suggestions — now one-click *builders*. Each chip clones
 *     the active scenario, applies its tweak, names it, and switches to it,
 *     with a live FI-date preview so you can see the impact before committing.
 */
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulation, continuousFiMonth, type SimulationConfiguration } from "@/engine/calculator";
import { C } from "@/config/colors";
import ScenarioSwitcher from "./ScenarioSwitcher";
import type { LivePrices } from "./FinancialDashboard";

const fmtK = (v: number) => `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;

interface Suggestion {
  title: string;
  section: "career_path" | "spending" | "market_assumptions";
  patch: Record<string, number>;
}

export default function ScenarioBar({ livePrices = {} }: { livePrices?: LivePrices }) {
  const { config, snapshot, duplicateScenario, updateNestedConfig } = useFinancialStore();

  const liveGoogPrice = (livePrices["GOOG"] ?? livePrices["GOOGL"])?.price ?? 0;
  const enrichedSnapshot = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map((inv) => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const exit = config.career_path.exit_year;
    const spend = config.spending.monthly_lifestyle;
    const ret = config.market_assumptions.market_return_rate;
    const list: Suggestion[] = [
      { title: `Leave in ${exit - 1}`,          section: "career_path",        patch: { exit_year: exit - 1 } },
      { title: `Work through ${exit + 1}`,       section: "career_path",        patch: { exit_year: exit + 1 } },
      { title: `Spend ${fmtK(Math.max(0, spend - 1000))}/mo`, section: "spending", patch: { monthly_lifestyle: Math.max(0, spend - 1000) } },
      { title: `Markets cool to ${(ret - 2).toFixed(0)}%`, section: "market_assumptions", patch: { market_return_rate: ret - 2 } },
    ];
    return list;
  }, [config]);

  const { baseFi, previews } = useMemo(() => {
    const apply = (s: Suggestion): SimulationConfiguration => ({
      ...config,
      [s.section]: { ...(config[s.section] as object), ...s.patch },
    } as SimulationConfiguration);
    const baseFi = continuousFiMonth(runSimulation(enrichedSnapshot, config, liveGoogPrice));
    const previews = suggestions.map((s) => continuousFiMonth(runSimulation(enrichedSnapshot, apply(s), liveGoogPrice)));
    return { baseFi, previews };
  }, [suggestions, config, enrichedSnapshot, liveGoogPrice]);

  const build = (s: Suggestion) => {
    duplicateScenario(s.title);          // clone active → becomes the new active scenario
    updateNestedConfig(s.section, s.patch); // applies only to the new scenario
  };

  return (
    <div className="px-4 min-[700px]:px-8" style={{ background: C.bgHeader, borderBottom: `1px solid ${C.border}`, paddingTop: 8, paddingBottom: 8 }}>
      <div className="max-w-7xl mx-auto w-full" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <ScenarioSwitcher />

        <div style={{ width: 1, height: 22, background: C.border, flexShrink: 0 }} className="hidden min-[900px]:block" />

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft }}>
            <Sparkles size={13} color={C.teal} /> What if…
          </span>
          {suggestions.map((s, i) => {
            const fi = previews[i];
            const dMonths = baseFi != null && fi != null ? Math.round(baseFi - fi) : null;
            const earlier = (dMonths ?? 0) > 0;
            const delta = dMonths == null ? "—" : dMonths === 0 ? "no change" : `${Math.abs(dMonths)} mo ${earlier ? "earlier" : "later"}`;
            const color = dMonths == null || dMonths === 0 ? C.inkFaint : earlier ? C.tealDark : C.warm;
            return (
              <button
                key={s.title}
                onClick={() => build(s)}
                title={`Create a new scenario: ${s.title}`}
                style={{
                  display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 1,
                  padding: "5px 11px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.bgCard,
                  cursor: "pointer", transition: "all 0.15s", lineHeight: 1.15,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{s.title}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color }}>FI {delta}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

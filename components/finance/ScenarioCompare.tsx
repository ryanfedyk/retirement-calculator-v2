"use client";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { runSimulation, findIndependencePoint, toDisplayDollars } from "@/engine/calculator";
import { C, SCENARIO_PALETTE as PALETTE } from "@/config/colors";
import HorizonZoomButton from "./HorizonZoomButton";
import type { LivePrices } from "./FinancialDashboard";

const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
const yearOf = (date: string) => date.split(" ").pop() ?? date;

/**
 * Overlays every scenario's net-worth trajectory on one chart. The per-scenario
 * legend + FI dates live in the hub's scenario cards (which also toggle line
 * visibility via `hiddenIds`), so this is chart-only to avoid listing scenarios
 * twice.
 */
export default function ScenarioCompare({ livePrices, hiddenIds }: { livePrices: LivePrices; hiddenIds?: Set<string> }) {
  const { scenarios, snapshot } = useFinancialStore();
  const dollarMode = useUIStore((s) => s.dollarMode);
  const liveGoog = livePrices["GOOG"]?.price ?? livePrices["GOOGL"]?.price ?? 0;
  // Horizon zoom, matching the per-scenario charts: focus to age 75 by default,
  // toggle out to 100. All scenarios share a birth year, so one cap fits them all.
  const [ageCap, setAgeCap] = useState<75 | 100>(75);
  const birthYear = scenarios[0]?.config.birth_year || 1985;

  const enriched = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map((inv) => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  const results = useMemo(() => scenarios.map((sc, i) => {
    // Each scenario re-expressed in the global money basis (using its own
    // inflation rate, since plans can differ). FI dates key off a boolean, so
    // they're unaffected by the dollar basis.
    const points = toDisplayDollars(
      runSimulation(enriched, sc.config, liveGoog),
      dollarMode,
      sc.config.market_assumptions.inflation_rate || 0,
    );
    const fi = findIndependencePoint(points);
    return {
      id: sc.id,
      name: sc.name,
      color: PALETTE[i % PALETTE.length],
      points,
      fiDate: fi?.date,
    };
  }), [scenarios, enriched, liveGoog, dollarMode]);

  // All scenarios share birth year + snapshot, so they run the same horizon.
  // Cap the hub chart to the selected age horizon (a chronological prefix, so
  // point indices still line up across scenarios).
  const chartData = useMemo(() => {
    const base = results[0]?.points ?? [];
    const maxYear = birthYear + ageCap;
    const capped = base.filter((p) => {
      const y = Number(String(p.date).split(" ").pop());
      return !y || y <= maxYear;
    });
    return capped.map((p, idx) => {
      const row: Record<string, number | string> = { date: p.date };
      for (const r of results) row[r.id] = r.points[idx]?.totalNetWorth ?? 0;
      return row;
    });
  }, [results, birthYear, ageCap]);

  if (scenarios.length < 2) return null;

  const visible = results.filter((r) => !hiddenIds?.has(r.id));

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 12 }}>
        Scenario comparison
      </div>

      {/* Overlaid net-worth trajectories — zoom magnifier floats bottom-right */}
      <div style={{ position: "relative" }}>
      <HorizonZoomButton ageCap={ageCap} onToggle={() => setAgeCap((a) => (a === 100 ? 75 : 100))} size={30} />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 6, right: 10, bottom: 0, left: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} vertical={false} />
          <XAxis dataKey="date" tickFormatter={yearOf} minTickGap={48} tick={{ fontSize: 10, fill: C.inkFaint }} />
          <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 10, fill: C.inkFaint }} width={48} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }}
            labelFormatter={(l) => String(l)}
            formatter={((value: number, name: string) => {
              const r = results.find((x) => x.id === name);
              return [fmtM(Number(value)), r?.name ?? name];
            }) as never}
          />
          {/* FI markers per visible scenario */}
          {visible.map((r) => r.fiDate ? (
            <ReferenceLine key={`fi-${r.id}`} x={r.fiDate} stroke={r.color} strokeDasharray="4 4" strokeOpacity={0.6} />
          ) : null)}
          {visible.map((r) => (
            <Line key={r.id} type="monotone" dataKey={r.id} name={r.id} stroke={r.color} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 8, textAlign: "center" }}>
        Net worth over time · dashed lines mark each plan’s FI date · toggle plans with the 👁 on each card below
      </div>
    </div>
  );
}

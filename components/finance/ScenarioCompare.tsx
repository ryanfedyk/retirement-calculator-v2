"use client";
import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
import { C } from "@/config/colors";
import type { LivePrices } from "./FinancialDashboard";

const PALETTE = ["#2a7a68", "#d98a3d", "#3a7d9c", "#7a6da8", "#c45b6b", "#5a9e54", "#b8893a", "#4a8d9c"];
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
  const liveGoog = livePrices["GOOG"]?.price ?? livePrices["GOOGL"]?.price ?? 0;

  const enriched = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map((inv) => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  const results = useMemo(() => scenarios.map((sc, i) => {
    const points = runSimulation(enriched, sc.config, liveGoog);
    const fi = findIndependencePoint(points);
    return {
      id: sc.id,
      name: sc.name,
      color: PALETTE[i % PALETTE.length],
      points,
      fiDate: fi?.date,
    };
  }), [scenarios, enriched, liveGoog]);

  // All scenarios share birth year + snapshot, so they run the same horizon.
  const chartData = useMemo(() => {
    const base = results[0]?.points ?? [];
    return base.map((p, idx) => {
      const row: Record<string, number | string> = { date: p.date };
      for (const r of results) row[r.id] = r.points[idx]?.totalNetWorth ?? 0;
      return row;
    });
  }, [results]);

  if (scenarios.length < 2) return null;

  const visible = results.filter((r) => !hiddenIds?.has(r.id));

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 12 }}>
        Scenario comparison
      </div>

      {/* Overlaid net-worth trajectories */}
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
      <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 8, textAlign: "center" }}>
        Net worth over time · dashed lines mark each plan’s FI date · toggle plans with the 👁 on each card below
      </div>
    </div>
  );
}

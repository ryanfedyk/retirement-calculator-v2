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
 * Overlays every scenario's net-worth trajectory on one chart and lays out
 * their FI dates side by side, so you can see at a glance which plan gets you
 * there soonest.
 */
export default function ScenarioCompare({ livePrices }: { livePrices: LivePrices }) {
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
    const fiYear = fi ? Number((fi.date.match(/\d{4}/) || [])[0]) : undefined;
    const birthYear = sc.config.birth_year ?? 1980;
    return {
      id: sc.id,
      name: sc.name,
      color: PALETTE[i % PALETTE.length],
      points,
      fiDate: fi?.date,
      fiYear,
      fiAge: fiYear ? fiYear - birthYear : undefined,
      fiNumber: points[0]?.swrTarget ?? 0,
      finalNW: points[points.length - 1]?.totalNetWorth ?? 0,
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

  // Earliest FI first; off-track plans last.
  const ranked = [...results].sort((a, b) => {
    if (a.fiYear && b.fiYear) return a.fiYear - b.fiYear;
    if (a.fiYear) return -1;
    if (b.fiYear) return 1;
    return 0;
  });

  if (scenarios.length < 2) return null;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 12 }}>
        Scenario comparison
      </div>

      {/* Side-by-side FI dates */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        {ranked.map((r, idx) => (
          <div key={r.id} style={{
            flex: "1 1 150px", minWidth: 140, background: C.bg, border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${r.color}`, borderRadius: 8, padding: "10px 12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              {idx === 0 && r.fiYear && (
                <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 800, letterSpacing: "0.05em", color: "#fff", background: r.color, borderRadius: 4, padding: "1px 5px" }}>SOONEST</span>
              )}
            </div>
            {r.fiYear ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{r.fiYear}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 3 }}>FI at age {r.fiAge} · {fmtM(r.fiNumber)} target</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#a23818", lineHeight: 1.2 }}>Doesn’t reach FI</div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 3 }}>Ends at {fmtM(r.finalNW)}</div>
              </>
            )}
          </div>
        ))}
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
          {/* FI markers per scenario */}
          {results.map((r) => r.fiDate ? (
            <ReferenceLine key={`fi-${r.id}`} x={r.fiDate} stroke={r.color} strokeDasharray="4 4" strokeOpacity={0.6} />
          ) : null)}
          {results.map((r) => (
            <Line key={r.id} type="monotone" dataKey={r.id} name={r.id} stroke={r.color} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 8, textAlign: "center" }}>
        Net worth over time · dashed lines mark each plan’s FI date
      </div>
    </div>
  );
}

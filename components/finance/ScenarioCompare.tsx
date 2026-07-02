"use client";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { runSimulation, findIndependencePoint, toDisplayDollars } from "@/engine/calculator";
import type { TrajectoryPoint } from "@/engine/calculator";
import { C, SCENARIO_PALETTE as PALETTE } from "@/config/colors";
import HorizonZoomButton from "./HorizonZoomButton";
import type { LivePrices } from "./FinancialDashboard";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
const fmt0 = (n: number) => `$${Math.round(n).toLocaleString()}`;
const yearOf = (date: string) => date.split(" ").pop() ?? date;

type Result = {
  id: string;
  name: string;
  color: string;
  points: TrajectoryPoint[];
  fiDate?: string;
  fiIndex: number; // point index of the durable FI crossing (Infinity if never)
};

/** Net worth at the end of a given calendar year (year's last simulated month),
 * or null if that year is outside the horizon. */
function nwAtYear(points: TrajectoryPoint[], year: number): number | null {
  let val: number | null = null;
  for (const p of points) {
    if (Number(String(p.date).split(" ").pop()) === year) val = p.totalNetWorth;
  }
  return val;
}

/** Recharts tooltip that lists scenarios top-to-bottom in the SAME vertical
 * order the lines appear at that x — i.e. highest net worth first — instead of
 * the default dataKey/render order. */
function CompareTooltip({ active, payload, label, results }: {
  active?: boolean; payload?: Array<{ dataKey?: string | number; value?: number; color?: string }>; label?: string | number; results: Result[];
}) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .map((p) => ({ id: String(p.dataKey), value: Number(p.value), color: p.color ?? C.inkFaint }))
    .sort((a, b) => b.value - a.value);
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, boxShadow: "0 4px 14px rgba(0,0,0,0.12)", minWidth: 150 }}>
      <div style={{ fontWeight: 700, color: C.ink, marginBottom: 6 }}>{String(label)}</div>
      {rows.map((r) => {
        const name = results.find((x) => x.id === r.id)?.name ?? r.id;
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "1px 0" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: r.color, flexShrink: 0 }} />
              <span style={{ color: C.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            </span>
            <span style={{ fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{fmtM(r.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Overlays every scenario's net-worth trajectory on one chart, plus a key-metrics
 * comparison table beneath it. The per-scenario legend + line-visibility toggles
 * live in the hub's scenario cards (via `hiddenIds`); the chart and table both
 * respect that visibility so hiding a plan drops its line AND its column.
 */
export default function ScenarioCompare({ livePrices, hiddenIds }: { livePrices: LivePrices; hiddenIds?: Set<string> }) {
  const { scenarios, snapshot } = useFinancialStore();
  const dollarMode = useUIStore((s) => s.dollarMode);
  const liveGoog = livePrices["GOOG"]?.price ?? livePrices["GOOGL"]?.price ?? 0;
  // Horizon zoom, matching the per-scenario charts: focus to age 70 by default,
  // toggle out to 100. All scenarios share a birth year, so one cap fits them all.
  const [ageCap, setAgeCap] = useState<70 | 100>(70);
  const birthYear = scenarios[0]?.config.birth_year || 1985;
  const currentYear = new Date().getFullYear();

  const enriched = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map((inv) => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  const results = useMemo<Result[]>(() => scenarios.map((sc, i) => {
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
      fiIndex: fi ? points.findIndex((p) => p.date === fi.date) : Infinity,
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

  // Key metrics for the comparison table. Each row can flag a "best" direction
  // so the standout scenario is highlighted; `dir: null` rows are neutral facts
  // (a lower FI number or spend isn't inherently "better" — it's a choice).
  type Row = {
    label: string;
    dir: "max" | "min" | null;
    num: (r: Result, cfg: (typeof scenarios)[number]["config"]) => number;
    fmt: (r: Result, cfg: (typeof scenarios)[number]["config"]) => string;
  };
  const rows: Row[] = [
    {
      label: "Leave work", dir: null,
      num: (_r, c) => c.career_path.exit_year * 12 + (c.career_path.exit_month ?? 0),
      fmt: (_r, c) => ((c.career_path.exit_month ?? 0) > 0 ? `${MONTHS[c.career_path.exit_month!]} ${c.career_path.exit_year}` : String(c.career_path.exit_year)),
    },
    {
      label: "FI reached", dir: "min",
      num: (r) => r.fiIndex,
      fmt: (r) => r.fiDate ?? "Not reached",
    },
    {
      label: "Years to FI", dir: "min",
      num: (r) => (r.fiDate ? Math.max(0, Number(yearOf(r.fiDate)) - currentYear) : Infinity),
      fmt: (r) => (r.fiDate ? `${Math.max(0, Number(yearOf(r.fiDate)) - currentYear)} yr` : "—"),
    },
    {
      label: "FI number (today)", dir: null,
      num: (r) => r.points[0]?.swrTarget ?? 0,
      fmt: (r) => fmtM(r.points[0]?.swrTarget ?? 0),
    },
    {
      label: "Net worth at exit", dir: "max",
      num: (r, c) => nwAtYear(r.points, c.career_path.exit_year) ?? 0,
      fmt: (r, c) => { const v = nwAtYear(r.points, c.career_path.exit_year); return v == null ? "—" : fmtM(v); },
    },
    {
      label: "Net worth at 65", dir: "max",
      num: (r) => nwAtYear(r.points, birthYear + 65) ?? 0,
      fmt: (r) => { const v = nwAtYear(r.points, birthYear + 65); return v == null ? "—" : fmtM(v); },
    },
    {
      label: "Net worth at 100", dir: "max",
      num: (r) => r.points[r.points.length - 1]?.totalNetWorth ?? 0,
      fmt: (r) => fmtM(r.points[r.points.length - 1]?.totalNetWorth ?? 0),
    },
    {
      label: "Monthly spend", dir: null,
      num: (_r, c) => c.spending.monthly_lifestyle,
      fmt: (_r, c) => fmt0(c.spending.monthly_lifestyle),
    },
  ];

  const cfgOf = (id: string) => scenarios.find((s) => s.id === id)!.config;

  // The winning scenario id for a directional row (null when there's no
  // meaningful winner — e.g. nobody reaches FI, or a single visible column).
  const bestIdFor = (row: Row): string | null => {
    if (!row.dir || visible.length < 2) return null;
    const vals = visible.map((r) => row.num(r, cfgOf(r.id))).filter((v) => Number.isFinite(v));
    // No winner when nobody qualifies or everyone ties (e.g. all plans run out → all $0).
    if (vals.length === 0 || Math.min(...vals) === Math.max(...vals)) return null;
    let bestId: string | null = null;
    let best = row.dir === "max" ? -Infinity : Infinity;
    for (const r of visible) {
      const v = row.num(r, cfgOf(r.id));
      if (!Number.isFinite(v)) continue;
      if (row.dir === "max" ? v > best : v < best) { best = v; bestId = r.id; }
    }
    return bestId;
  };

  const th: React.CSSProperties = { textAlign: "right", padding: "7px 10px", fontWeight: 700, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { textAlign: "right", padding: "7px 10px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", borderTop: `1px solid ${C.borderSoft}` };

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 12 }}>
        Scenario comparison
      </div>

      {/* Overlaid net-worth trajectories — zoom magnifier floats bottom-right */}
      <div style={{ position: "relative" }}>
      <HorizonZoomButton ageCap={ageCap} onToggle={() => setAgeCap((a) => (a === 100 ? 70 : 100))} size={30} />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 6, right: 10, bottom: 0, left: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} vertical={false} />
          <XAxis dataKey="date" tickFormatter={yearOf} minTickGap={48} tick={{ fontSize: 10, fill: C.inkFaint }} />
          <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 10, fill: C.inkFaint }} width={48} />
          <Tooltip content={<CompareTooltip results={results} />} />
          {/* FI markers per visible scenario */}
          {visible.map((r) => r.fiDate ? (
            <ReferenceLine key={`fi-${r.id}`} x={r.fiDate} stroke={r.color} strokeDasharray="4 4" strokeOpacity={0.6} />
          ) : null)}
          {visible.map((r) => (
            <Line key={r.id} type="monotone" dataKey={r.id} name={r.id} stroke={r.color} strokeWidth={2} dot={false}
              isAnimationActive animationDuration={500} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 8, textAlign: "center" }}>
        Net worth over time · dashed lines mark each plan’s FI date · toggle plans with the 👁 on each card below
      </div>

      {/* Key-metrics comparison table — columns follow the same order as the
          chart lines / scenario cards; horizontally scrollable on narrow screens. */}
      <div style={{ overflowX: "auto", marginTop: 18 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", color: C.inkFaint, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>Metric</th>
              {visible.map((r) => (
                <th key={r.id} style={{ ...th, color: C.ink }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                    <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const bestId = bestIdFor(row);
              return (
                <tr key={row.label}>
                  <td style={{ ...td, textAlign: "left", color: C.inkMid, fontWeight: 600 }}>{row.label}</td>
                  {visible.map((r) => {
                    const isBest = bestId === r.id;
                    return (
                      <td key={r.id} style={{ ...td, color: isBest ? C.teal : C.ink, fontWeight: isBest ? 800 : 500 }}>
                        {row.fmt(r, cfgOf(r.id))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

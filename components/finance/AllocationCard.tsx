"use client";
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { C } from "@/config/colors";
import { portfolioAllocation, type AllocationSlice } from "@/engine/calculator";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";

// Identity colors — one per bucket, assigned by entity (never by rank), so a slice
// keeps its color as values change. The concentrated position is a deliberate warm
// outlier against a cool, distinct set; the whole palette is validated CVD-safe
// (adjacent-pair separation held with the legend + 2px slice gaps as secondary
// encoding). See dataviz validation in the PR.
const SLICE_COLOR: Record<AllocationSlice["key"], string> = {
  concentrated: "#d55e00", // vermillion — the single-stock position
  brokerage:    "#cc79a7", // mauve
  retirement:   "#009e73", // green
  cash:         "#0072b2", // blue
};

function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}
const pctStr = (share: number) => {
  const p = share * 100;
  return `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;
};

export default function AllocationCard({ snapshot, config, liveGoogPrice = 0 }: {
  snapshot: FinancialSnapshot; config: SimulationConfiguration; liveGoogPrice?: number;
}) {
  const { slices, investable, concentration, concentratedSymbol } = useMemo(
    () => portfolioAllocation(snapshot, config, liveGoogPrice),
    [snapshot, config, liveGoogPrice],
  );

  // Order the wedges so the concentrated slice leads, then largest-first — a stable
  // reading order that also keeps like-sized cool slices from sitting adjacent.
  const ordered = useMemo(() => {
    const conc = slices.filter((s) => s.key === "concentrated");
    const rest = slices.filter((s) => s.key !== "concentrated").sort((a, b) => b.value - a.value);
    return [...conc, ...rest];
  }, [slices]);

  if (investable <= 0 || ordered.length === 0) {
    return (
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", flexShrink: 0 }}>
        <CardHeader />
        <p style={{ fontSize: 12, color: C.inkSoft, margin: "14px 0 0" }}>
          Add your holdings, cash and retirement balances in the Scenario plan to see how your portfolio is spread.
        </p>
      </div>
    );
  }

  const hasConcentration = concentration > 0;
  // Calm, constructive framing — no alarm red (a heavy single-stock position is a
  // fact to work down, not a failure). Terracotta when it's a real concentration,
  // teal when the spread already reads healthy.
  const band = concentration >= 0.25
    ? {
        bg: C.warmWash, border: C.warmLight, text: C.warm,
        msg: `${concentratedSymbol} makes up ${pctStr(concentration)} of your investable portfolio. That's a lot riding on one stock — as you diversify, watch this slice ease down while the others grow.`,
      }
    : hasConcentration
    ? {
        bg: C.tealWash, border: C.tealLight, text: C.tealDark,
        msg: `Only ${pctStr(concentration)} sits in ${concentratedSymbol} — a healthy, diversified spread. Keep it here as your holdings grow.`,
      }
    : {
        bg: C.tealWash, border: C.tealLight, text: C.tealDark,
        msg: `No single-stock concentration — your investable assets are spread across brokerage, retirement and cash.`,
      };

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", flexShrink: 0 }}>
      <CardHeader />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", marginTop: 16 }}>
        {/* Donut with a concentration hero in the middle */}
        <div style={{ position: "relative", width: 188, height: 188, flexShrink: 0, margin: "0 auto" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ordered} dataKey="value" nameKey="label"
                innerRadius={62} outerRadius={90} startAngle={90} endAngle={-270}
                paddingAngle={2} stroke={C.bgCard} strokeWidth={2} isAnimationActive={false}
              >
                {ordered.map((s) => <Cell key={s.key} fill={SLICE_COLOR[s.key]} />)}
              </Pie>
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as AllocationSlice;
                  return (
                    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", boxShadow: "0 6px 18px rgba(0,0,0,0.10)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: C.ink }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: SLICE_COLOR[d.key] }} />
                        {d.label}
                      </div>
                      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>
                        {fmtM(d.value)} · {pctStr(d.value / investable)}
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center hero */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            {hasConcentration ? (
              <>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: SLICE_COLOR.concentrated }}>{pctStr(concentration)}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft, marginTop: 5 }}>in {concentratedSymbol}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: C.ink }}>{fmtM(investable)}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft, marginTop: 5 }}>invested</div>
              </>
            )}
          </div>
        </div>

        {/* Breakdown list — the legend + table view (labels & values, not color alone) */}
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 2 }}>
          {ordered.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: SLICE_COLOR[s.key], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{s.label}</div>
                {s.detail && <div style={{ fontSize: 10.5, color: C.inkFaint }}>{s.detail}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{pctStr(s.value / investable)}</div>
                <div style={{ fontSize: 10.5, color: C.inkSoft }}>{fmtM(s.value)}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, fontSize: 11, color: C.inkSoft }}>
            <span>Investable total</span>
            <span style={{ fontWeight: 700, color: C.inkMid }}>{fmtM(investable)}</span>
          </div>
        </div>
      </div>

      {/* Concentration insight — calm, constructive, never alarm-red */}
      <div style={{ marginTop: 16, background: band.bg, border: `1px solid ${band.border}`, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 11.5, color: band.text, lineHeight: 1.5 }}>{band.msg}</div>
      </div>

      <p style={{ fontSize: 10, color: C.inkFaint, margin: "10px 0 0" }}>
        Investable assets only — excludes home equity and 529 college savings. Priced live where available.
      </p>
    </div>
  );
}

function CardHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: C.tealWash, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <PieIcon size={16} color={C.teal} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Portfolio Allocation</div>
        <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 1 }}>How your investable assets are spread</div>
      </div>
    </div>
  );
}

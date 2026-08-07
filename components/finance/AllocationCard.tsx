"use client";
import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { C } from "@/config/colors";
import { portfolioAllocation, type AllocationSlice } from "@/engine/calculator";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";

// Identity colors — one per bucket, assigned by entity (never by rank), so a slice
// keeps its color as values change. The concentrated position is a deliberate warm
// outlier; the rest are a cool, distinct set. The whole palette is validated
// CVD-safe on the hard checks (lightness band, chroma floor, normal-vision ≥15).
// Home equity additionally carries a diagonal HATCH texture (see hatchId) so it's
// distinguishable from cash even under full colour-blindness, where its violet and
// cash's blue collapse together — texture is the secondary encoding there.
export const SLICE_COLOR: Record<AllocationSlice["key"], string> = {
  concentrated: "#d55e00", // vermillion — the single-stock position
  brokerage:    "#cc79a7", // mauve
  retirement:   "#009e73", // green
  cash:         "#0072b2", // blue
  education:    "#56b4e9", // sky
  home:         "#8a4fbf", // violet (hatched)
};
export const HATCHED = new Set<AllocationSlice["key"]>(["home"]);

export function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}
export const pctStr = (share: number) => {
  const p = share * 100;
  return `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;
};

type Mode = "investable" | "total";

// `bare` drops the outer card chrome + icon header so the full view can be
// embedded inside the allocation overlay (bottom sheet / modal), which supplies
// its own surface and title.
export default function AllocationCard({ snapshot, config, liveGoogPrice = 0, bare = false }: {
  snapshot: FinancialSnapshot; config: SimulationConfiguration; liveGoogPrice?: number; bare?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("investable");
  const a = useMemo(() => portfolioAllocation(snapshot, config, liveGoogPrice), [snapshot, config, liveGoogPrice]);

  const hasTotal = a.homeEquity > 0 || a.education > 0 || a.debt > 0;
  const effMode: Mode = hasTotal ? mode : "investable";

  // Build the slice set for the active mode.
  const slices = useMemo<AllocationSlice[]>(() => {
    if (effMode === "investable") return a.slices;
    const extra: AllocationSlice[] = ([
      { key: "home", label: "Home equity", value: a.homeEquity, detail: "Property value less mortgage" },
      { key: "education", label: "529 college savings", value: a.education },
    ] as AllocationSlice[]).filter((s) => s.value > 0);
    return [...a.slices, ...extra];
  }, [effMode, a]);

  // Order the wedges so the concentrated slice leads, then largest-first. Keep the
  // hatched home slice away from cash (their colours collapse under CVD — texture
  // covers it, but non-adjacency keeps it clean for everyone).
  const ordered = useMemo(() => {
    const conc = slices.filter((s) => s.key === "concentrated");
    const rest = slices.filter((s) => s.key !== "concentrated").sort((x, y) => y.value - x.value);
    return [...conc, ...rest];
  }, [slices]);

  const assetTotal = ordered.reduce((s, x) => s + x.value, 0);
  const netWorth = effMode === "total" ? assetTotal - a.debt : assetTotal;
  const concentration = assetTotal > 0 ? a.concentratedValue / assetTotal : 0;
  const hasConcentration = a.concentratedValue > 0;

  if (assetTotal <= 0 || ordered.length === 0) {
    return (
      <div style={bare ? undefined : CARD}>
        {!bare && <CardHeader />}
        <p style={{ fontSize: 12, color: C.inkSoft, margin: bare ? 0 : "14px 0 0" }}>
          Add your holdings, cash and retirement balances in the Scenario plan to see how your portfolio is spread.
        </p>
      </div>
    );
  }

  // Calm, constructive framing — no alarm red. Terracotta when it's a real
  // concentration, teal when the spread already reads healthy.
  const baseLabel = effMode === "total" ? "net worth" : "investable portfolio";
  const band = concentration >= 0.25
    ? { bg: C.warmWash, border: C.warmLight, text: C.warm,
        msg: `${a.concentratedSymbol} makes up ${pctStr(concentration)} of your ${baseLabel}. That's a lot riding on one stock — as you diversify, watch this slice ease down while the others grow.` }
    : hasConcentration
    ? { bg: C.tealWash, border: C.tealLight, text: C.tealDark,
        msg: `Only ${pctStr(concentration)} of your ${baseLabel} sits in ${a.concentratedSymbol} — a healthy, diversified spread. Keep it here as your holdings grow.` }
    : { bg: C.tealWash, border: C.tealLight, text: C.tealDark,
        msg: `No single-stock concentration — your ${baseLabel} is spread across brokerage, retirement and cash.` };

  return (
    <div style={bare ? undefined : CARD}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: bare ? "flex-end" : "space-between", gap: 12, flexWrap: "wrap", minHeight: bare ? 0 : undefined }}>
        {!bare && <CardHeader />}
        {hasTotal && (
          <div style={{ display: "flex", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: 2 }}>
            {(["investable", "total"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                background: effMode === m ? C.teal : "transparent",
                color: effMode === m ? "#fff" : C.inkSoft, transition: "all 0.18s",
              }}>{m === "investable" ? "Investable" : "Total net worth"}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", marginTop: 16 }}>
        {/* Donut with a concentration hero in the middle */}
        <div style={{ position: "relative", width: 188, height: 188, flexShrink: 0, margin: "0 auto" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <pattern id="alloc-hatch-home" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                  <rect width="7" height="7" fill={SLICE_COLOR.home} />
                  <line x1="0" y1="0" x2="0" y2="7" stroke="#ffffff" strokeWidth="2" opacity="0.55" />
                </pattern>
              </defs>
              <Pie
                data={ordered} dataKey="value" nameKey="label"
                innerRadius={62} outerRadius={90} startAngle={90} endAngle={-270}
                paddingAngle={2} stroke={C.bgCard} strokeWidth={2} isAnimationActive={false}
              >
                {ordered.map((s) => <Cell key={s.key} fill={HATCHED.has(s.key) ? "url(#alloc-hatch-home)" : SLICE_COLOR[s.key]} />)}
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
                        {fmtM(d.value)} · {pctStr(d.value / assetTotal)}
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
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft, marginTop: 5 }}>in {a.concentratedSymbol}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1, color: C.ink }}>{fmtM(netWorth)}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft, marginTop: 5 }}>{effMode === "total" ? "net worth" : "invested"}</div>
              </>
            )}
          </div>
        </div>

        {/* Breakdown list — the legend + table view (labels & values, not colour alone) */}
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 2 }}>
          {ordered.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{
                width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                background: SLICE_COLOR[s.key],
                backgroundImage: HATCHED.has(s.key) ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0 1.5px, transparent 1.5px 3.5px)" : undefined,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{s.label}</div>
                {s.detail && <div style={{ fontSize: 10.5, color: C.inkFaint }}>{s.detail}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{pctStr(s.value / assetTotal)}</div>
                <div style={{ fontSize: 10.5, color: C.inkSoft }}>{fmtM(s.value)}</div>
              </div>
            </div>
          ))}
          {/* Totals */}
          {effMode === "total" && a.debt > 0 ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, fontSize: 11, color: C.inkSoft }}>
                <span>Total assets</span><span>{fmtM(assetTotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.inkSoft }}>
                <span>Less consumer debt</span><span>−{fmtM(a.debt)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4, fontSize: 11.5, color: C.inkMid, fontWeight: 700 }}>
                <span>Net worth</span><span>{fmtM(netWorth)}</span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, fontSize: 11, color: C.inkSoft }}>
              <span>{effMode === "total" ? "Net worth" : "Investable total"}</span>
              <span style={{ fontWeight: 700, color: C.inkMid }}>{fmtM(netWorth)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Concentration insight — calm, constructive, never alarm-red */}
      <div style={{ marginTop: 16, background: band.bg, border: `1px solid ${band.border}`, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 11.5, color: band.text, lineHeight: 1.5 }}>{band.msg}</div>
      </div>

      <p style={{ fontSize: 10, color: C.inkFaint, margin: "10px 0 0" }}>
        {effMode === "total"
          ? "Everything you own, less consumer debt. Investments priced live where available."
          : "Investable assets only — excludes home equity and 529 college savings. Priced live where available."}
      </p>
    </div>
  );
}

const CARD: React.CSSProperties = {
  background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", flexShrink: 0,
};

function CardHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: C.tealWash, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <PieIcon size={16} color={C.teal} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Portfolio Allocation</div>
        <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 1 }}>How your assets are spread</div>
      </div>
    </div>
  );
}

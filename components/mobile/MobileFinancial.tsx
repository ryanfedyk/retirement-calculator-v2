"use client";
import { useState, useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from "recharts";
import { AlertTriangle } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
import { getLifeEvents } from "@/lib/horizonUtils";
import { useHorizonProfile } from "@/config/horizonConfig";
import { buildMomentumCards } from "@/components/finance/MotivationWidgets";
import AiAnalysis from "@/components/finance/AiAnalysis";
import PriceTicker from "@/components/finance/PriceTicker";
import ScenarioLevers from "@/components/finance/ScenarioLevers";
import FireMoments from "@/components/fx/FireMoments";
import { isCoastFI } from "@/lib/fire/moments";
import type { LivePrices } from "@/components/finance/FinancialDashboard";

const fmtM = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
};
const fmtFull = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString()}`;

type View = "wealth" | "income" | "expenses";

interface Props {
  livePrices: LivePrices;
  pricesUpdatedAt: Date | null;
  pricesFetching: boolean;
  onRefreshPrices: () => void;
  onOpenConfig: () => void;
}

export default function MobileFinancial({ livePrices, pricesFetching, onRefreshPrices, onOpenConfig }: Props) {
  const { config, snapshot } = useFinancialStore();
  const { children } = useHorizonProfile();
  const [view, setView] = useState<View>("wealth");
  const [ageCap, setAgeCap] = useState<75 | 100>(100);

  const googInfo      = livePrices["GOOG"] ?? livePrices["GOOGL"];
  const liveGoogPrice = googInfo?.price ?? 0;

  const enrichedSnapshot = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map(inv => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  const traj = useMemo(
    () => runSimulation(enrichedSnapshot, config, liveGoogPrice),
    [enrichedSnapshot, config, liveGoogPrice]
  );

  const indep    = findIndependencePoint(traj);
  const today    = traj[0];
  const currentNW = today?.totalNetWorth ?? 0;
  const swrTarget = today?.swrTarget ?? 0;
  const progress  = swrTarget > 0 ? Math.min(100, (currentNW / swrTarget) * 100) : 0;
  const birthYear = config.birth_year ?? 1980;
  const savingsRate = today ? Math.max(0, Math.min(1, 1 - (today.annualExpenseNeed / Math.max(1, today.salaryAndEquityNet)))) : 0;
  const coastFI = isCoastFI({
    investable: today?.investableAssets ?? 0,
    fiNumber: swrTarget,
    realReturn: (config.market_assumptions.market_return_rate - config.market_assumptions.inflation_rate) / 100,
    yearsToRetirement: Math.max(0, 65 - (new Date().getFullYear() - birthYear)),
  });

  // Top metric strip — Financial Independence first, then the momentum cards
  // (Coast FI / Freedom ratio / Years funded), all in one horizontal scroller.
  const metricCards = useMemo(() => {
    const fi = {
      id: "fi", hero: true, tag: "Financial Independence",
      value: indep ? indep.date : "30+ yrs", unit: "",
      blurb: `${fmtM(currentNW)} now · ${Math.round(progress)}% to ${fmtM(swrTarget)}`,
      color: C.teal, pct: progress as number | null,
    };
    const momentum = today
      ? buildMomentumCards(today, config).map((c) => ({ id: c.tag, hero: false, ...c }))
      : [];
    return [fi, ...momentum];
  }, [indep, currentNW, progress, swrTarget, today, config]);

  // Sample yearly (every 12 months) to keep the mobile chart light & legible.
  const chartData = useMemo(() => traj
    .filter((_, i) => i % 6 === 0)
    .map(pt => ({
      date: pt.date,
      totalNetWorth:   pt.totalNetWorth,
      salaryAndEquity: pt.salaryAndEquityNet,
      rentalNet:       pt.rentalIncomeNet,
      socialSecurity:  pt.socialSecurityNet,
      lifestyle:       pt.lifestyleExpense || 0,
      healthcare:      pt.healthcareCost || 0,
      mortgage:        pt.mortgagePayment || 0,
    })), [traj]);

  const cappedChartData = useMemo(() => {
    if (ageCap >= 100) return chartData;
    const maxYear = birthYear + ageCap;
    return chartData.filter(d => { const y = Number(String(d.date).split(" ")[1]); return !y || y <= maxYear; });
  }, [chartData, ageCap, birthYear]);

  const cp = config.career_path;
  const findDate = (pred: (p: typeof traj[number]) => boolean) => traj.find(pred)?.date;
  const retireDate = findDate(p => p.date.includes(String(cp.exit_year)));
  const hasPostPhases = cp.use_sabbatical || cp.use_jump || cp.use_bridge;
  const fullRetireDate = hasPostPhases ? findDate(d => d.currentPhase === "RETIRED") : undefined;

  // Snap a full-resolution trajectory date to the nearest down-sampled chart
  // point so it lines up with the data the tooltip reports while scrubbing.
  const snap = (d?: string): string | undefined => {
    if (!d) return undefined;
    const idx = traj.findIndex(p => p.date === d);
    return idx < 0 ? undefined : chartData[Math.round(idx / 6)]?.date;
  };

  // Milestones live in the flyout (not on the chart). Keyed by snapped chart
  // date → list of milestones revealed when you scrub to that point.
  const milestoneMap: Record<string, { label: string; c: string }[]> = {};
  const addMile = (raw: string | undefined, label: string, c: string) => {
    const s = snap(raw);
    if (!s) return;
    (milestoneMap[s] ||= []).push({ label, c });
  };
  const by = config.birth_year ?? 1980;
  addMile(retireDate, "Career Exit", "#2a7a68");
  if (cp.use_sabbatical) addMile(findDate(d => d.currentPhase === "SABBATICAL"), "Sabbatical begins", "#d98a3d");
  if (cp.use_jump)       addMile(findDate(d => d.currentPhase === "JUMP"),       "Career jump begins", "#2a9d7f");
  if (cp.use_bridge)     addMile(findDate(d => d.currentPhase === "BRIDGE"),     "Bridge job begins", "#3a7d9c");
  if (fullRetireDate)    addMile(fullRetireDate, "Full retirement 🌿", "#7a6da8");
  if (children.length > 0 && config.spending.use_empty_nest !== false && config.spending.empty_nest_year) addMile(findDate(p => p.date.includes(String(config.spending.empty_nest_year))), "Empty nest", C.warm);
  if (snapshot.liabilities.mortgage_balance > 0) addMile(findDate(p => p.date === "Jun 2051"), "Mortgage paid off", "#9bbdb4");
  if (indep) addMile(indep.date, "Financial independence 🎉", "#80c4ae");
  if (config.social_security) addMile(findDate(p => p.date.includes(String(by + config.social_security.start_age))), "Social Security starts", C.warm);
  if (config.medicare)        addMile(findDate(p => p.date.includes(String(by + config.medicare.start_age))),        "Medicare starts", "#9bbdb4");
  for (const ev of config.life_events ?? []) addMile(findDate(p => p.date.includes(String(ev.year))), ev.name, "#b9895e");
  for (const ev of getLifeEvents(undefined, children)) addMile(findDate(p => p.date.includes(String(ev.year))), `${ev.icon} ${ev.childName}: ${ev.shortLabel}`, C.tealDark);

  // KEY milestones also get a light marker on the chart itself (the rest stay
  // flyout-only). Snapped + short-labelled to avoid clutter.
  const keyMarkers = ([
    { x: snap(retireDate), c: "#2a7a68", l: "Exit" },
    cp.use_sabbatical && { x: snap(findDate(d => d.currentPhase === "SABBATICAL")), c: "#d98a3d", l: "Sab" },
    cp.use_jump       && { x: snap(findDate(d => d.currentPhase === "JUMP")),       c: "#2a9d7f", l: "Jump" },
    cp.use_bridge     && { x: snap(findDate(d => d.currentPhase === "BRIDGE")),     c: "#3a7d9c", l: "Bridge" },
    fullRetireDate    && { x: snap(fullRetireDate), c: "#7a6da8", l: "Retire" },
    children.length > 0 && config.spending.use_empty_nest !== false && config.spending.empty_nest_year && { x: snap(findDate(p => p.date.includes(String(config.spending.empty_nest_year)))), c: C.warm, l: "Nest" },
    snapshot.liabilities.mortgage_balance > 0 && { x: snap(findDate(p => p.date === "Jun 2051")), c: "#9bbdb4", l: "Paid" },
    indep && { x: snap(indep.date), c: "#80c4ae", l: "FI" },
  ].filter(Boolean) as { x?: string; c: string; l: string }[]).filter(m => m.x) as { x: string; c: string; l: string }[];

  return (
    <div style={{ padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 16 }}>

      <FireMoments netWorth={currentNW} swrTarget={swrTarget} isIndependent={today?.isIndependent ?? false} savingsRate={savingsRate} coastFI={coastFI} />

      {/* Metric strip — Financial Independence first, then momentum cards, in one
          horizontal scroller. */}
      <div className="no-scrollbar" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4, scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" }}>
        {metricCards.map((c) => (
          <MetricCard key={c.id} {...c} />
        ))}
      </div>

      {/* Scenario levers — summary + quick adjustment; click in for the full editor */}
      <ScenarioLevers onOpenEditor={onOpenConfig} />

      {/* Portfolio price ticker (from the user's holdings) */}
      <PriceTicker
        holdings={snapshot.other_investments}
        livePrices={livePrices}
        concentratedSymbol={config.use_equity_comp ? config.concentrated_symbol : ""}
        pricesFetching={pricesFetching}
        onRefreshPrices={onRefreshPrices}
        align="start"
      />

      {/* Off-track warning — plan never reaches FI by age 70 */}
      {!indep && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fdece8", border: "2px solid #e0775a", borderRadius: 12, padding: "13px 14px" }}>
          <AlertTriangle size={20} color="#c0492b" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#a23818" }}>This plan doesn’t reach retirement</div>
            <div style={{ fontSize: 11, color: "#8a4a38", marginTop: 3, lineHeight: 1.5 }}>
              Assets never reach your FI number by age 70. Adjust your exit year, spending, savings, or returns.
            </div>
          </div>
        </div>
      )}

      {/* Chart card — touchAction pan-y so dragging the chart never scrolls the page sideways */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: "16px 12px 12px", touchAction: "pan-y" }}>
        {/* View pills */}
        <div style={{ display: "flex", gap: 6, padding: "0 4px 14px", justifyContent: "center" }}>
          {(["wealth", "income", "expenses"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: "9px 0", borderRadius: 999, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, textTransform: "capitalize",
              background: view === v ? C.teal : C.tealWash,
              color: view === v ? "white" : C.tealDark, transition: "all 0.18s",
            }}>{v}</button>
          ))}
        </div>

        {/* Age horizon toggle — subtle, in-app */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div style={{ display: "inline-flex", gap: 2, background: C.bg, borderRadius: 7, padding: 2 }}>
            {([75, 100] as const).map(a => (
              <button key={a} onClick={() => setAgeCap(a)} style={{
                fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 5, border: "none", cursor: "pointer",
                background: ageCap === a ? C.bgCard : "transparent", color: ageCap === a ? C.ink : C.inkFaint,
                boxShadow: ageCap === a ? `0 1px 2px ${C.border}` : "none",
              }}>to {a}</button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={cappedChartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="mWealth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.teal} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.teal} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.borderSoft} />
            <XAxis dataKey="date" tick={{ fill: C.inkFaint, fontSize: 9 }} axisLine={false} tickLine={false}
              interval="preserveStartEnd" minTickGap={50}
              tickFormatter={(d: string) => d.split(" ")[1] ?? d} />
            <YAxis tick={{ fill: C.inkFaint, fontSize: 9 }} axisLine={false} tickLine={false} width={40} tickFormatter={fmtM} />
            <Tooltip content={<MobileTooltip birthYear={birthYear} perYear={view !== "wealth"} milestones={milestoneMap} />} />

            {view === "wealth" && (
              <>
                {keyMarkers.map((m, i) => (
                  <ReferenceLine key={m.l} x={m.x} stroke={m.c} strokeDasharray="2 3" strokeOpacity={0.5}
                    label={<MileLabel value={m.l} fill={m.c} row={i % 2} />} />
                ))}
                <Area type="monotone" dataKey="totalNetWorth" stroke={C.teal} strokeWidth={2.5} fill="url(#mWealth)" name="Net Worth" />
              </>
            )}
            {view === "income" && (
              <>
                <Area type="monotone" dataKey="salaryAndEquity" stackId="1" stroke={C.teal}  fill={C.teal}  fillOpacity={0.7} name="Salary & Equity" />
                <Area type="monotone" dataKey="rentalNet"       stackId="1" stroke="#4aab92" fill="#4aab92" fillOpacity={0.7} name="Rental" />
                <Area type="monotone" dataKey="socialSecurity"  stackId="1" stroke={C.warm}  fill={C.warm}  fillOpacity={0.7} name="Social Security" />
              </>
            )}
            {view === "expenses" && (
              <>
                <Area type="monotone" dataKey="lifestyle"  stackId="1" stroke={C.teal}    fill={C.teal}    fillOpacity={0.7} name="Lifestyle" />
                <Area type="monotone" dataKey="healthcare" stackId="1" stroke="#c4784e"   fill="#c4784e"   fillOpacity={0.7} name="Healthcare" />
                <Area type="monotone" dataKey="mortgage"   stackId="1" stroke="#9bbdb4"   fill="#9bbdb4"   fillOpacity={0.7} name="Mortgage" />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AI Coach — insight below the chart */}
      <AiAnalysis config={config} snapshot={snapshot} trajectory={traj} />
    </div>
  );
}

// A single metric card in the top scroll strip. `hero` (Financial Independence)
// gets the teal gradient so it still reads as primary while sitting in the row.
function MetricCard({ tag, value, unit, blurb, color, pct, hero }: {
  tag: string; value: string; unit?: string; blurb: string; color: string;
  pct?: number | null; hero?: boolean;
}) {
  const soft = hero ? "rgba(255,255,255,0.85)" : C.inkSoft;
  return (
    <div style={{
      flex: "0 0 auto", width: "80%", maxWidth: 340, scrollSnapAlign: "start",
      background: hero ? `linear-gradient(135deg, ${C.tealDark}, ${C.teal})` : C.bgCard,
      border: hero ? "none" : `1px solid ${C.border}`, borderRadius: 20, padding: "16px 18px",
      minHeight: 150, display: "flex", flexDirection: "column",
      boxShadow: hero ? `0 10px 30px ${C.teal}40` : "none",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: soft }}>{tag}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 30, fontWeight: 300, letterSpacing: "-0.02em", color: hero ? "white" : color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {unit ? <span style={{ fontSize: 12, color: soft }}>{unit}</span> : null}
      </div>
      <div style={{ fontSize: 12, color: hero ? "rgba(255,255,255,0.92)" : C.inkMid, marginTop: 6, lineHeight: 1.5, flex: 1 }}>{blurb}</div>
      {pct != null && (
        <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: hero ? "rgba(255,255,255,0.25)" : C.bg }}>
          <div style={{ height: "100%", borderRadius: 999, background: hero ? "white" : color, width: `${Math.min(100, pct)}%`, transition: "width 0.6s ease" }} />
        </div>
      )}
    </div>
  );
}

// Tiny milestone label for the mobile chart — alternates two rows to reduce overlap.
function MileLabel({ viewBox, value, fill, row = 0 }: any) {
  if (!viewBox) return null;
  const { x } = viewBox;
  const w = value.length * 5.2 + 8;
  const y = 2 + row * 14;
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={12} rx={3} fill={fill} fillOpacity={0.14} />
      <text x={x} y={y + 9} textAnchor="middle" fontSize={8} fontWeight={700} fill={fill}>{value}</text>
    </g>
  );
}

function MobileTooltip({ active, payload, label, birthYear, perYear, milestones }: any) {
  if (!active || !payload?.length) return null;
  const yr = parseInt((label as string).split(" ")[1] ?? "");
  const age = yr && birthYear ? yr - birthYear : null;
  const rows = payload.filter((p: any) => p.value != null && p.value !== 0);
  const total = perYear ? rows.reduce((s: number, p: any) => s + p.value, 0) : null;
  const ms: { label: string; c: string }[] = milestones?.[label] ?? [];
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 11, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxWidth: 220 }}>
      <div style={{ color: C.inkSoft, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
        {label}{age ? ` · Age ${age}` : ""}{perYear ? " · /yr" : ""}
      </div>
      {rows.map((p: any) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 2 }}>
          <span style={{ color: p.color ?? C.inkSoft }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{fmtFull(p.value)}</span>
        </div>
      ))}
      {total != null && rows.length > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginTop: 4, paddingTop: 4, borderTop: `1px solid ${C.borderSoft}` }}>
          <span style={{ color: C.inkSoft, fontWeight: 700 }}>Total</span>
          <span style={{ fontWeight: 700, color: C.ink }}>{fmtFull(total)}</span>
        </div>
      )}
      {ms.length > 0 && (
        <div style={{ marginTop: rows.length ? 7 : 0, paddingTop: rows.length ? 7 : 0, borderTop: rows.length ? `1px solid ${C.borderSoft}` : "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {ms.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.c, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: C.ink }}>{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

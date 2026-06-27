"use client";
import { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { Flag, CheckCircle, CalendarDays, Sparkles, AlertTriangle, X, Wallet, Plus } from "lucide-react";
import HorizonZoomButton from "./HorizonZoomButton";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { runSimulation, findIndependencePoint, assessPlan, toDisplayDollars } from "@/engine/calculator";
import type { TrajectoryPoint } from "@/engine/calculator";
import { runMonteCarlo } from "@/engine/montecarlo";
import { MomentumTurnstile } from "./MotivationWidgets";
import AiAnalysis from "./AiAnalysis";
import { C } from "@/config/colors";
import LifeCalendar from "./LifeCalendar";
import type { LivePrices } from "./FinancialDashboard";
import { getLifeEvents } from "@/lib/horizonUtils";
import { useHorizonProfile } from "@/config/horizonConfig";
import ScenarioLevers from "./ScenarioLevers";
import { useScenarioSuggestions } from "@/hooks/useScenarioSuggestions";
import FireMoments from "@/components/fx/FireMoments";
import { isCoastFI, MILESTONES } from "@/lib/fire/moments";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

type ChartView = "wealth" | "income" | "expenses" | "timeline" | "risk";

// ── Reference line pill label ─────────────────────────────────────────────────
// Renders a readable chip with background directly on the chart SVG
const RefLabel = (props: any) => {
  const { viewBox, value, fill, yOffset = 0 } = props;
  if (!viewBox) return null;
  const { x, y } = viewBox;
  const w = value.length * 6.2 + 12;
  const lx = x - w / 2;
  const ly = y + yOffset - 13;
  return (
    <g>
      <rect x={lx} y={ly} width={w} height={16} rx={4}
        fill={fill} fillOpacity={0.15} stroke={fill} strokeOpacity={0.35} strokeWidth={0.8} />
      <text x={x} y={ly + 11} textAnchor="middle"
        fill={fill} fontSize={10} fontWeight={700} fontFamily="ui-sans-serif, system-ui, sans-serif">
        {value}
      </text>
    </g>
  );
};

// ── Summary cards ─────────────────────────────────────────────────────────────

/** A plan notification — funding health or a FIRE milestone — shown in the
 * Alerts card and explained in the info modal. */
/** "Branch this scenario" — diverse offshoots of the current plan (retire a year
 * sooner, take a sabbatical, trim spending…), each previewing the time/money
 * trade-off. Building one creates a real scenario branched from this one. */
function BranchStrip({ livePrices }: { livePrices: LivePrices }) {
  const suggestions = useScenarioSuggestions(livePrices);
  if (!suggestions.length) return null;
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Sparkles size={13} color={C.inkFaint} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint }}>Branch this scenario</span>
        <span style={{ fontSize: 10, color: C.inkFaint }}>· spin off a variation</span>
      </div>
      <div className="no-scrollbar" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {suggestions.map((s, j) => (
          <button
            key={j}
            onClick={s.build}
            title={`Branch a new scenario: ${s.title}`}
            style={{
              flex: "0 0 auto", width: 200, textAlign: "left", display: "flex", flexDirection: "column", gap: 6,
              padding: "11px 13px", borderRadius: 10, border: `1px dashed ${C.border}`, background: "transparent", cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.tealLight; e.currentTarget.style.background = C.bgCard; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: C.inkMid, minWidth: 0 }}>
              <Plus size={13} color={C.inkFaint} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
            </span>
            <span style={{ fontSize: 10.5, color: C.inkSoft, lineHeight: 1.35 }}>{s.detail}</span>
            <div style={{ display: "flex", gap: 14, marginTop: 2 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint }}>Freedom</div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: s.timeColor, fontVariantNumeric: "tabular-nums" }}>{s.timeDelta}</div>
                {s.timeHours && <div style={{ fontSize: 8.5, color: C.inkFaint, whiteSpace: "nowrap" }}>{s.timeHours}</div>}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint }}>Net worth</div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: s.nwColor, fontVariantNumeric: "tabular-nums" }}>{s.nwDelta}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface Notice { id: string; severity: "critical" | "warning" | "good"; title: string; body: string }
const sevColor = (s: Notice["severity"]) => (s === "critical" ? "#c0492b" : s === "warning" ? C.warm : C.tealDark);
const sevBg = (s: Notice["severity"]) => (s === "critical" ? "#fdece8" : s === "warning" ? C.warmWash : C.tealWash);

const SummaryCard = ({
  label, value, sub, icon: Icon, iconBg, iconColor, children, onClick, actionHint,
}: {
  label: string; value: string; sub: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  children?: React.ReactNode;
  /** When set, the whole card becomes a button (used to open Finances). */
  onClick?: () => void;
  /** Tiny affordance label shown by the icon when the card is clickable. */
  actionHint?: string;
}) => {
  // flex: grow to fill the row on wide screens, but never shrink below 240px —
  // so the group becomes a horizontal scroll strip when space is tight.
  const base: React.CSSProperties = { flex: "1 0 240px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110, textAlign: "left", transition: "border-color 0.15s, box-shadow 0.15s" };
  const inner = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.inkFaint, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.02em", color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
        </div>
        <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color={iconColor} />
        </div>
      </div>
      {children ?? <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 8 }}>{sub}</div>}
    </>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        title={actionHint}
        style={{ ...base, cursor: "pointer", font: "inherit" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.boxShadow = `0 1px 3px ${C.border}`; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
      >
        {inner}
      </button>
    );
  }
  return <div style={base}>{inner}</div>;
};

// ── Chart view tab ────────────────────────────────────────────────────────────

const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} style={{
    padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
    background: active ? C.bgCard : "transparent",
    color: active ? C.ink : C.inkSoft,
    fontSize: 11, fontWeight: active ? 600 : 400,
    boxShadow: active ? `0 1px 3px ${C.border}` : "none",
    transition: "all 0.15s",
  }}>{children}</button>
);

// ── Tooltip ───────────────────────────────────────────────────────────────────

const fmtFull = (v: number) =>
  `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString()}`;

const ChartTooltip = ({ active, payload, label, birthYear, perYear }: any) => {
  if (!active || !payload?.length) return null;
  const parts = (label as string).split(" ");
  const yr = parts.length === 2 ? parseInt(parts[1]) : null;
  const age = yr && birthYear ? yr - birthYear : null;

  // For income/expense breakdowns the values are annual flows — show the exact
  // dollar amount with "/yr" so it's unambiguous and easy to read. Net-worth
  // values stay abbreviated ($1.2M) since precision there is noise.
  const rows = payload.filter((p: any) => p.value != null && p.value !== 0);
  const total = perYear ? rows.reduce((s: number, p: any) => s + (p.value as number), 0) : null;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ color: C.inkSoft, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}{age ? ` · Age ${age}` : ""}{perYear ? " · per year" : ""}
      </div>
      {rows.map((p: any) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
          <span style={{ color: p.color ?? C.inkSoft }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
            {perYear ? `${fmtFull(p.value as number)}/yr` : fmtM(p.value as number)}
          </span>
        </div>
      ))}
      {total != null && rows.length > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 5, paddingTop: 5, borderTop: `1px solid ${C.borderSoft}` }}>
          <span style={{ color: C.inkSoft, fontWeight: 700 }}>Total</span>
          <span style={{ fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
            {fmtFull(total)}/yr
          </span>
        </div>
      )}
    </div>
  );
};

// Tooltip for the Monte Carlo fan chart: the optimistic/median/pessimistic spread
// of net worth at the hovered point across all simulated return sequences.
const RiskTooltip = ({ active, payload, label, birthYear }: any) => {
  if (!active || !payload?.length) return null;
  const range = payload.find((p: any) => p.dataKey === "range")?.value as [number, number] | undefined;
  const p50 = payload.find((p: any) => p.dataKey === "p50")?.value as number | undefined;
  const yr = parseInt((label as string).split(" ")[1] ?? "");
  const age = yr && birthYear ? yr - birthYear : null;
  const Row = ({ k, v, c }: { k: string; v: number; c: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
      <span style={{ color: c }}>{k}</span>
      <span style={{ fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{fmtM(v)}</span>
    </div>
  );
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
      <div style={{ color: C.inkSoft, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}{age ? ` · Age ${age}` : ""}
      </div>
      {range && <Row k="Optimistic (90th)" v={range[1]} c="#2a7a68" />}
      {p50 != null && <Row k="Median (50th)" v={p50} c={C.teal} />}
      {range && <Row k="Pessimistic (10th)" v={range[0]} c={C.warm} />}
    </div>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  livePrices: LivePrices;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function RightPanel({ livePrices }: Props) {
  const { snapshot, config, profile } = useFinancialStore();
  const dollarMode = useUIStore((s) => s.dollarMode);
  const setPlanPanelOpen = useUIStore((s) => s.setPlanPanelOpen);
  const planPanelOpen = useUIStore((s) => s.planPanelOpen);
  const inflationRate = config.market_assumptions.inflation_rate || 0;
  const dollarBasisLabel = dollarMode === "future" ? "future (nominal) dollars" : "today's dollars";
  const { children } = useHorizonProfile();
  const [chartView, setChartView] = useState<ChartView>("wealth");
  const [insightTab, setInsightTab] = useState<"today" | "ai">("today");
  const [ageCap, setAgeCap] = useState<75 | 100>(75);

  // Year currently hovered on the chart — reveals subtle (secondary) milestones
  const [hoverYear, setHoverYear] = useState<string | null>(null);

  // ── Derive live GOOG price and overall price status ───────────────────────
  const googInfo     = livePrices["GOOG"] ?? livePrices["GOOGL"];
  const liveGoogPrice = googInfo?.price ?? 0;

  // ── Enrich snapshot with live prices for ALL holdings ────────────────────
  // This is what the simulation engine actually sees — never stale.
  const enrichedSnapshot = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map(inv => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  // ── Simulations (all use enriched snapshot) ───────────────────────────────
  const trajectoryData = useMemo(
    () => runSimulation(enrichedSnapshot, config, liveGoogPrice),
    [enrichedSnapshot, config, liveGoogPrice]
  );

  const earlierData = useMemo(() =>
    runSimulation(enrichedSnapshot, { ...config, career_path: { ...config.career_path, exit_year: config.career_path.exit_year - 1 } }, liveGoogPrice),
    [enrichedSnapshot, config, liveGoogPrice]
  );
  const laterData = useMemo(() =>
    runSimulation(enrichedSnapshot, { ...config, career_path: { ...config.career_path, exit_year: config.career_path.exit_year + 1 } }, liveGoogPrice),
    [enrichedSnapshot, config, liveGoogPrice]
  );

  // Key metrics
  const indepPoint     = findIndependencePoint(trajectoryData);
  const plan           = assessPlan(trajectoryData);
  const todayPoint     = trajectoryData[0];
  const currentNW      = todayPoint?.totalNetWorth ?? 0;
  const swrTarget      = todayPoint?.swrTarget ?? 0;
  const progress       = swrTarget > 0 ? Math.min(100, (currentNW / swrTarget) * 100) : 0;
  const birthYear      = config.birth_year ?? 1980;
  // Rough current savings rate (net income that isn't going to needs) for FIRE callouts.
  const savingsRate    = todayPoint ? Math.max(0, Math.min(1, 1 - (todayPoint.annualExpenseNeed / Math.max(1, todayPoint.salaryAndEquityNet)))) : 0;
  // Coast FIRE: current assets compounding at the real return reach FI by 65 with no new contributions.
  const coastFI        = isCoastFI({
    investable: todayPoint?.investableAssets ?? 0,
    fiNumber: swrTarget,
    realReturn: (config.market_assumptions.market_return_rate - config.market_assumptions.inflation_rate) / 100,
    yearsToRetirement: Math.max(0, 65 - (new Date().getFullYear() - birthYear)),
  });

  // ── Notifications ── plan-health status + FIRE milestones, listed in the Alerts
  // card. Copy is word-for-word with the original banners and the celebratory
  // FIRE callouts (MILESTONES), so the Alerts card and those notifications match.
  const isIndependent = todayPoint?.isIndependent ?? false;
  const notices = useMemo<Notice[]>(() => {
    const out: Notice[] = [];
    // Plan-health — verbatim with the original plan-health banners.
    if (plan.health === "shortfall") {
      const age = plan.depletion ? Number((plan.depletion.date.match(/\d{4}/) || [])[0]) - birthYear : null;
      out.push({ id: "shortfall", severity: "critical",
        title: `This plan runs out of money${plan.depletion ? ` around ${plan.depletion.date}` : ""}`,
        body: `${plan.depletion ? `At age ${age}, your invested assets are exhausted and can't cover spending. ` : ""}Try a later exit year, lower monthly spend, higher savings, or stronger returns.` });
    } else if (!indepPoint) {
      out.push({ id: "no-fi", severity: "critical",
        title: "This plan doesn’t reach financial independence",
        body: "Your assets never reach your FI number. Try a later exit year, lower monthly spend, higher savings, or stronger returns — the trajectory below stays under the FI target the whole way." });
    } else if (plan.health === "tight") {
      out.push({ id: "tight", severity: "warning",
        title: "Cutting it close",
        body: "This plan funds your retirement, but the cushion runs thin — a weak market stretch or unplanned expense could push it short. A little more savings or a slightly later exit adds margin." });
    } else {
      out.push({ id: "on-track", severity: "good",
        title: "On track",
        body: "Your plan funds retirement with a healthy cushion." });
    }
    // FIRE milestones — verbatim with the celebratory callouts (FireMoments).
    const metrics = { netWorth: currentNW, swrTarget, isIndependent, savingsRate, coastFI };
    for (const m of MILESTONES) {
      if (m.active(metrics)) out.push({ id: m.id, severity: "good", title: `${m.emoji} ${m.title}`, body: m.sub });
    }
    return out;
  }, [plan.health, plan.depletion, indepPoint, currentNW, swrTarget, isIndependent, coastFI, savingsRate, birthYear]);
  // Tap-to-understand explanation modal for the summary cards.
  const [infoModal, setInfoModal] = useState<{ title: string; node: React.ReactNode } | null>(null);
  const openInfo = (title: string, node: React.ReactNode) => setInfoModal({ title, node });

  // The trajectory re-expressed in the global money basis (today's vs future $).
  // Metrics above read month-0 values (unchanged by inflation), so only the
  // display series — the chart and the timeline tooltip — need conversion.
  const displayTrajectory = useMemo(
    () => toDisplayDollars(trajectoryData, dollarMode, inflationRate),
    [trajectoryData, dollarMode, inflationRate],
  );

  // Chart data
  const chartData = useMemo(() => {
    const traj    = displayTrajectory;
    const earlier = toDisplayDollars(earlierData, dollarMode, inflationRate);
    const later   = toDisplayDollars(laterData,   dollarMode, inflationRate);
    return traj.map((pt, i) => ({
      ...pt,
      earlierNetWorth:  earlier[i]?.totalNetWorth ?? 0,
      laterNetWorth:    later[i]?.totalNetWorth   ?? 0,
      // Use the pre-computed net fields — no subtraction, no negatives
      salaryAndEquity:  pt.salaryAndEquityNet,
      rentalNet:        pt.rentalIncomeNet,
      socialSecurity:   pt.socialSecurityNet,
      lifestyleExpense: pt.lifestyleExpense || 0,
      healthcareCost:   pt.healthcareCost   || 0,
      mortgagePayment:  pt.mortgagePayment  || 0,
    }));
  }, [displayTrajectory, earlierData, laterData, dollarMode, inflationRate]);

  // Trim the trajectory to the selected age horizon (75 = focused, 100 = full).
  const cappedChartData = useMemo(() => {
    if (ageCap >= 100) return chartData;
    const maxYear = birthYear + ageCap;
    return chartData.filter((d) => { const y = Number(String(d.date).split(" ")[1]); return !y || y <= maxYear; });
  }, [chartData, ageCap, birthYear]);

  // ── Monte Carlo (sequence-of-returns risk) ────────────────────────────────
  // Only computed while the Risk view is open — it runs hundreds of full
  // projections (~0.5s), so we don't want it on every keystroke of other tabs.
  const monteCarlo = useMemo(
    () => (chartView === "risk" ? runMonteCarlo(enrichedSnapshot, config, liveGoogPrice, { runs: 400 }) : null),
    [chartView, enrichedSnapshot, config, liveGoogPrice]
  );
  // Band data for the fan chart: [p10,p90] range area + p50 median line, capped
  // to the selected age horizon. `range` is a tuple so recharts draws a band.
  const riskChartData = useMemo(() => {
    if (!monteCarlo) return [];
    const maxYear = ageCap >= 100 ? Infinity : birthYear + ageCap;
    const annual = 1 + inflationRate / 100;
    const infl = (v: number, monthIndex: number) =>
      dollarMode === "future" && inflationRate ? v * Math.pow(annual, monthIndex / 12) : v;
    return monteCarlo.bands
      .filter((b) => { const y = Number(String(b.date).split(" ")[1]); return !y || y <= maxYear; })
      .map((b) => ({
        date: b.date,
        p50: infl(b.p50, b.monthIndex),
        range: [infl(b.p10, b.monthIndex), infl(b.p90, b.monthIndex)] as [number, number],
      }));
  }, [monteCarlo, ageCap, birthYear, dollarMode, inflationRate]);
  const successPct = monteCarlo ? Math.round(monteCarlo.successRate * 100) : null;
  const successColor = successPct == null ? C.inkSoft : successPct >= 85 ? "#2a7a68" : successPct >= 70 ? C.warm : "#c0492b";

  // Reference lines for phases / milestones
  const findDate = (pred: (p: TrajectoryPoint) => boolean) => trajectoryData.find(pred)?.date;

  const retireDateStr  = findDate(p => p.date.includes(String(config.career_path.exit_year)));
  const sabbDateStr    = trajectoryData.some(d => d.currentPhase === "SABBATICAL") ? findDate(d => d.currentPhase === "SABBATICAL") : null;
  const jumpDateStr    = trajectoryData.some(d => d.currentPhase === "JUMP")       ? findDate(d => d.currentPhase === "JUMP")       : null;
  const bridgeDateStr  = trajectoryData.some(d => d.currentPhase === "BRIDGE")     ? findDate(d => d.currentPhase === "BRIDGE")     : null;
  // When any post-Google phase is modeled, mark the date the user reaches FULL
  // retirement (after sabbatical / jump / bridge all end).
  const cpx = config.career_path;
  const hasPostPhases  = cpx.use_sabbatical || cpx.use_jump || cpx.use_bridge;
  const fullRetireDateStr = hasPostPhases ? findDate(d => d.currentPhase === "RETIRED") : null;
  const ssDateStr      = config.social_security ? findDate(p => p.date.includes(String(birthYear + config.social_security!.start_age))) : null;
  const medDateStr     = config.medicare        ? findDate(p => p.date.includes(String(birthYear + config.medicare!.start_age)))        : null;
  const mortgageDateStr = snapshot.liabilities.mortgage_balance > 0 ? findDate(p => p.date === "Jun 2051") : null;
  const enDateStr      = (children.length > 0 && config.spending.use_empty_nest !== false && config.spending.empty_nest_year) ? findDate(p => p.date.includes(String(config.spending.empty_nest_year))) : null;

  // Compact label for a life event ("Oona — College Year 1" → "🎓 Oona Yr1")
  const lifeEventLabel = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("college")) {
      const child = name.split("—")[0].trim().split(" ")[0];
      const yr    = (name.match(/year\s*(\d)/i) || [])[1];
      return `🎓 ${child}${yr ? ` Yr${yr}` : ""}`;
    }
    if (lower.includes("renov")) return "🏠 Reno";
    if (lower.includes("wedding")) return "💍";
    return name.length > 12 ? name.slice(0, 12) + "…" : name;
  };

  const yearOf = (dateStr: string) => dateStr.split(" ")[1] ?? dateStr;

  // Milestone model: `primary` ones are always visible; `secondary` ones render
  // subtly (faint line, no pill) until the user hovers over that year on the chart.
  type Milestone = { x: string; stroke: string; label: string; primary: boolean };

  const milestones: Milestone[] = (() => {
    const m: Milestone[] = [];
    // Primary — the headline financial milestones
    if (retireDateStr)   m.push({ x: retireDateStr,   stroke: "#2a7a68", label: hasPostPhases ? "Career Exit" : "Retire", primary: true  });
    if (indepPoint)      m.push({ x: indepPoint.date, stroke: "#80c4ae", label: "FI",         primary: true  });
    if (mortgageDateStr) m.push({ x: mortgageDateStr, stroke: "#9bbdb4", label: "Paid Off",   primary: true  });
    if (enDateStr)       m.push({ x: enDateStr,       stroke: C.warm,    label: "Empty Nest", primary: true  });
    // Career-phase transitions — prominent (always visible), since they're the
    // core levers of the retirement model.
    if (sabbDateStr)     m.push({ x: sabbDateStr,     stroke: "#d98a3d", label: "Sabbatical", primary: true  });
    if (jumpDateStr)     m.push({ x: jumpDateStr,     stroke: "#2a9d7f", label: "Career Jump",primary: true  });
    if (bridgeDateStr)   m.push({ x: bridgeDateStr,   stroke: "#3a7d9c", label: "Bridge Job", primary: true  });
    if (fullRetireDateStr) m.push({ x: fullRetireDateStr, stroke: "#7a6da8", label: "Full Retirement", primary: true });
    // Secondary — benefits and life events (subtle until hovered)
    if (ssDateStr)       m.push({ x: ssDateStr,       stroke: C.warm,    label: "Soc. Sec.",  primary: false });
    if (medDateStr)      m.push({ x: medDateStr,      stroke: "#9bbdb4", label: "Medicare",   primary: false });
    // Life events from config (college years, renovation, …)
    for (const ev of config.life_events ?? []) {
      const x = findDate(p => p.date.includes(String(ev.year)));
      if (x) m.push({ x, stroke: "#b9895e", label: lifeEventLabel(ev.name), primary: false });
    }
    // Pre-retirement kids' milestones — same source the forecasting tab uses,
    // so both views stay in sync for the pre-2030 window.
    for (const ev of getLifeEvents(undefined, children)) {
      const x = findDate(p => p.date.includes(String(ev.year)));
      if (x) m.push({ x, stroke: C.tealLight, label: `${ev.icon} ${ev.childName}`, primary: false });
    }
    return m;
  })();

  // Stagger pill labels by chronological position so neighbouring markers land
  // on different rows (prevents clustered pills like Retire/Full Retirement from
  // overlapping). Build an order index from each milestone's spot in the timeline.
  const dateOrder = (x: string) => trajectoryData.findIndex(p => p.date === x);
  const orderRank = new Map(
    [...milestones].sort((a, b) => dateOrder(a.x) - dateOrder(b.x)).map((m, idx) => [m.x + m.label, idx])
  );

  const renderRefLines = () => (
    <>
      {milestones.map(({ x, stroke, label, primary }) => {
        const revealed = primary || yearOf(x) === hoverYear;
        const yOffset  = ((orderRank.get(x + label) ?? 0) % 4) * 20;
        return (
          <ReferenceLine
            key={`${label}-${x}`}
            x={x}
            stroke={stroke}
            strokeDasharray="3 3"
            strokeWidth={revealed ? 1.3 : 1}
            strokeOpacity={revealed ? 0.75 : 0.18}
            label={revealed ? <RefLabel value={label} fill={stroke} yOffset={yOffset} /> : undefined}
          />
        );
      })}
    </>
  );

  return (
    <main style={{ flex: 1, background: C.bg, padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

      <FireMoments netWorth={currentNW} swrTarget={swrTarget} isIndependent={todayPoint?.isIndependent ?? false} savingsRate={savingsRate} coastFI={coastFI} />

      {/* ── Scenario levers — the headline interaction ── */}
      {/* The "Edit full plan" affordance opens the side panel; hide it while the
          panel is already open to avoid a redundant control. */}
      <ScenarioLevers onOpenEditor={planPanelOpen ? undefined : () => setPlanPanelOpen(true)} />

      {/* ── Branch this scenario — ideas that offshoot the current plan ── */}
      <BranchStrip livePrices={livePrices} />

      {/* ── Summary cards: FI date · FI Number · Alerts ── A horizontal scroll
          strip when tight. Top-aligned so the Alerts list can run as long as it
          needs without stretching the others. */}
      <div className="no-scrollbar" style={{ display: "flex", flexShrink: 0, alignItems: "flex-start", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
        <SummaryCard
          label="Financial Independence"
          value={indepPoint ? indepPoint.date : "30+ Yrs"}
          sub={indepPoint ? "Projected date you reach FI" : "Adjust strategy to reach FI"}
          icon={Flag}
          iconBg={indepPoint ? C.tealWash : C.borderSoft}
          iconColor={indepPoint ? C.teal : C.inkFaint}
          actionHint="What does this mean?"
          onClick={() => openInfo("Financial Independence", (
            <>
              <p style={{ margin: 0 }}>The date your investments are projected to durably cover your spending — when your investable assets reach your FI number (25× annual expenses) and stay there. From that point on, paid work becomes optional.</p>
              {indepPoint && <p style={{ margin: "10px 0 0" }}>For this scenario that’s <strong>{indepPoint.date}</strong>.</p>}
            </>
          ))}
        />
        <SummaryCard
          label="FI Number"
          value={`$${(swrTarget / 1_000_000).toFixed(2)}M`}
          sub=""
          icon={CheckCircle}
          iconBg={C.tealWash}
          iconColor={C.teal}
          actionHint="What does this mean?"
          onClick={() => openInfo("FI Number", (
            <>
              <p style={{ margin: 0 }}>Your <strong>FI number</strong> is 25× your annual expenses (net of rental income &amp; Social Security) — the nest egg that sustains a 4% withdrawal rate. For this scenario that’s <strong>${(swrTarget / 1_000_000).toFixed(2)}M</strong>.</p>
              <p style={{ margin: "10px 0 0" }}>You’re <strong>{progress.toFixed(0)}%</strong> of the way there — <strong>${(currentNW / 1_000_000).toFixed(2)}M</strong> today.</p>
              <button onClick={() => { setInfoModal(null); useUIStore.getState().setFinancesOpen(true); }}
                style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: C.teal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <Wallet size={15} /> Open your finances
              </button>
            </>
          ))}
        >
          {/* Progress lives under the FI number — the bar plus where you are now. */}
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 4, borderRadius: 99, background: C.borderSoft }}>
              <div style={{ height: "100%", borderRadius: 99, background: C.teal, width: `${progress}%`, transition: "width 0.8s ease" }} />
            </div>
            <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 4 }}>
              {progress.toFixed(0)}% there · ${(currentNW / 1_000_000).toFixed(2)}M today
            </div>
          </div>
        </SummaryCard>

        {/* Alerts — every active notification, in full: plan health + each FIRE
            milestone, word-for-word with the banners/callouts they come from. */}
        {notices.length > 0 && (
          <div style={{
            flex: "1 0 260px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: "14px 18px", maxHeight: 320, overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.inkFaint }}>Alerts</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.inkFaint, background: C.bg, borderRadius: 99, padding: "1px 6px" }}>{notices.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {notices.map((n) => (
                <div key={n.id} style={{ display: "flex", gap: 9 }}>
                  <span style={{ flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: 6, background: sevBg(n.severity), display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {n.severity === "good" ? <CheckCircle size={12} color={sevColor(n.severity)} /> : <AlertTriangle size={12} color={sevColor(n.severity)} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: sevColor(n.severity), lineHeight: 1.3 }}>{n.title}</div>
                    <div style={{ fontSize: 11.5, color: C.inkMid, lineHeight: 1.5, marginTop: 2 }}>{n.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tap-to-understand explanation modal for the summary cards. */}
      {infoModal && (
        <div onClick={() => setInfoModal(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,30,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.bgCard, borderRadius: 14, maxWidth: 440, width: "100%", padding: "22px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.ink, margin: 0 }}>{infoModal.title}</h3>
              <button onClick={() => setInfoModal(null)} aria-label="Close" style={{ flexShrink: 0, display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 2 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>{infoModal.node}</div>
          </div>
        </div>
      )}

      {/* ── Main chart (the hero) ── */}
      {/* flexShrink:0 — the panel is a fixed-height flex column that scrolls; without
          this, flexbox squeezes the card shorter than its fixed-height inner chart,
          so the graph spills up over the summary cards. */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
        display: "flex", flexDirection: "column", flexShrink: 0,
        height: chartView === "timeline" ? 580 : 536,
        transition: "height 0.3s ease",
      }}>
        {/* Chart header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {chartView === "timeline" ? "Life & Career Timeline" :
               chartView === "income"   ? "Income Breakdown" :
               chartView === "expenses" ? "Expense Breakdown" :
               chartView === "risk"     ? (
                 <span>
                   <span style={{ color: successColor, fontWeight: 700 }}>{successPct ?? "—"}%</span>
                   <span style={{ fontWeight: 600 }}> fund this plan to age {ageCap}</span>
                 </span>
               ) :
               "Wealth Trajectory"}
            </div>
            <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {chartView === "timeline" ? "Month-by-month phases & milestones" :
               chartView === "risk"     ? `Median & 10th–90th percentile across ${monteCarlo?.runs ?? 0} return paths · ${dollarBasisLabel}` :
               `Projection to age ${ageCap} · in ${dollarBasisLabel}`}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 3, gap: 2 }}>
              {(["wealth", "income", "expenses"] as ChartView[]).map(v => (
                <TabBtn key={v} active={chartView === v} onClick={() => setChartView(v)}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </TabBtn>
              ))}
              <TabBtn active={chartView === "risk"} onClick={() => setChartView("risk")}>Risk</TabBtn>
              <div style={{ width: 1, background: C.border, margin: "4px 2px" }} />
              <TabBtn active={chartView === "timeline"} onClick={() => setChartView("timeline")}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <CalendarDays size={11} /> Timeline
                </span>
              </TabBtn>
            </div>
          </div>
        </div>

        {/* Chart body */}
        <div style={{ position: "relative", flex: 1, padding: "8px 20px 16px", minHeight: 0, overflow: "hidden" }}>
          {/* Horizon zoom — floats in the chart's bottom-right (not for the
              calendar timeline, which has no age horizon to cap). */}
          {chartView !== "timeline" && (
            <HorizonZoomButton ageCap={ageCap} onToggle={() => setAgeCap((a) => (a === 100 ? 75 : 100))} />
          )}
          {chartView === "timeline" ? (
            <LifeCalendar data={displayTrajectory} config={config} />
          ) : chartView === "risk" ? (
            <ResponsiveContainer width="100%" height={446}>
              <AreaChart data={riskChartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.teal} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={C.teal} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.borderSoft} />
                <XAxis dataKey="date" axisLine={false} tickLine={false}
                  tick={{ fill: C.inkFaint, fontSize: 10 }} minTickGap={32} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: C.inkFaint, fontSize: 10 }}
                  tickFormatter={fmtM} width={52} domain={[0, "auto"]} />
                <Tooltip content={<RiskTooltip birthYear={birthYear} />} />
                <Area type="monotone" dataKey="range" stroke="none" fill="url(#riskBand)" name="10th–90th percentile" isAnimationActive={false} />
                <Line type="monotone" dataKey="p50" stroke={C.teal} strokeWidth={2.5} dot={false} name="Median" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={446}>
              <AreaChart data={cappedChartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
                onMouseMove={(s: any) => { if (s?.activeLabel) setHoverYear(yearOf(String(s.activeLabel))); }}
                onMouseLeave={() => setHoverYear(null)}>
                <defs>
                  <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.teal} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.teal} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="salaryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.teal}  stopOpacity={0.8} />
                    <stop offset="95%" stopColor={C.teal}  stopOpacity={0.3} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.borderSoft} />
                <XAxis dataKey="date" axisLine={false} tickLine={false}
                  tick={{ fill: C.inkFaint, fontSize: 10 }} minTickGap={32} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fill: C.inkFaint, fontSize: 10 }}
                  tickFormatter={fmtM} width={52}
                  domain={chartView === "wealth" ? ["auto", "auto"] : [0, "auto"]} />
                <Tooltip content={<ChartTooltip birthYear={birthYear} perYear={chartView === "income" || chartView === "expenses"} />} />

                {chartView === "wealth" && (
                  <>
                    <Area type="monotone" dataKey="totalNetWorth" stroke={C.teal} strokeWidth={2.5}
                      fill="url(#wealthGrad)" name="Active Strategy" />
                    <Line type="monotone" dataKey="earlierNetWorth" stroke={C.warm} strokeWidth={1.5}
                      strokeDasharray="4 4" dot={false} name="Exit 1yr Early" />
                    <Line type="monotone" dataKey="laterNetWorth" stroke="#3a7d9c" strokeWidth={1.5}
                      strokeDasharray="4 4" dot={false} name="Exit 1yr Late" />
                    {renderRefLines()}
                  </>
                )}

                {chartView === "income" && (
                  <>
                    <Area type="monotone" dataKey="salaryAndEquity" stackId="1" stroke={C.teal}    fill={C.teal}    fillOpacity={0.7} name="Salary & Equity" />
                    <Area type="monotone" dataKey="rentalNet"       stackId="1" stroke="#4aab92"   fill="#4aab92"   fillOpacity={0.7} name="Rental Income" />
                    <Area type="monotone" dataKey="socialSecurity"  stackId="1" stroke={C.warm}    fill={C.warm}    fillOpacity={0.7} name="Social Security" />
                  </>
                )}

                {chartView === "expenses" && (
                  <>
                    <Area type="monotone" dataKey="lifestyleExpense" stackId="1" stroke={C.teal}    fill={C.teal}    fillOpacity={0.7} name="Lifestyle" />
                    <Area type="monotone" dataKey="healthcareCost"   stackId="1" stroke="#c4784e"   fill="#c4784e"   fillOpacity={0.7} name="Healthcare" />
                    <Area type="monotone" dataKey="mortgagePayment"  stackId="1" stroke="#9bbdb4"   fill="#9bbdb4"   fillOpacity={0.7} name="Mortgage" />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Career phase legend ── */}
      {chartView === "wealth" && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "Active Strategy",  color: C.teal,    dash: false },
            { label: "Exit 1yr Early",   color: C.warm,    dash: true  },
            { label: "Exit 1yr Late",    color: "#3a7d9c", dash: true  },
            { label: hasPostPhases ? "Career Exit" : "Retire", color: "#2a7a68", dash: true  },
            ...(hasPostPhases ? [{ label: "Full Retirement", color: "#7a6da8", dash: true }] : []),
            { label: "FI",              color: "#80c4ae", dash: true  },
            { label: "Mortgage Free",    color: C.inkFaint, dash: true },
          ].map(({ label, color, dash }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.inkSoft }}>
              <div style={{ width: 20, height: 2, background: color, opacity: dash ? 0.8 : 1, borderRadius: 1,
                backgroundImage: dash ? `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)` : undefined }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* ── Insights — progressive disclosure below the hero chart ── */}
      <div style={{ display: "flex", gap: 6, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, alignSelf: "flex-start" }}>
        {([["today", "Today"], ["ai", "AI Coach"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setInsightTab(id)} style={{
            padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            background: insightTab === id ? C.teal : "transparent",
            color: insightTab === id ? "white" : C.inkSoft, transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {insightTab === "today" && todayPoint && (
        <MomentumTurnstile point={todayPoint} config={config} trajectory={trajectoryData} birthDate={profile.birthDate} />
      )}

      {/* ── AI Analysis ── */}
      {insightTab === "ai" && (
        <AiAnalysis config={config} snapshot={snapshot} trajectory={trajectoryData} />
      )}
    </main>
  );
}

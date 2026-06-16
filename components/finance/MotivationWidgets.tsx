"use client";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { C } from "@/config/colors";
import { runSimulation, continuousFiMonth, type TrajectoryPoint, type FinancialSnapshot, type SimulationConfiguration } from "@/engine/calculator";

const fmtM = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
};
const fiMonthToDate = (m: number) => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + Math.round(m), 1);
};
const fmtDate = (d: Date) => d.toLocaleString("default", { month: "short", year: "numeric" });

// ── 1. Today's Delta ──────────────────────────────────────────────────────────
// Compares against a baseline snapshot persisted in localStorage; the baseline
// rolls forward when it's >1h old, so "since last visit" stays meaningful.
interface Baseline { ts: number; fiMonth: number | null; netWorth: number; googPrice: number; }

export function TodaysDelta({ trajectory, snapshot, googPrice }: {
  trajectory: TrajectoryPoint[]; snapshot: FinancialSnapshot; googPrice: number;
}) {
  const netWorth = trajectory[0]?.totalNetWorth ?? 0;
  const fiMonth  = useMemo(() => continuousFiMonth(trajectory) ?? null, [trajectory]);
  const googShares = useMemo(() =>
    (snapshot.other_investments ?? [])
      .filter(i => i.symbol === "GOOG" || i.symbol === "GOOGL")
      .reduce((s, i) => s + i.shares, 0) + (snapshot.share_counts?.google_shares ?? 0),
  [snapshot]);

  const [delta, setDelta] = useState<{ nw: number; goog: number; googImpact: number; fiDays: number | null } | null>(null);

  useEffect(() => {
    if (!googPrice || !trajectory.length) return;
    const KEY = "horizon-delta-baseline";
    let base: Baseline | null = null;
    try { base = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* ignore */ }

    if (base && base.googPrice > 0) {
      const fiDays = base.fiMonth != null && fiMonth != null ? (base.fiMonth - fiMonth) * 30.44 : null;
      setDelta({
        nw: netWorth - base.netWorth,
        goog: googPrice - base.googPrice,
        googImpact: googShares * (googPrice - base.googPrice),
        fiDays,
      });
    }
    // Roll the baseline forward once it's stale (or on first run).
    if (!base || Date.now() - base.ts > 3_600_000) {
      const next: Baseline = { ts: Date.now(), fiMonth, netWorth, googPrice };
      localStorage.setItem(KEY, JSON.stringify(next));
    }
  }, [googPrice, netWorth, fiMonth, googShares, trajectory.length]);

  const up = (delta?.nw ?? 0) >= 0;
  return (
    <div style={{
      background: `linear-gradient(120deg, ${C.bgCard}, ${C.tealWash})`,
      border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
    }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.inkSoft }}>
          Since your last visit
        </div>
        {delta ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 3 }}>
            <span style={{ fontSize: 22, fontWeight: 300, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
              {up ? "+" : "−"}{fmtM(Math.abs(delta.nw))}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: up ? C.tealDark : C.warm }}>
              {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />} net worth
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: C.inkMid, marginTop: 4 }}>Tracking from today — check back tomorrow ✨</div>
        )}
      </div>

      {delta && (
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint }}>GOOG</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
              {delta.goog >= 0 ? "▲" : "▼"} ${Math.abs(delta.goog).toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: C.inkSoft }}>{delta.googImpact >= 0 ? "+" : "−"}{fmtM(Math.abs(delta.googImpact))} to you</div>
          </div>
          {delta.fiDays != null && Math.abs(delta.fiDays) >= 1 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint }}>FI Date</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: delta.fiDays >= 0 ? C.tealDark : C.warm }}>
                {Math.abs(Math.round(delta.fiDays))} days {delta.fiDays >= 0 ? "earlier" : "later"}
              </div>
              <div style={{ fontSize: 10, color: C.inkSoft }}>thanks to the move</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 2. Momentum turnstile ─────────────────────────────────────────────────────
export function MomentumTurnstile({ point, config }: { point: TrajectoryPoint; config: SimulationConfiguration }) {
  const [idx, setIdx] = useState(0);
  const cards = useMemo(() => buildMomentumCards(point, config), [point, config]);

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % cards.length), 6000);
    return () => clearInterval(id);
  }, [cards.length]);

  const card = cards[idx];
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", minHeight: 192, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.inkSoft }}>{card.tag}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setIdx(i => (i - 1 + cards.length) % cards.length)} style={navBtn}><ChevronLeft size={14} color={C.inkSoft} /></button>
          <button onClick={() => setIdx(i => (i + 1) % cards.length)} style={navBtn}><ChevronRight size={14} color={C.inkSoft} /></button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 30, fontWeight: 300, color: card.color, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{card.value}</span>
        <span style={{ fontSize: 13, color: C.inkMid }}>{card.unit}</span>
      </div>
      <p style={{ fontSize: 13, color: C.inkMid, marginTop: 6, lineHeight: 1.5, minHeight: 58 }}>{card.blurb}</p>

      {card.pct != null && (
        <div style={{ marginTop: "auto", height: 6, borderRadius: 99, background: C.bg }}>
          <div style={{ height: "100%", borderRadius: 99, background: card.color, width: `${Math.min(100, card.pct)}%`, transition: "width 0.6s ease" }} />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14 }}>
        {cards.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)} style={{
            width: i === idx ? 18 : 6, height: 6, borderRadius: 99, border: "none", cursor: "pointer",
            background: i === idx ? C.teal : C.border, transition: "all 0.25s",
          }} />
        ))}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: "50%", border: `1px solid ${C.border}`,
  background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};

function buildMomentumCards(point: TrajectoryPoint, config: SimulationConfiguration) {
  const investable = point.investableAssets;
  const fiTarget   = point.swrTarget;
  const expenses   = point.annualExpenseNeed;
  const passive    = point.annualPassiveIncome;
  const thisYear   = new Date().getFullYear();
  const currentAge = thisYear - (config.birth_year ?? 1980);

  // Coast FI — assets grow at real return with NO further contributions.
  const realReturn = Math.max(0.005, (config.market_assumptions.market_return_rate - config.market_assumptions.inflation_rate) / 100);
  const reachedCoast = investable >= fiTarget;
  const coastYears = reachedCoast ? 0 : Math.log(fiTarget / Math.max(1, investable)) / Math.log(1 + realReturn);
  const coastYear = thisYear + Math.ceil(coastYears);

  const freedomPct = expenses > 0 ? (passive / expenses) * 100 : 0;
  const yearsFunded = expenses > 0 ? investable / expenses : 0;

  return [
    {
      tag: "Coast FI",
      value: reachedCoast ? "Reached" : String(coastYear),
      unit: reachedCoast ? "🌿" : `· age ${currentAge + Math.ceil(coastYears)}`,
      blurb: reachedCoast
        ? "Your invested assets alone will grow into your FI number — you could stop contributing today."
        : `If you stopped saving today, growth alone gets you to FI by ${coastYear}.`,
      color: C.tealDark, pct: reachedCoast ? 100 : Math.min(100, (investable / fiTarget) * 100),
    },
    {
      tag: "Freedom ratio",
      value: `${Math.round(freedomPct)}%`,
      unit: "of expenses covered",
      blurb: "Share of your living costs already covered by passive income (rental + Social Security) — no portfolio withdrawals needed.",
      color: C.teal, pct: freedomPct,
    },
    {
      tag: "Years of freedom funded",
      value: yearsFunded.toFixed(1),
      unit: "years banked",
      blurb: `Your investable assets could cover ${yearsFunded.toFixed(1)} years of expenses outright — before any growth or income.`,
      color: "#7a6da8", pct: Math.min(100, (yearsFunded / 25) * 100),
    },
  ];
}

// ── 3. What-if scenario cards ─────────────────────────────────────────────────
const fmtK = (v: number) => `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
const signM = (v: number) => `${v >= 0 ? "+" : "−"}${fmtM(Math.abs(v))}`;

export function WhatIfChips({ snapshot, config, liveGoogPrice }: {
  snapshot: FinancialSnapshot; config: SimulationConfiguration; liveGoogPrice: number;
}) {
  const endYear = new Date().getFullYear() + 30;

  const scenarios = useMemo(() => {
    const exit  = config.career_path.exit_year;
    const spend = config.spending.monthly_lifestyle;
    const ret   = config.market_assumptions.market_return_rate;
    return [
      {
        title: `Work through ${exit + 1}`,
        sub: "one more year before you leave",
        apply: (c: SimulationConfiguration) => ({ ...c, career_path: { ...c.career_path, exit_year: exit + 1 } }),
      },
      {
        title: `Leave in ${exit - 1}`,
        sub: "retire a year sooner",
        apply: (c: SimulationConfiguration) => ({ ...c, career_path: { ...c.career_path, exit_year: exit - 1 } }),
      },
      {
        title: `Spend ${fmtK(Math.max(0, spend - 1000))}/mo`,
        sub: `trim $1k from ${fmtK(spend)}`,
        apply: (c: SimulationConfiguration) => ({ ...c, spending: { ...c.spending, monthly_lifestyle: Math.max(0, spend - 1000) } }),
      },
      {
        title: `Markets cool to ${(ret - 2).toFixed(0)}%`,
        sub: `vs your ${ret.toFixed(0)}% assumption`,
        apply: (c: SimulationConfiguration) => ({ ...c, market_assumptions: { ...c.market_assumptions, market_return_rate: ret - 2 } }),
      },
    ];
  }, [config]);

  const { base, results } = useMemo(() => {
    const baseTraj = runSimulation(snapshot, config, liveGoogPrice);
    const baseFi = continuousFiMonth(baseTraj);
    const baseFinal = baseTraj[baseTraj.length - 1]?.totalNetWorth ?? 0;
    const results = scenarios.map(s => {
      const t = runSimulation(snapshot, s.apply(config), liveGoogPrice);
      return {
        ...s,
        fiMonth: continuousFiMonth(t),
        finalNetWorth: t[t.length - 1]?.totalNetWorth ?? 0,
      };
    });
    return { base: { fiMonth: baseFi, finalNetWorth: baseFinal }, results };
  }, [scenarios, snapshot, config, liveGoogPrice]);

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Sparkles size={14} color={C.teal} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkSoft }}>What if…</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {results.map(r => {
          const dMonths = base.fiMonth != null && r.fiMonth != null ? Math.round(base.fiMonth - r.fiMonth) : null;
          const dMoney  = r.finalNetWorth - base.finalNetWorth;
          const earlier = (dMonths ?? 0) > 0;
          const fiLabel = r.fiMonth != null ? fmtDate(fiMonthToDate(r.fiMonth)) : "30+ yrs";
          const fiDelta = dMonths == null ? "—" : dMonths === 0 ? "same FI date" : `${Math.abs(dMonths)} mo ${earlier ? "earlier" : "later"}`;
          const fiColor = dMonths == null || dMonths === 0 ? C.inkSoft : earlier ? C.tealDark : C.warm;
          const moneyColor = Math.abs(dMoney) < 1000 ? C.inkSoft : dMoney > 0 ? C.tealDark : C.warm;
          return (
            <div key={r.title} style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.bg }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{r.title}</div>
              <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 12 }}>{r.sub}</div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint }}>Net worth ’{String(endYear).slice(2)}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: moneyColor, fontVariantNumeric: "tabular-nums" }}>{signM(dMoney)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint }}>FI date</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{fiLabel}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: fiColor }}>{fiDelta}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

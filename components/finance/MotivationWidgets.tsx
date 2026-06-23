"use client";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { C } from "@/config/colors";
import { continuousFiMonth, type TrajectoryPoint, type FinancialSnapshot, type SimulationConfiguration } from "@/engine/calculator";

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
interface Baseline { ts: number; fiMonth: number | null; netWorth: number; price: number; }

export function TodaysDelta({ trajectory, snapshot, symbol = "", price }: {
  trajectory: TrajectoryPoint[]; snapshot: FinancialSnapshot; symbol?: string; price: number;
}) {
  const sym = symbol.toUpperCase();
  const netWorth = trajectory[0]?.totalNetWorth ?? 0;
  const fiMonth  = useMemo(() => continuousFiMonth(trajectory) ?? null, [trajectory]);
  const concShares = useMemo(() =>
    sym === "" ? 0 :
    (snapshot.other_investments ?? [])
      .filter(i => i.symbol?.toUpperCase() === sym)
      .reduce((s, i) => s + i.shares, 0) + (sym === "GOOG" ? (snapshot.share_counts?.google_shares ?? 0) : 0),
  [snapshot, sym]);

  const [delta, setDelta] = useState<{ nw: number; move: number; impact: number; fiDays: number | null } | null>(null);

  useEffect(() => {
    if (!netWorth || !trajectory.length) return;
    const KEY = "horizon-delta-baseline";
    let base: Baseline | null = null;
    try { base = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* ignore */ }

    if (base && base.netWorth > 0) {
      const fiDays = base.fiMonth != null && fiMonth != null ? (base.fiMonth - fiMonth) * 30.44 : null;
      setDelta({
        nw: netWorth - base.netWorth,
        move: price - (base.price ?? price),
        impact: concShares * (price - (base.price ?? price)),
        fiDays,
      });
    }
    // Roll the baseline forward once it's stale (or on first run).
    if (!base || Date.now() - base.ts > 3_600_000) {
      const next: Baseline = { ts: Date.now(), fiMonth, netWorth, price };
      localStorage.setItem(KEY, JSON.stringify(next));
    }
  }, [price, netWorth, fiMonth, concShares, trajectory.length]);

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
          {sym && concShares > 0 && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint }}>{sym}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
              {delta.move >= 0 ? "▲" : "▼"} ${Math.abs(delta.move).toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: C.inkSoft }}>{delta.impact >= 0 ? "+" : "−"}{fmtM(Math.abs(delta.impact))} to you</div>
          </div>
          )}
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

// Same momentum metrics, but as separate cards you swipe through horizontally
// (one-at-a-time scroll snap with a peek of the next). Used on mobile.
export function MomentumCards({ point, config }: { point: TrajectoryPoint; config: SimulationConfiguration }) {
  const cards = useMemo(() => buildMomentumCards(point, config), [point, config]);
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
      {cards.map(card => (
        <div key={card.tag} style={{
          flexShrink: 0, width: "82%", scrollSnapAlign: "start",
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px",
          minHeight: 176, display: "flex", flexDirection: "column",
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.inkSoft }}>{card.tag}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 300, color: card.color, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{card.value}</span>
            <span style={{ fontSize: 13, color: C.inkMid }}>{card.unit}</span>
          </div>
          <p style={{ fontSize: 13, color: C.inkMid, marginTop: 6, lineHeight: 1.5 }}>{card.blurb}</p>
          {card.pct != null && (
            <div style={{ marginTop: "auto", height: 6, borderRadius: 99, background: C.bg }}>
              <div style={{ height: "100%", borderRadius: 99, background: card.color, width: `${Math.min(100, card.pct)}%`, transition: "width 0.6s ease" }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

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

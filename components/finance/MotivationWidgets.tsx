"use client";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { C } from "@/config/colors";
import { continuousFiMonth, type TrajectoryPoint, type FinancialSnapshot, type SimulationConfiguration } from "@/engine/calculator";
import { monthOfISO, dayOfISO, ageFromISO } from "@/config/sharedConfig";

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

// Same momentum metrics, but as separate cards you swipe through horizontally
// (one-at-a-time scroll snap with a peek of the next). Used on mobile.
export function MomentumCards({ point, config, trajectory, birthDate }: { point: TrajectoryPoint; config: SimulationConfiguration; trajectory?: TrajectoryPoint[]; birthDate?: string }) {
  const cards = useMemo(() => buildMomentumCards(point, config, trajectory, birthDate), [point, config, trajectory, birthDate]);
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

// Same momentum metrics laid out as a responsive grid of individual cards that
// reflow with the screen width (no carousel) — the desktop "Today" view.
export function MomentumGrid({ point, config, trajectory, birthDate }: { point: TrajectoryPoint; config: SimulationConfiguration; trajectory?: TrajectoryPoint[]; birthDate?: string }) {
  const cards = useMemo(() => buildMomentumCards(point, config, trajectory, birthDate), [point, config, trajectory, birthDate]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, width: "100%" }}>
      {cards.map(card => (
        <div key={card.tag} style={{
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "15px 16px",
          display: "flex", flexDirection: "column",
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.inkSoft }}>{card.tag}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 300, color: card.color, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{card.value}</span>
            <span style={{ fontSize: 12, color: C.inkMid }}>{card.unit}</span>
          </div>
          <p style={{ fontSize: 12.5, color: C.inkMid, marginTop: 6, lineHeight: 1.5, flex: 1 }}>{card.blurb}</p>
          {card.pct != null && (
            <div style={{ marginTop: 12, height: 6, borderRadius: 99, background: C.bg }}>
              <div style={{ height: "100%", borderRadius: 99, background: card.color, width: `${Math.min(100, card.pct)}%`, transition: "width 0.6s ease" }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function buildMomentumCards(point: TrajectoryPoint, config: SimulationConfiguration, trajectory?: TrajectoryPoint[], birthDate?: string) {
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

  const cards: { tag: string; value: string; unit: string; blurb: string; color: string; pct: number | null }[] = [
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

  // A delightful birthday fact — what your projected net worth looks like on
  // your next birthday. Needs the full trajectory (monthly points) + birthday.
  if (trajectory?.length && birthDate) {
    const now = new Date();
    const next = new Date(now.getFullYear(), monthOfISO(birthDate), dayOfISO(birthDate));
    if (next <= now) next.setFullYear(next.getFullYear() + 1);
    const monthsAway = (next.getFullYear() - now.getFullYear()) * 12 + (next.getMonth() - now.getMonth());
    const pt = trajectory[Math.min(Math.max(0, monthsAway), trajectory.length - 1)];
    if (pt) {
      const turning = ageFromISO(birthDate, next);
      cards.unshift({
        tag: "Next birthday",
        value: fmtM(pt.totalNetWorth),
        unit: `at ${turning} 🎂`,
        blurb: `On your birthday in ${next.getFullYear()}, your projected net worth is about ${fmtM(pt.totalNetWorth)} — a year of compounding, captured.`,
        color: C.tealDark, pct: null,
      });
    }
  }

  return cards;
}

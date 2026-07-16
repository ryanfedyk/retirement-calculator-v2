"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { C } from "@/config/colors";
import { HORIZON_CONFIG } from "@/config/horizonConfig";
import { useFinancialStore } from "@/store/useFinancialStore";

// The conventional full-retirement benchmark we measure "reclaimed" prime years
// against, and the far horizon of the river.
const BENCHMARK_AGE = 65;
const HORIZON_AGE   = 90;
const WEEKS = 52;
const VW = 1000, VH = 200; // SVG viewBox

const LIFE_USES = [
  { label: "weekends with people you love", icon: "👨‍👩‍👧‍👧", weeksDiv: 1 / 2 },
  { label: "summers in your prime",          icon: "☀️", weeksDiv: 52 },
  { label: "slow-travel trips (2 wks each)",  icon: "🌍", weeksDiv: 2 },
  { label: "mornings that are yours",         icon: "🌅", weeksDiv: 1 / 7 },
];

/**
 * Reclaimed Time — an organic "river of time". The stream runs from today to age
 * 90; it's narrow and grey while you're working, then widens into a calm teal
 * current the moment you step away. Drag anywhere on the river to move your exit
 * and watch the free water grow. A rotating mantra anchors the hero.
 */
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ReclaimedTimeCalculator() {
  const { config, updateNestedConfig } = useFinancialStore();
  const planHistory = useFinancialStore((s) => s.planHistory);
  const nowYear    = new Date().getFullYear();
  const nowMonth   = new Date().getMonth(); // 0-based
  const birthYear  = config.birth_year || nowYear - 40;
  const currentAge = Math.max(18, nowYear - birthYear);
  const exitYear   = config.career_path.exit_year;
  const exitAge    = Math.max(currentAge, Math.min(HORIZON_AGE, exitYear - birthYear));
  const span       = Math.max(1, HORIZON_AGE - currentAge);
  const exitFrac   = (exitAge - currentAge) / span;

  // ── Progress toward your exit, since you started planning ──────────────────
  // Anchored to the first monthly plan-history snapshot (when you began
  // tracking); fills as the calendar closes on your chosen exit. Recomputes live
  // as you drag the exit, so pulling it upstream visibly advances your progress.
  const todayFY    = nowYear + nowMonth / 12;
  const firstYm    = planHistory[0]?.ym;
  const planStartFY = useMemo(() => {
    if (!firstYm) return todayFY;
    const [y, m] = firstYm.split("-").map(Number);
    return y + (Math.max(1, m) - 1) / 12;
  }, [firstYm, todayFY]);
  const exitFY     = exitYear + Math.min(11, Math.max(0, config.career_path.exit_month ?? 0)) / 12;
  const exited     = exitFY <= todayFY;
  const journey    = exitFY - planStartFY;
  const progress   = exited ? 1 : journey > 0 ? Math.max(0, Math.min(1, (todayFY - planStartFY) / journey)) : 0;
  const monthsToGo = Math.max(0, Math.round((exitFY - todayFY) * 12));
  const planStartLabel = firstYm ? `${MON3[(Number(firstYm.split("-")[1]) || 1) - 1]} ${firstYm.split("-")[0]}` : null;

  // Rotating mantra in the hero for a living feel.
  const mantras = HORIZON_CONFIG.mantras;
  const [mantraIdx, setMantraIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMantraIdx((i) => (i + 1) % mantras.length), 7000);
    return () => clearInterval(id);
  }, [mantras.length]);

  const stats = useMemo(() => {
    const primeYears = Math.max(0, BENCHMARK_AGE - exitAge);
    return { primeYears, primeWeeks: primeYears * WEEKS };
  }, [exitAge]);

  // ── Drag-to-set-exit on the river ──────────────────────────────────────────
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const setFromClientX = (clientX: number) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const age = currentAge + frac * span;
    const yr = Math.round(birthYear + age);
    const clamped = Math.max(nowYear, Math.min(birthYear + 70, yr));
    if (clamped !== exitYear) updateNestedConfig("career_path", { exit_year: clamped });
  };

  // ── River geometry (recomputed as the exit moves, so it reshapes live) ──────
  const exitX = exitFrac * VW;
  const path = useMemo(() => {
    const N = 60;
    const ramp = (x: number) => 1 / (1 + Math.exp(-(x - exitX) / 55)); // 0 work → 1 free
    const top: string[] = [], bot: string[] = [];
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * VW;
      const r = ramp(x);
      const thick = 22 + 96 * r;
      const amp = 4 + 16 * r;
      const center = VH / 2 + amp * Math.sin(x / 115 + 0.6);
      top.push(`${x.toFixed(1)},${(center - thick / 2).toFixed(1)}`);
      bot.push(`${x.toFixed(1)},${(center + thick / 2).toFixed(1)}`);
    }
    return `M ${top.join(" L ")} L ${bot.reverse().join(" L ")} Z`;
  }, [exitX]);

  // A couple of "current" lines drifting through the free water.
  const currents = useMemo(() => {
    return [0.62, 0.5, 0.38].map((t) => {
      const pts: string[] = [];
      for (let i = 0; i <= 40; i++) {
        const x = exitX + (i / 40) * (VW - exitX);
        const y = VH * t + 10 * Math.sin(x / 90 + t * 6);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return `M ${pts.join(" L ")}`;
    });
  }, [exitX]);

  return (
    <div>
      {/* ── Hero: rotating mantra + headline ── */}
      <div className="mb-8 p-7 rounded-2xl" style={{ background: C.tealWash, border: `1px solid ${C.tealLight}` }}>
        <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-3">Reclaimed Time</p>
        <p key={mantraIdx} style={{ color: C.ink, animation: "fadeIn 0.8s ease" }} className="text-xl md:text-2xl font-light leading-relaxed italic">
          &ldquo;{mantras[mantraIdx]}&rdquo;
        </p>
        <div className="mt-6 flex items-end gap-3 flex-wrap">
          <span style={{ color: C.tealDark }} className="text-5xl font-extralight tabular-nums leading-none">{stats.primeYears}</span>
          <span style={{ color: C.inkMid }} className="text-sm mb-1">
            {stats.primeYears === 1 ? "year" : "years"} of your <strong>prime</strong> reclaimed by leaving at {exitYear}, not {BENCHMARK_AGE}
            {stats.primeYears === 0 && " — pull your exit upstream to free some water"}
          </span>
        </div>
      </div>

      {/* ── Progress toward your exit — how far you've come since you started
          planning; the filled portion is time already behind you. ── */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest">
            {exited ? "You've reached your exit" : `Progress to your ${exitYear} exit`}
          </p>
          <span style={{ color: C.tealDark }} className="text-sm font-semibold tabular-nums">{Math.round(progress * 100)}%</span>
        </div>
        <div style={{ position: "relative", height: 12, borderRadius: 999, background: C.borderSoft, overflow: "visible" }}>
          <div style={{
            position: "absolute", inset: 0, width: `${progress * 100}%`, borderRadius: 999,
            background: `linear-gradient(90deg, ${C.tealLight}, ${C.teal})`,
            transition: "width 0.25s ease", minWidth: progress > 0 ? 4 : 0,
          }} />
          {/* "Today" marker at the leading edge of the filled portion */}
          {!exited && (
            <div style={{ position: "absolute", top: -3, bottom: -3, left: `${progress * 100}%`, width: 2, transform: "translateX(-1px)", background: C.tealDark, borderRadius: 2, transition: "left 0.25s ease" }} />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 mt-2">
          <span style={{ color: C.inkSoft }} className="text-[11px]">
            {planStartLabel ? <>Since <strong style={{ color: C.inkMid }}>{planStartLabel}</strong>, when you started planning</> : <>Your countdown begins — this fills as you approach {exitYear}</>}
          </span>
          {!exited && (
            <span style={{ color: C.inkSoft }} className="text-[11px] tabular-nums whitespace-nowrap">
              {monthsToGo === 0 ? "this month" : monthsToGo < 24 ? `${monthsToGo} mo to go` : `${Math.round(monthsToGo / 12)} yr to go`}
            </span>
          )}
        </div>
      </div>

      {/* ── The river ── */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest">Your river of time — drag to move your exit</p>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 3, background: C.border }} /><span style={{ color: C.inkFaint }} className="text-[10px]">Working</span></span>
          <span className="flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 3, background: C.teal }} /><span style={{ color: C.inkFaint }} className="text-[10px]">Reclaimed</span></span>
        </div>
      </div>

      <div
        ref={ref}
        role="slider" aria-label="Exit year" aria-valuemin={nowYear} aria-valuemax={birthYear + 70} aria-valuenow={exitYear}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); updateNestedConfig("career_path", { exit_year: Math.max(nowYear, exitYear - 1) }); }
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); updateNestedConfig("career_path", { exit_year: Math.min(birthYear + 70, exitYear + 1) }); }
        }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDragging(true); setFromClientX(e.clientX); }}
        onPointerMove={(e) => { if (dragging) setFromClientX(e.clientX); }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        style={{ position: "relative", width: "100%", height: 190, cursor: "ew-resize", touchAction: "none", userSelect: "none", outline: "none" }}
      >
        <svg width="100%" height="190" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id="workWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.border} stopOpacity={0.7} />
              <stop offset="100%" stopColor={C.borderSoft} stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="freeWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.tealLight} />
              <stop offset="100%" stopColor={C.teal} />
            </linearGradient>
            <clipPath id="workClip"><rect x={0} y={0} width={Math.max(0, exitX)} height={VH} /></clipPath>
            <clipPath id="freeClip"><rect x={exitX} y={0} width={Math.max(0, VW - exitX)} height={VH} /></clipPath>
          </defs>

          {/* Two-tone river */}
          <path d={path} fill="url(#workWater)" clipPath="url(#workClip)" />
          <path d={path} fill="url(#freeWater)" clipPath="url(#freeClip)" />

          {/* Drifting currents in the free water */}
          <g clipPath="url(#freeClip)" style={{ animation: "riverDrift 7s linear infinite" }}>
            {currents.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </svg>

        {/* Exit handle — a vertical marker with a label, positioned by % */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${exitFrac * 100}%`, width: 0, transition: dragging ? "none" : "left 0.25s ease", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 8, bottom: 8, left: -1, width: 2, background: C.tealDark, opacity: 0.85, borderRadius: 2 }} />
          <div style={{ position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: C.tealDark, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
            Exit {exitYear} · {exitAge}
          </div>
          <div style={{ position: "absolute", top: "50%", left: -7, width: 14, height: 14, transform: "translateY(-50%)", borderRadius: "50%", background: "#fff", border: `2px solid ${C.tealDark}`, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
        </div>

        {/* Age ticks along the bottom */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: -16, display: "flex", justifyContent: "space-between" }}>
          {[currentAge, Math.round(currentAge + span * 0.33), Math.round(currentAge + span * 0.66), HORIZON_AGE].map((a, i) => (
            <span key={i} style={{ color: C.inkFaint, fontSize: 9 }} className="tabular-nums">{a}</span>
          ))}
        </div>
      </div>

      {/* ── What the reclaimed prime time buys ── */}
      <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-5 mt-10">
        What those {stats.primeWeeks.toLocaleString()} prime weeks become
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {LIFE_USES.map((m) => (
          <div key={m.label} className="p-5 rounded-2xl border flex flex-col gap-2" style={{ background: C.bgCard, borderColor: C.borderSoft }}>
            <span className="text-2xl">{m.icon}</span>
            <p style={{ color: C.teal }} className="text-2xl font-extralight tabular-nums leading-none">
              {Math.round(stats.primeWeeks / m.weeksDiv).toLocaleString()}
            </p>
            <p style={{ color: C.inkSoft }} className="text-[11px] leading-relaxed">{m.label}</p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes riverDrift { from { transform: translateX(-30px); } to { transform: translateX(30px); } }
      `}</style>
    </div>
  );
}

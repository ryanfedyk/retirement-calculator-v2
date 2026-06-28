"use client";
import { useState, useEffect, useMemo } from "react";
import { C } from "@/config/colors";
import { HORIZON_CONFIG } from "@/config/horizonConfig";
import { useFinancialStore } from "@/store/useFinancialStore";

// The conventional full-retirement benchmark we measure "reclaimed" prime years
// against, and the horizon for the life-in-weeks grid.
const BENCHMARK_AGE = 65;
const HORIZON_AGE   = 90;
const WEEKS = 52;

const LIFE_USES = [
  { label: "weekends with people you love", icon: "👨‍👩‍👧‍👧", weeksDiv: 1 / 2 }, // ~2 weekend-days per week
  { label: "summers in your prime",          icon: "☀️", weeksDiv: 52 },
  { label: "slow-travel trips (2 wks each)",  icon: "🌍", weeksDiv: 2 },
  { label: "mornings that are yours",         icon: "🌅", weeksDiv: 1 / 7 },
];

/**
 * Reclaimed Time — a dynamic, interactive picture of the life you buy back.
 * The centerpiece is a "life in weeks" grid: every square is one week from now
 * to age 90. Drag your exit year and watch the prime-of-life weeks you reclaim
 * (vs. working to 65) light up. A rotating mantra sits in the hero — the daily
 * mantras now live here rather than in a standalone tab you'd never revisit.
 */
export default function ReclaimedTimeCalculator() {
  const { config, updateNestedConfig } = useFinancialStore();
  const nowYear   = new Date().getFullYear();
  const birthYear = config.birth_year || nowYear - 40;
  const currentAge = Math.max(18, nowYear - birthYear);
  const exitYear  = config.career_path.exit_year;
  const exitAge   = Math.max(currentAge, exitYear - birthYear);

  // Rotate the mantra in the hero for a living, dynamic feel.
  const mantras = HORIZON_CONFIG.mantras;
  const [mantraIdx, setMantraIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMantraIdx(i => (i + 1) % mantras.length), 7000);
    return () => clearInterval(id);
  }, [mantras.length]);

  const setExit = (yr: number) => updateNestedConfig("career_path", { exit_year: yr });

  const stats = useMemo(() => {
    const primeYears = Math.max(0, BENCHMARK_AGE - exitAge); // reclaimed vs working to 65
    const primeWeeks = primeYears * WEEKS;
    const freeYears  = Math.max(0, HORIZON_AGE - exitAge);
    return { primeYears, primeWeeks, freeYears };
  }, [exitAge]);

  // Build the life-in-weeks grid: one row per year from this year to age 90.
  const rows = useMemo(() => {
    const out: { age: number; kind: "work" | "prime" | "free" }[] = [];
    for (let age = currentAge; age < HORIZON_AGE; age++) {
      const kind = age < exitAge ? "work" : age < BENCHMARK_AGE ? "prime" : "free";
      out.push({ age, kind });
    }
    return out;
  }, [currentAge, exitAge]);

  const cellColor = (kind: "work" | "prime" | "free") =>
    kind === "work" ? C.borderSoft : kind === "prime" ? C.teal : C.tealLight;

  const maxExit = Math.max(birthYear + 70, exitYear);

  return (
    <div>
      {/* ── Hero: rotating mantra + the headline number ── */}
      <div className="mb-8 p-7 rounded-2xl" style={{ background: C.tealWash, border: `1px solid ${C.tealLight}` }}>
        <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-3">Reclaimed Time</p>
        <p key={mantraIdx} style={{ color: C.ink, animation: "fadeIn 0.8s ease" }} className="text-xl md:text-2xl font-light leading-relaxed italic">
          &ldquo;{mantras[mantraIdx]}&rdquo;
        </p>
        <div className="mt-6 flex items-end gap-3 flex-wrap">
          <span style={{ color: C.tealDark }} className="text-5xl font-extralight tabular-nums leading-none">{stats.primeYears}</span>
          <span style={{ color: C.inkMid }} className="text-sm mb-1">
            {stats.primeYears === 1 ? "year" : "years"} of your <strong>prime</strong> reclaimed by leaving at {exitYear} instead of {BENCHMARK_AGE}
            {stats.primeYears === 0 && " — drag your exit year earlier to buy some back"}
          </span>
        </div>
      </div>

      {/* ── Interactive exit-year control ── */}
      <div className="mb-8 p-6 rounded-2xl border" style={{ background: C.bgCard, borderColor: C.borderSoft }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p style={{ color: C.inkSoft }} className="text-[11px] uppercase tracking-widest">Exit year — drag to see the weeks you reclaim</p>
          <span style={{ color: C.ink }} className="text-2xl font-light tabular-nums">{exitYear} <span style={{ color: C.inkSoft }} className="text-sm">· age {exitAge}</span></span>
        </div>
        <input type="range" min={nowYear} max={maxExit} value={exitYear}
               onChange={e => setExit(Number(e.target.value))}
               className="w-full" style={{ accentColor: C.teal, cursor: "pointer" }} />
      </div>

      {/* ── Life in weeks ── */}
      <div className="mb-8 p-6 rounded-2xl border" style={{ background: C.bgCard, borderColor: C.borderSoft }}>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest">Your life in weeks — now to {HORIZON_AGE}</p>
          <div className="flex gap-4">
            {[["work", "Working"], ["prime", "Prime reclaimed"], ["free", "Beyond 65"]].map(([k, label]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span style={{ width: 9, height: 9, borderRadius: 2, background: cellColor(k as "work") }} />
                <span style={{ color: C.inkFaint }} className="text-[10px]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col" style={{ gap: 3 }}>
          {rows.map(({ age, kind }) => (
            <div key={age} className="flex items-center" style={{ gap: 3 }}>
              {age % 5 === 0
                ? <span style={{ color: C.inkFaint, fontSize: 8, width: 18, flexShrink: 0, textAlign: "right" }} className="tabular-nums">{age}</span>
                : <span style={{ width: 18, flexShrink: 0 }} />}
              <div className="flex flex-wrap" style={{ gap: 2, flex: 1 }}>
                {Array.from({ length: WEEKS }).map((_, w) => (
                  <span key={w} style={{
                    width: 6, height: 6, borderRadius: 1.5, flexShrink: 0,
                    background: cellColor(kind),
                    transition: "background 0.4s ease",
                  }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── What the reclaimed prime time buys ── */}
      <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-5">
        What those {stats.primeWeeks.toLocaleString()} prime weeks become
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {LIFE_USES.map(m => (
          <div key={m.label} className="p-5 rounded-2xl border flex flex-col gap-2"
               style={{ background: C.bgCard, borderColor: C.borderSoft }}>
            <span className="text-2xl">{m.icon}</span>
            <p style={{ color: C.teal }} className="text-2xl font-extralight tabular-nums leading-none">
              {Math.round(stats.primeWeeks / m.weeksDiv).toLocaleString()}
            </p>
            <p style={{ color: C.inkSoft }} className="text-[11px] leading-relaxed">{m.label}</p>
          </div>
        ))}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

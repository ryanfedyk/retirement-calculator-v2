"use client";
import { useState, useMemo } from "react";
import { C } from "@/config/colors";
import { HORIZON_CONFIG } from "@/config/horizonConfig";

const PHASE_TARGETS: Record<number, number> = { 1: 50, 2: 45, 3: 38, 4: 30 };

const LIFE_USES = [
  { label: "Guitar sessions", icon: "🎸", hoursEach: 1 },
  { label: "Long trail runs",  icon: "🏃", hoursEach: 2 },
  { label: "Full family weekends", icon: "👨‍👩‍👧‍👧", hoursEach: 16 },
  { label: "Days of slow travel", icon: "🌍", hoursEach: 10 },
  { label: "Deep reading sessions", icon: "📖", hoursEach: 2 },
  { label: "Uninterrupted mornings", icon: "☀️", hoursEach: 3 },
];

export default function ReclaimedTimeCalculator() {
  const [currentHours, setCurrentHours] = useState<number>(HORIZON_CONFIG.work.avgHoursPerWeek);
  const [theaterHours, setTheaterHours] = useState<number>(HORIZON_CONFIG.work.corporateTheaterHoursPerWeek);

  const calcs = useMemo(() => HORIZON_CONFIG.phases.map((phase) => {
    const target      = PHASE_TARGETS[phase.id];
    const weeklyDelta = Math.max(0, currentHours - target);
    const theaterSave = theaterHours * (phase.id * 0.25);
    const weeklyTotal = weeklyDelta + theaterSave;
    const phaseTotal  = Math.round(weeklyTotal * 52);
    return { phase, target, weeklyDelta, theaterSave: Math.round(theaterSave * 10) / 10, weeklyTotal: Math.round(weeklyTotal * 10) / 10, phaseTotal };
  }), [currentHours, theaterHours]);

  const grandTotal   = calcs.reduce((s, c) => s + c.phaseTotal, 0);
  const maxWeekly    = Math.max(...calcs.map(c => c.weeklyTotal), 1);

  // Hours saved in the current week vs. full intensity
  const weekNowSaved = calcs[0].weeklyTotal;

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-10">
        <h2 style={{ color: C.ink }} className="text-2xl font-light tracking-tight mb-2">
          Reclaimed Time
        </h2>
        <p style={{ color: C.inkSoft }} className="text-sm">
          Every hour you stop giving to corporate theater is an hour you can invest in the life
          waiting on the other side. Adjust your inputs — watch the compound effect.
        </p>
      </div>

      {/* ── Inputs ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {[
          {
            label: "Current hours per week at work",
            sub: `${Math.round((currentHours / 168) * 100)}% of your waking week`,
            value: currentHours, min: 35, max: 80,
            set: setCurrentHours, accent: C.tealDark,
          },
          {
            label: "Corporate theater hours per week",
            sub: "Performative meetings, unnecessary admin, status theater",
            value: theaterHours, min: 0, max: 25,
            set: setTheaterHours, accent: C.teal,
          },
        ].map(s => (
          <div key={s.label} className="p-6 rounded-2xl border"
               style={{ background: C.bgCard, borderColor: C.borderSoft }}>
            <p style={{ color: C.inkSoft }} className="text-[11px] uppercase tracking-widest mb-1">{s.label}</p>
            <p style={{ color: C.inkFaint }} className="text-[10px] mb-4">{s.sub}</p>
            <div className="flex items-center gap-5">
              <input type="range" min={s.min} max={s.max} value={s.value}
                     onChange={e => s.set(Number(e.target.value))}
                     className="flex-1" style={{ accentColor: s.accent }} />
              <span style={{ color: C.ink }} className="text-4xl font-extralight tabular-nums w-14 text-right">
                {s.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── This Week Callout ── */}
      <div className="mb-8 p-5 rounded-2xl flex items-center gap-5"
           style={{ background: C.tealWash, border: `1px solid ${C.tealLight}` }}>
        <div className="text-center shrink-0">
          <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-1">This Week</p>
          <p style={{ color: C.ink }} className="text-4xl font-extralight tabular-nums">
            {weekNowSaved.toFixed(1)}
          </p>
          <p style={{ color: C.inkSoft }} className="text-[11px]">hrs you could reclaim</p>
        </div>
        <div className="w-px self-stretch" style={{ background: C.tealLight }} />
        <p style={{ color: C.inkMid }} className="text-sm leading-relaxed italic">
          Starting Phase 1 today at {PHASE_TARGETS[1]} hrs/week instead of {currentHours} frees{" "}
          <span style={{ color: C.ink }} className="font-semibold not-italic">{weekNowSaved.toFixed(1)} hours</span> this
          week alone. Over Phase 1 that compounds to{" "}
          <span style={{ color: C.ink }} className="font-semibold not-italic">{calcs[0].phaseTotal.toLocaleString()} hours</span>.
        </p>
      </div>

      {/* ── Per-Phase Bar Chart ── */}
      <div className="mb-8 p-6 rounded-2xl border" style={{ background: C.bgCard, borderColor: C.borderSoft }}>
        <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-6">
          Weekly Hours Reclaimed — By Phase
        </p>

        <div className="space-y-5">
          {calcs.map(({ phase, target, weeklyDelta, theaterSave, weeklyTotal, phaseTotal }, i) => (
            <div key={phase.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.phase[i] }} />
                  <span style={{ color: C.inkMid }} className="text-xs font-medium">{phase.name}</span>
                  <span style={{ color: C.inkFaint }} className="text-[10px]">→ target {target} hrs/wk</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span style={{ color: C.phase[i] }} className="text-base font-light tabular-nums">
                    +{weeklyTotal}h/wk
                  </span>
                  <span style={{ color: C.inkFaint }} className="text-[11px] tabular-nums">
                    {phaseTotal.toLocaleString()} hrs/yr
                  </span>
                </div>
              </div>

              {/* Stacked bar: work reduction + theater reduction */}
              <div className="flex rounded-full overflow-hidden h-3" style={{ background: C.bg, gap: 1 }}>
                {/* Work hours reduction segment */}
                {weeklyDelta > 0 && (
                  <div
                    className="h-full rounded-l-full transition-all duration-500"
                    style={{
                      width: `${(weeklyDelta / maxWeekly) * 100}%`,
                      backgroundColor: C.phase[i],
                    }}
                    title={`Work reduction: ${weeklyDelta}h`}
                  />
                )}
                {/* Theater hours segment */}
                {theaterSave > 0 && (
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${(theaterSave / maxWeekly) * 100}%`,
                      backgroundColor: `${C.phase[i]}66`,
                      borderRadius: weeklyDelta === 0 ? "999px 999px 999px 999px" : "0 999px 999px 0",
                    }}
                    title={`Theater reduction: ${theaterSave}h`}
                  />
                )}
              </div>

              {weeklyDelta === 0 && theaterSave === 0 && (
                <p style={{ color: C.inkFaint }} className="text-[10px] mt-1 italic">
                  Already at or below target for this phase.
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-5 mt-5 pt-4 border-t" style={{ borderColor: C.borderSoft }}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-2 rounded-full" style={{ background: C.tealDark }} />
            <span style={{ color: C.inkFaint }} className="text-[10px]">Work hours reduction</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-2 rounded-full" style={{ background: `${C.tealDark}55` }} />
            <span style={{ color: C.inkFaint }} className="text-[10px]">Theater hours reduction</span>
          </div>
        </div>
      </div>

      {/* ── Grand Total ── */}
      <div className="p-8 rounded-2xl mb-10"
           style={{ background: `${C.phase[0]}14`, border: `1px solid ${C.phase[0]}44` }}>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-3">
              Total Hours Reclaimed — All Four Phases
            </p>
            <p style={{ color: C.ink }} className="text-6xl font-extralight tabular-nums mb-2">
              {grandTotal.toLocaleString()}
            </p>
            <p style={{ color: C.inkMid }} className="text-sm">
              {Math.round(grandTotal / 24).toLocaleString()} full days ·{" "}
              {Math.round(grandTotal / (24 * 7)).toLocaleString()} full weeks ·{" "}
              {(grandTotal / (24 * 365)).toFixed(1)} years
            </p>
          </div>
          <div className="text-right">
            <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-2">
              Compounding across phases
            </p>
            <div className="flex items-end gap-1.5">
              {calcs.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span style={{ color: C.phase[i] }} className="text-[10px] tabular-nums">
                    {c.phaseTotal.toLocaleString()}
                  </span>
                  <div
                    className="w-6 rounded-t-sm"
                    style={{
                      height: `${Math.round((c.phaseTotal / Math.max(...calcs.map(x => x.phaseTotal))) * 48)}px`,
                      backgroundColor: C.phase[i],
                    }}
                  />
                  <span style={{ color: C.inkFaint }} className="text-[9px]">Y{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Life Translations ── */}
      <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-5">
        What {grandTotal.toLocaleString()} hours buys you
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {LIFE_USES.map(m => (
          <div key={m.label} className="p-5 rounded-2xl border flex items-start gap-3"
               style={{ background: C.bgCard, borderColor: C.borderSoft }}>
            <span className="text-2xl shrink-0">{m.icon}</span>
            <div>
              <p style={{ color: C.teal }} className="text-2xl font-extralight tabular-nums leading-none mb-1">
                {Math.round(grandTotal / m.hoursEach).toLocaleString()}
              </p>
              <p style={{ color: C.inkSoft }} className="text-[11px] leading-relaxed">{m.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

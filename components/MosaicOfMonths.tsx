"use client";
import { useState, useCallback } from "react";
import { Check } from "lucide-react";
import { C } from "@/config/colors";
import { buildMosaicCells, getLifeEvents } from "@/lib/horizonUtils";
import { HORIZON_CONFIG, useHorizonProfile } from "@/config/horizonConfig";
import { useRetirementDate } from "@/hooks/useRetirementDate";
import type { MonthCell, AdventureBlueprint, WhenToStart, LifeEvent } from "@/types/horizon";

// ── Constants ──────────────────────────────────────────────────────────────
const WHEN_TO_PHASES: Record<WhenToStart, number[]> = {
  "Now":             [1],
  "Phase 2+":        [2, 3],
  "Post-Retirement": [4],
};
const PHASE_WEEKLY_SAVINGS = [8, 16, 26, 37];

// ── Helpers ────────────────────────────────────────────────────────────────
function a(opacity: number) {
  return Math.round(opacity * 255).toString(16).padStart(2, "0");
}

function getChildAgeAt(birthDate: Date, atYear: number, atMonth: number) {
  let years  = atYear - birthDate.getUTCFullYear();
  let months = atMonth - birthDate.getUTCMonth();
  if (months < 0) { years--; months += 12; }
  return { years, months };
}

function getWorkingDaysInMonth(year: number, month: number) {
  const days = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function getRemainingWorkingDays() {
  const now  = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let count  = 0;
  for (let d = new Date(now); d <= last; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function getReclaimedByOffset(offsetMonths: number) {
  let total = 0;
  for (let m = 0; m < offsetMonths; m++) {
    total += PHASE_WEEKLY_SAVINGS[Math.min(Math.floor(m / 12), 3)] * (52 / 12);
  }
  return Math.round(total);
}

// ── Cell styling ───────────────────────────────────────────────────────────
// Never use CSS `opacity` on a cell — child tooltips would inherit it.
function cellStyle(
  cell: MonthCell,
  isCompleted: boolean,
  hasLifeEvent: boolean,
): React.CSSProperties {
  const pc = C.phase[cell.phaseId - 1];
  const hasBirthday = cell.childMilestones.length > 0;

  if (cell.status === "past") {
    return { backgroundColor: `#1a2e25${isCompleted ? a(0.18) : a(0.38)}`, transition: "background-color 0.6s ease" };
  }
  if (cell.status === "current") {
    return { backgroundColor: pc, outline: `3px solid ${pc}`, outlineOffset: "3px", boxShadow: `0 0 0 1px white, 0 0 14px 0 ${pc}66` };
  }
  // Future — life events warm, birthdays teal, otherwise phase-tinted
  if (hasBirthday) {
    return { backgroundColor: C.teal, outline: `2px solid ${C.teal}`, outlineOffset: "2px" };
  }
  if (hasLifeEvent) {
    return { backgroundColor: C.warm, outline: `2px solid ${C.warm}`, outlineOffset: "2px" };
  }
  return { backgroundColor: `${pc}38`, outline: `1px solid ${pc}55`, outlineOffset: "1px" };
}

// ── Rich hover tooltip ─────────────────────────────────────────────────────
function RichTooltip({ cell, adventures, offsetFromNow, lifeEventsForCell }: {
  cell: MonthCell;
  adventures: AdventureBlueprint[];
  offsetFromNow: number;
  lifeEventsForCell: LifeEvent[];
}) {
  const { retirementDate: ret } = useRetirementDate();
  const { children } = useHorizonProfile();
  const monthsToRetirement = Math.max(0,
    (ret.getFullYear() - cell.year) * 12 + (ret.getMonth() - cell.month)
  );
  const reclaimedHours = getReclaimedByOffset(offsetFromNow);
  const workingDays    = cell.status === "current" ? getRemainingWorkingDays() : getWorkingDaysInMonth(cell.year, cell.month);
  const phaseName      = HORIZON_CONFIG.phases.find(p => p.id === cell.phaseId)?.name ?? "";
  const phaseIntensity = HORIZON_CONFIG.phases.find(p => p.id === cell.phaseId)?.intensity ?? 100;
  const monthLabel     = new Date(cell.year, cell.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const matched        = adventures.filter(a => WHEN_TO_PHASES[a.whenToStart]?.includes(cell.phaseId));
  // Is September (back to school) or June (summer)?
  const isBackToSchool = cell.month === 8;
  const isSummerStart  = cell.month === 5;

  return (
    <div className="absolute pointer-events-none"
         style={{ bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", width: 256, zIndex: 9999 }}>
      <div className="rounded-2xl border shadow-xl overflow-hidden"
           style={{ background: C.bgCard, borderColor: C.borderSoft }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
          <div className="flex items-start justify-between gap-2">
            <p style={{ color: C.ink }} className="text-sm font-semibold leading-tight">{monthLabel}</p>
            {(isBackToSchool || isSummerStart) && (
              <span className="text-base shrink-0">{isBackToSchool ? "🍂" : "☀️"}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${C.phase[cell.phaseId-1]}22`, color: C.phase[cell.phaseId-1] }}>
              {phaseName}
            </span>
            <span style={{ color: C.inkFaint }} className="text-[10px]">{phaseIntensity}% intensity</span>
          </div>
        </div>

        {/* Life ticker */}
        <div className="px-4 py-3" style={{ background: C.tealWash, borderBottom: `1px solid ${C.borderSoft}` }}>
          <p style={{ color: C.tealDark }} className="text-[9px] uppercase tracking-widest mb-2">Life snapshot</p>
          <div className="space-y-1">
            {children.map(child => {
              const age = getChildAgeAt(new Date(child.birthDate), cell.year, cell.month);
              return (
                <div key={child.name} className="flex items-center justify-between">
                  <span style={{ color: C.inkMid }} className="text-[11px] font-medium">{child.name}</span>
                  <span style={{ color: C.ink }} className="text-[11px] tabular-nums font-semibold">
                    {age.years}y {age.months}mo
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
          {[
            { label: cell.status === "current" ? "Days left" : "Work days", value: workingDays },
            { label: "Months left",    value: monthsToRetirement },
            { label: "Hrs reclaimed",  value: reclaimedHours.toLocaleString() },
          ].map((s, i) => (
            <div key={s.label} className="py-3 flex flex-col items-center gap-0.5"
                 style={{ borderRight: i < 2 ? `1px solid ${C.borderSoft}` : "none" }}>
              <span style={{ color: C.ink }} className="text-base font-light tabular-nums leading-none">{s.value}</span>
              <span style={{ color: C.inkFaint }} className="text-[8px] uppercase tracking-wider text-center leading-tight">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Life events for this month */}
        {lifeEventsForCell.length > 0 && (
          <div className="px-4 py-2.5" style={{ background: `${C.warm}14`, borderBottom: matched.length ? `1px solid ${C.borderSoft}` : "none" }}>
            {lifeEventsForCell.map((ev, i) => (
              <div key={i} className="flex items-start gap-1.5 mb-1 last:mb-0">
                <span className="text-[12px] shrink-0">{ev.icon}</span>
                <p style={{ color: C.warm }} className="text-[10px] font-semibold leading-snug">{ev.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Birthdays */}
        {cell.childMilestones.length > 0 && (
          <div className="px-4 py-2.5" style={{ borderBottom: matched.length ? `1px solid ${C.borderSoft}` : "none" }}>
            {cell.childMilestones.map(m => (
              <div key={m.childName} className="flex items-start gap-1.5">
                <span className="text-[11px]">🎂</span>
                <p style={{ color: C.tealDark }} className="text-[10px] leading-snug">{m.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pinned adventures */}
        {matched.length > 0 && (
          <div className="px-4 py-2.5">
            <p style={{ color: C.inkFaint }} className="text-[9px] uppercase tracking-widest mb-1.5">Pinned for this phase</p>
            {matched.slice(0, 2).map(adv => (
              <div key={adv.id} className="mb-1.5 last:mb-0">
                <p style={{ color: C.ink }} className="text-[10px] font-medium leading-snug">{adv.concept}</p>
                <p style={{ color: C.inkSoft }} className="text-[9px] leading-snug italic">{adv.microDoseAction}</p>
              </div>
            ))}
          </div>
        )}

        {/* Arrow */}
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b"
             style={{ background: C.bgCard, borderColor: C.borderSoft }} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
interface Props { pinnedAdventures: AdventureBlueprint[]; }

export default function MosaicOfMonths({ pinnedAdventures }: Props) {
  const { retirementDate } = useRetirementDate();
  const { children } = useHorizonProfile();
  const cells      = buildMosaicCells(retirementDate, children);
  const lifeEvents = getLifeEvents(retirementDate, children);

  const [hovered,   setHovered]   = useState<MonthCell | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const now         = new Date();
  const futureCells = cells.filter(c => c.status !== "past").length;
  const pastCells   = cells.filter(c => c.status === "past").length;
  const cellKey     = (c: MonthCell) => `${c.year}-${c.month}`;
  const cellOffset  = (c: MonthCell) => (c.year - now.getFullYear()) * 12 + (c.month - now.getMonth());

  // Build a lookup map for life events by "year-month"
  const lifeEventMap = new Map<string, LifeEvent[]>();
  for (const ev of lifeEvents) {
    const k = `${ev.year}-${ev.month}`;
    lifeEventMap.set(k, [...(lifeEventMap.get(k) ?? []), ev]);
  }

  const toggleComplete = useCallback((cell: MonthCell) => {
    if (cell.status !== "past") return;
    setCompleted(prev => {
      const next = new Set(prev);
      next.has(cellKey(cell)) ? next.delete(cellKey(cell)) : next.add(cellKey(cell));
      return next;
    });
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 style={{ color: C.ink }} className="text-xl font-light tracking-tight mb-1">Mosaic of Months</h2>
        <p style={{ color: C.inkSoft }} className="text-xs leading-relaxed">
          <span style={{ color: C.ink }} className="font-medium">{futureCells}</span> months ahead.{" "}
          <span style={{ color: C.inkFaint }}>{pastCells} months behind you.</span>{" "}
          Retirement: {retirementDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}.
        </p>
      </div>

      {/* Grid (full width) */}
      <div>
        <div className="w-full">

          {/* Info bar */}
          <p style={{ color: C.inkFaint }} className="text-[11px] mb-3">
            {getRemainingWorkingDays()} working days left this month · hover any future cell for a life snapshot
          </p>

          {/* Legend */}
          <div className="flex gap-4 mb-3 flex-wrap items-center">
            {[
              { color: `#1a2e25${a(0.38)}`, label: "Past" },
              { color: C.phase[0],           label: "Current" },
              ...HORIZON_CONFIG.phases.map((p, i) => ({ color: `${C.phase[i]}38`, label: p.name })),
              { color: C.teal,               label: "Birthday" },
              { color: C.warm,               label: "Life event" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span style={{ color: C.inkFaint }} className="text-[11px]">{label}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", overflow: "visible" }}>
            {cells.map((cell, i) => {
              const isCompleted     = completed.has(cellKey(cell));
              const hasBirthday     = cell.childMilestones.length > 0 && cell.status !== "past";
              const cellLifeEvents  = lifeEventMap.get(`${cell.year}-${cell.month}`) ?? [];
              const hasLifeEvent    = cellLifeEvents.length > 0 && cell.status !== "past";
              const showTooltip     = hovered?.year === cell.year && hovered?.month === cell.month && cell.status !== "past";
              const offset          = cellOffset(cell);

              return (
                <div
                  key={i}
                  className={`mosaic-cell relative aspect-square rounded cursor-pointer ${cell.status === "current" ? "pulse-calm" : ""}`}
                  style={{ ...cellStyle(cell, isCompleted, hasLifeEvent), animationDelay: `${Math.min(i * 10, 500)}ms` }}
                  onMouseEnter={() => setHovered(cell)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => toggleComplete(cell)}
                >
                  {/* Past: X or check */}
                  {cell.status === "past" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {isCompleted
                        ? <Check size={8} color="white" strokeWidth={3} style={{ opacity: 0.55 }} />
                        : (
                          <svg width="55%" height="55%" viewBox="0 0 10 10">
                            <line x1="1" y1="1" x2="9" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
                            <line x1="9" y1="1" x2="1" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
                          </svg>
                        )
                      }
                    </div>
                  )}

                  {/* Life event icon badge (future only, no birthday overlap) */}
                  {hasLifeEvent && !hasBirthday && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span style={{ fontSize: 9, lineHeight: 1 }}>{cellLifeEvents[0].icon}</span>
                    </div>
                  )}

                  {/* Birthday age badge */}
                  {hasBirthday && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-white font-semibold leading-none" style={{ fontSize: 9 }}>
                        {cell.childMilestones.map(m => m.age).join("/")}
                      </span>
                    </div>
                  )}

                  {/* Year label */}
                  {cell.month === 0 && (
                    <div className="absolute -top-5 left-0 whitespace-nowrap"
                         style={{ fontSize: 9, color: C.inkFaint }}>{cell.year}</div>
                  )}

                  {/* Rich hover tooltip */}
                  {showTooltip && (
                    <RichTooltip
                      cell={cell}
                      adventures={pinnedAdventures}
                      offsetFromNow={offset}
                      lifeEventsForCell={cellLifeEvents}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between mt-4 text-[10px]" style={{ color: C.inkFaint }}>
            <span>← Each row = 12 months · {Math.ceil(cells.length / 12)} rows total</span>
            <span>
              {retirementDate.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })} →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

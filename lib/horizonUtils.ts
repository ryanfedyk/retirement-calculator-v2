import { HORIZON_CONFIG, type HorizonChild } from "@/config/horizonConfig";
import type { MonthCell, ChildMilestone, LifeEvent } from "@/types/horizon";

// Default retirement date (static fallback, 10y out). Call sites in the
// Forecasting tab pass the DYNAMIC date from useRetirementDate(), and child-aware
// helpers receive the current profile's children, so everything reacts to the
// per-user model configured on the Financial tab.
const DEFAULT_RET = new Date(new Date().getFullYear() + 10, 0, 1);

export function getMonthsRemaining(ret: Date = DEFAULT_RET): number {
  const now = new Date();
  return (
    (ret.getFullYear() - now.getFullYear()) * 12 +
    (ret.getMonth() - now.getMonth())
  );
}

export function getCareerProgress(
  ret: Date = DEFAULT_RET,
  start: Date = new Date(new Date().getFullYear() - 15, 0, 1),
): number {
  const now   = new Date();
  const elapsed =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth()    - start.getMonth());
  const total =
    (ret.getFullYear() - start.getFullYear()) * 12 +
    (ret.getMonth()    - start.getMonth());
  return Math.min(100, Math.round((elapsed / total) * 100));
}

export function getPhaseForMonthOffset(offset: number): number {
  for (const p of HORIZON_CONFIG.phases) {
    if (offset >= p.startOffset && offset < p.endOffset) return p.id;
  }
  return HORIZON_CONFIG.phases[HORIZON_CONFIG.phases.length - 1].id;
}

export function getCurrentPhase(ret: Date = DEFAULT_RET) {
  const now = new Date();
  const remaining =
    (ret.getFullYear() - now.getFullYear()) * 12 +
    (ret.getMonth()    - now.getMonth());
  const elapsed = 48 - remaining;
  return (
    HORIZON_CONFIG.phases.find(p => elapsed >= p.startOffset && elapsed < p.endOffset) ??
    HORIZON_CONFIG.phases[0]
  );
}

/** Builds ALL cells from the phase start date through retirement.
 *  Includes past, current, and future months for full mosaic context. */
export function buildMosaicCells(ret: Date = DEFAULT_RET, children: HorizonChild[] = []): MonthCell[] {
  const now   = new Date();

  // Start from the beginning of the first phase (Jan of corporateStartDate year or a fixed anchor).
  // For the mosaic view we show the last 12 months + all future — keeps the grid legible.
  const viewStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
  const cells: MonthCell[] = [];

  let year  = viewStart.getFullYear();
  let month = viewStart.getMonth();

  while (year < ret.getFullYear() || (year === ret.getFullYear() && month <= ret.getMonth())) {
    const cellDate = new Date(year, month, 1);
    const isPast   = cellDate < new Date(now.getFullYear(), now.getMonth(), 1);
    const isCurrent =
      cellDate.getFullYear() === now.getFullYear() &&
      cellDate.getMonth()    === now.getMonth();

    // Phase offset: months from now (negative for past)
    const offsetFromNow =
      (year - now.getFullYear()) * 12 + (month - now.getMonth());

    cells.push({
      year,
      month,
      label: cellDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      status: isPast ? "past" : isCurrent ? "current" : "future",
      phaseId: getPhaseForMonthOffset(Math.max(0, offsetFromNow)),
      childMilestones: getChildMilestonesForMonth(cellDate, children),
    });

    month++;
    if (month > 11) { month = 0; year++; }
  }

  return cells;
}

/** Returns only the future milestone months for the Milestones Panel. */
export function getUpcomingMilestones(ret: Date = DEFAULT_RET, children: HorizonChild[] = []): (ChildMilestone & { date: Date; monthsAway: number; gridRow: number })[] {
  const now    = new Date();
  const result: (ChildMilestone & { date: Date; monthsAway: number; gridRow: number })[] = [];

  let year  = now.getFullYear();
  let month = now.getMonth();
  let offset = 0;

  while (year < ret.getFullYear() || (year === ret.getFullYear() && month <= ret.getMonth())) {
    const cellDate   = new Date(year, month, 1);
    const milestones = getChildMilestonesForMonth(cellDate, children);
    for (const m of milestones) {
      result.push({ ...m, date: cellDate, monthsAway: offset, gridRow: Math.floor(offset / 12) + 1 });
    }
    month++; offset++;
    if (month > 11) { month = 0; year++; }
  }

  return result.sort((a, b) => a.monthsAway - b.monthsAway);
}

function getChildMilestonesForMonth(date: Date, children: HorizonChild[] = []): ChildMilestone[] {
  const milestones: ChildMilestone[] = [];
  for (const child of children) {
    const birth = new Date(child.birthDate);
    // Use UTC month to avoid timezone offset shifting the date back one month
    if (date.getMonth() === birth.getUTCMonth() && date.getFullYear() > birth.getUTCFullYear()) {
      const age = date.getFullYear() - birth.getUTCFullYear();
      milestones.push({ childName: child.name, age, note: getBirthdayNote(child.name, age) });
    }
  }
  return milestones;
}

function getBirthdayNote(name: string, age: number): string {
  const notes: Record<number, string> = {
    10: `${name} turns 10 — the last years of pure childhood. Guard this time fiercely.`,
    11: `${name} turns 11 — middle school on the horizon. Be present before the shift.`,
    12: `${name} turns 12 — the golden pre-teen years. Your calendar should reflect this.`,
    13: `${name} turns 13 — officially a teenager. The conversations that matter most start now.`,
    14: `${name} turns 14 — high school incoming. These are formative moments.`,
    15: `${name} turns 15 — driving lessons, independence, and rapid change.`,
    16: `${name} turns 16 — you'll want every weekend you can get.`,
    17: `${name} turns 17 — senior year approaching. Be fully present.`,
    18: `${name} turns 18 — the beginning of their adult chapter.`,
  };
  return notes[age] ?? `${name} turns ${age}.`;
}

/** Returns the calendar date when a phase begins, relative to today. */
export function getPhaseStartDate(phaseId: number, ret: Date = DEFAULT_RET): Date {
  const now   = new Date();
  const phase = HORIZON_CONFIG.phases.find(p => p.id === phaseId)!;
  const d     = new Date(now);
  d.setMonth(d.getMonth() + phase.startOffset - (48 - getMonthsRemaining(ret)));
  d.setDate(1);
  return d;
}

/** Months elapsed within the current phase (0-indexed). */
export function getMonthsInCurrentPhase(ret: Date = DEFAULT_RET): number {
  const elapsed   = 48 - getMonthsRemaining(ret);
  const phase     = getCurrentPhase(ret);
  return Math.max(0, elapsed - phase.startOffset);
}

/** Months until the next phase begins (or 0 if in last phase). */
export function getMonthsUntilNextPhase(ret: Date = DEFAULT_RET): number {
  const current = getCurrentPhase(ret);
  if (current.id === 4) return 0;
  const next    = HORIZON_CONFIG.phases.find(p => p.id === current.id + 1)!;
  const elapsed = 48 - getMonthsRemaining(ret);
  return Math.max(0, next.startOffset - elapsed);
}

export function getDailyMantra(): string {
  const mantras  = HORIZON_CONFIG.mantras;
  const dayIndex = Math.floor(Date.now() / 86_400_000) % mantras.length;
  return mantras[dayIndex];
}

const LIFE_MILESTONES: Array<{
  age: number;
  monthFn: (birthMonth: number) => number;
  label: string;
  shortLabel: string;
  icon: string;
  note: (name: string) => string;
}> = [
  {
    age: 11, monthFn: () => 8,
    label: "Middle school begins", shortLabel: "Middle school", icon: "🏫",
    note: n => `${n}'s social world shifts dramatically this year. Be the steady anchor while it does.`,
  },
  {
    age: 14, monthFn: () => 8,
    label: "High school begins", shortLabel: "High school", icon: "🎒",
    note: n => `Four years that shape ${n}'s story. Presence over productivity — starting now.`,
  },
  {
    age: 16, monthFn: bm => bm,
    label: "Driver's permit eligible", shortLabel: "Driver's permit", icon: "🚗",
    note: n => `${n} can start driving. Make sure you're free enough to be in that passenger seat.`,
  },
  {
    age: 18, monthFn: () => 5,
    label: "High school graduation", shortLabel: "Graduation", icon: "🎓",
    note: n => `${n} graduates. The chapter you spent your career protecting. You made it.`,
  },
  {
    age: 18, monthFn: () => 8,
    label: "College begins", shortLabel: "College", icon: "🏛️",
    note: n => `${n} leaves for college. Everything you built toward was for this launch.`,
  },
];

export function getLifeEvents(ret: Date = DEFAULT_RET, children: HorizonChild[] = []): LifeEvent[] {
  const now = new Date();
  const events: LifeEvent[] = [];

  for (const child of children) {
    const birth      = new Date(child.birthDate);
    const birthYear  = birth.getUTCFullYear();
    const birthMonth = birth.getUTCMonth();

    for (const m of LIFE_MILESTONES) {
      const year  = birthYear + m.age;
      const month = m.monthFn(birthMonth);
      const evDate = new Date(year, month, 1);
      if (evDate <= now || evDate > ret) continue;

      const monthsAway =
        (year - now.getFullYear()) * 12 + (month - now.getMonth());

      events.push({
        childName: child.name,
        label:      m.label,
        shortLabel: m.shortLabel,
        icon:       m.icon,
        year, month, age: m.age,
        note:       m.note(child.name),
        monthsAway,
      });
    }
  }

  return events.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

export function calcReclaimedHours(currentHours: number, targetHours: number, weeksInPhase: number): number {
  return Math.max(0, (currentHours - targetHours) * weeksInPhase);
}

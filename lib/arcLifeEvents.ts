// ── Real life events for the retirement arc ───────────────────────────────────
//
// The arc (Design Your Retirement) is a life map from your exit age to the
// horizon. To orient it in real time we drop the SAME concrete milestones the
// finance charts plot — mortgage payoff, kids starting/finishing college, the
// empty nest, Social Security, Medicare, and any one-off life events — onto the
// path at the age each actually happens. Everything here is derived from the
// plan's own inputs, so the arc and the charts agree.

import { amortizationMonths } from "@/engine/calculator";

export interface ArcLifeEvent {
  /** Age (of the primary) when it happens — the arc's axis is age. */
  age: number;
  /** Calendar year, for a "real time" label. */
  year: number;
  icon: string;
  label: string;
}

export interface ArcLifeEventInputs {
  birthYear: number;
  exitAge: number;
  horizonAge: number;
  nowYear: number;
  children?: { name: string; birthDate: string | Date }[];
  /** Mortgage terms (omit / isRent to skip the payoff marker). */
  mortgage?: { balance: number; annualRatePct: number; monthlyPayment: number; isRent: boolean };
  /** Calendar year the empty-nest spending phase begins (null/absent to skip). */
  emptyNestYear?: number | null;
  socialSecurityStartAge?: number | null;
  medicareStartAge?: number | null;
  /** One-off life events from the plan (year + name). */
  oneOffs?: { year: number; name: string }[];
}

const firstName = (s: string) => (s || "").trim().split(/\s+/)[0] || "";

/** Pick an emoji for a one-off life event from its name. */
function oneOffIcon(name: string): string {
  const l = name.toLowerCase();
  if (l.includes("college") || l.includes("tuition")) return "🎓";
  if (l.includes("wedding")) return "💍";
  if (l.includes("renov") || l.includes("remodel") || l.includes("home")) return "🏠";
  if (l.includes("car")) return "🚗";
  if (l.includes("trip") || l.includes("travel")) return "✈️";
  if (l.includes("boat")) return "⛵";
  return "✦";
}

/**
 * The life events that fall WITHIN the arc (exitAge < age ≤ horizonAge), sorted by
 * age. Events before the exit belong to the working years, not the retirement map.
 */
export function buildArcLifeEvents(inp: ArcLifeEventInputs): ArcLifeEvent[] {
  const { birthYear, exitAge, horizonAge, nowYear } = inp;
  const out: ArcLifeEvent[] = [];
  const push = (age: number, icon: string, label: string) => {
    const a = Math.round(age);
    if (a > exitAge && a <= horizonAge) out.push({ age: a, year: birthYear + a, icon, label });
  };

  // Kids — college begins (18) and graduates (22), by the PRIMARY's age then.
  for (const c of inp.children ?? []) {
    const by = new Date(c.birthDate).getUTCFullYear();
    if (!by) continue;
    const nm = firstName(c.name) || "Your kid";
    push((by + 18) - birthYear, "🏛️", `${nm} starts college`);
    push((by + 22) - birthYear, "🎓", `${nm} graduates`);
  }

  // Empty nest.
  if (inp.emptyNestYear) push(inp.emptyNestYear - birthYear, "🕊️", "Empty nest");

  // Mortgage paid off.
  const m = inp.mortgage;
  if (m && !m.isRent) {
    const months = amortizationMonths(m.balance, m.annualRatePct, m.monthlyPayment);
    if (months != null) push((nowYear + months / 12) - birthYear, "🏡", "Mortgage paid off");
  }

  // Social Security & Medicare.
  if (inp.medicareStartAge) push(inp.medicareStartAge, "🩺", "Medicare starts");
  if (inp.socialSecurityStartAge) push(inp.socialSecurityStartAge, "🏦", "Social Security");

  // One-off life events from the plan.
  for (const ev of inp.oneOffs ?? []) push(ev.year - birthYear, oneOffIcon(ev.name), ev.name);

  return out.sort((a, b) => a.age - b.age);
}

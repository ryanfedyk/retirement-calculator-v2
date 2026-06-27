/**
 * Plan notifications — the funding-health + FIRE-milestone messages shown in the
 * Alerts surface. Copy is word-for-word with the original plan-health banners and
 * the celebratory FIRE callouts (MILESTONES), and shared by desktop + mobile so
 * the two never drift.
 */
import { C } from "@/config/colors";
import { MILESTONES, type FireMetrics } from "@/lib/fire/moments";
import type { PlanHealth } from "@/engine/calculator";

export interface Notice { id: string; severity: "critical" | "warning" | "good"; title: string; body: string }

export const sevColor = (s: Notice["severity"]) => (s === "critical" ? "#c0492b" : s === "warning" ? C.warm : C.tealDark);
export const sevBg = (s: Notice["severity"]) => (s === "critical" ? "#fdece8" : s === "warning" ? C.warmWash : C.tealWash);

export function buildNotices(opts: {
  health: PlanHealth;
  depletion?: { date: string } | null;
  /** Whether the plan reaches FI at all (an independence point exists). */
  reachesFI: boolean;
  birthYear: number;
  metrics: FireMetrics;
}): Notice[] {
  const { health, depletion, reachesFI, birthYear, metrics } = opts;
  const out: Notice[] = [];
  // Plan-health — verbatim with the original plan-health banners.
  if (health === "shortfall") {
    const age = depletion ? Number((depletion.date.match(/\d{4}/) || [])[0]) - birthYear : null;
    out.push({ id: "shortfall", severity: "critical",
      title: `This plan runs out of money${depletion ? ` around ${depletion.date}` : ""}`,
      body: `${depletion ? `At age ${age}, your invested assets are exhausted and can't cover spending. ` : ""}Try a later exit year, lower monthly spend, higher savings, or stronger returns.` });
  } else if (!reachesFI) {
    out.push({ id: "no-fi", severity: "critical",
      title: "This plan doesn’t reach financial independence",
      body: "Your assets never reach your FI number. Try a later exit year, lower monthly spend, higher savings, or stronger returns — the trajectory below stays under the FI target the whole way." });
  } else if (health === "tight") {
    out.push({ id: "tight", severity: "warning",
      title: "Cutting it close",
      body: "This plan funds your retirement, but the cushion runs thin — a weak market stretch or unplanned expense could push it short. A little more savings or a slightly later exit adds margin." });
  } else {
    out.push({ id: "on-track", severity: "good",
      title: "On track",
      body: "Your plan funds retirement with a healthy cushion." });
  }
  // FIRE milestones — verbatim with the celebratory callouts (FireMoments).
  for (const m of MILESTONES) {
    if (m.active(metrics)) out.push({ id: m.id, severity: "good", title: `${m.emoji} ${m.title}`, body: m.sub });
  }
  return out;
}

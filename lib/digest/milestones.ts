// Milestone detection for the daily brief. The point of the brief isn't just
// "your money moved 1%" — it's to catch the human, once-in-a-while moments worth
// noticing: your second-to-last winter as a working person, a final review
// season, a fresh-start January, stepping into a new chapter of the wind-down,
// crossing a round number. These are what make the note feel like it knows where
// you are in your life, not just your portfolio.

import type { SimulationConfiguration } from "@/engine/calculator";
import type { Season } from "@/lib/seasons";

export type MilestoneKind =
  | "phase" | "season" | "newyear" | "yearend" | "review"
  | "networth" | "fi" | "concentration";

export interface Milestone {
  kind: MilestoneKind;
  /** Editorial headline — short, specific, a little bit of a wink. */
  headline: string;
  /** One sentence of context underneath it. */
  note: string;
  /** Ranking weight; the highest becomes the featured milestone. */
  weight: number;
}

export interface MilestoneInput {
  now: Date;
  config: SimulationConfiguration;
  seasons: Season[];
  currentIndex: number;
  investable: number;
  concentration: number;      // 0–1
  concentratedSymbol: string;
  equityOn: boolean;
  fiYear: number | null;
}

const SEASON_LABEL = ["Winter", "Spring", "Summer", "Autumn"] as const;
// Representative anchor month for each calendar season (0-indexed).
const SEASON_ANCHOR: Record<string, number> = { Winter: 0, Spring: 3, Summer: 6, Autumn: 9 };

function calendarSeason(month: number): (typeof SEASON_LABEL)[number] {
  if (month <= 1 || month === 11) return "Winter";
  if (month <= 4) return "Spring";
  if (month <= 7) return "Summer";
  return "Autumn";
}

// "last", "second-to-last", … up to a point; beyond that it stops feeling like a
// countdown, so callers treat null as "don't feature it".
function ordinalToLast(n: number): string | null {
  const map: Record<number, string> = {
    1: "last", 2: "second-to-last", 3: "third-to-last",
    4: "fourth-to-last", 5: "fifth-to-last",
  };
  return map[n] ?? null;
}

// Count remaining occurrences of a calendar season between now and exit,
// INCLUDING the one we're currently in (even though its mid-season anchor date
// may already be behind us — you're still living that season).
function occurrencesUntilExit(season: string, now: Date, exit: Date): number {
  if (exit <= now) return 0;
  const anchorMonth = SEASON_ANCHOR[season];
  const inSeasonNow = calendarSeason(now.getMonth()) === season;
  let count = 0;
  for (let y = now.getFullYear(); y <= exit.getFullYear(); y++) {
    const anchor = new Date(y, anchorMonth, 15);
    // Count a future instance, or the current in-progress one (anchor may be past).
    const currentInProgress = y === now.getFullYear() && inSeasonNow;
    if ((anchor >= now || currentInProgress) && anchor <= exit) count++;
  }
  return count;
}

export function detectMilestones(input: MilestoneInput): Milestone[] {
  const { now, config, seasons, currentIndex, investable, concentration, concentratedSymbol, equityOn, fiYear } = input;
  const out: Milestone[] = [];
  const year = now.getFullYear();
  const month = now.getMonth();
  const cp = config.career_path;
  const exitYear = cp.exit_year;
  const exitDate = new Date(exitYear, cp.exit_month ?? 0, 28);
  const working = exitDate > now;
  const season = calendarSeason(month);
  const current = seasons[currentIndex];
  const next = seasons[currentIndex + 1];

  // ── Stepping into a new chapter of the wind-down (season just began) ─────────
  if (current && current.startYear === year && currentIndex > 0) {
    out.push({
      kind: "phase",
      headline: `You've stepped into ${current.name}`,
      note: `${current.tagline} A new chapter of the glide — give it a beat to land.`,
      weight: 95,
    });
  }

  // ── Second-to-last winter / summer, etc. (the one the user loves) ────────────
  if (working) {
    const remaining = occurrencesUntilExit(season, now, exitDate);
    const ord = ordinalToLast(remaining);
    if (ord) {
      const flourish = ord === "last"
        ? `Soak it in — after this you do ${season.toLowerCase()} on your own terms.`
        : `The count is getting small enough to feel. Notice it.`;
      out.push({
        kind: "season",
        headline: `Your ${ord} ${season.toLowerCase()} in the working world`,
        note: `Counting the ${season}s between here and your ${exitYear} exit, this is one of the final few. ${flourish}`,
        weight: ord === "last" ? 92 : ord === "second-to-last" ? 88 : 80,
      });
    }
  }

  // ── A fresh-start January / closing the year ────────────────────────────────
  if (month === 0 && working) {
    const jans = Math.max(1, exitYear - year + 1);
    const ord = ordinalToLast(jans);
    out.push({
      kind: "newyear",
      headline: ord ? `A fresh start — your ${ord} January in the game` : "A fresh start",
      note: "New year, clean page. Reconnect with the why before the quarters fill up — what is this all in service of?",
      weight: 86,
    });
  } else if (month === 11) {
    out.push({
      kind: "yearend",
      headline: `Closing the books on ${year}`,
      note: "The home stretch of the year — a natural moment to look back at how far the plan moved and reset for the next lap.",
      weight: 70,
    });
  }

  // ── A final review season (year-end / early-year review window) ──────────────
  if (working && (month >= 9 || month <= 1)) {
    const reviews = Math.max(1, exitYear - year + (month >= 9 ? 1 : 0));
    const ord = ordinalToLast(reviews);
    if (ord) {
      out.push({
        kind: "review",
        headline: `Heading into your ${ord} review season`,
        note: `Fewer of these left than it feels. Ask for what you've earned — the comp and scope compound right up to the exit.`,
        weight: ord === "last" ? 84 : 74,
      });
    }
  }

  // ── Round-number net worth (knocking on / just past) ────────────────────────
  const marks = [500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 4_000_000, 5_000_000];
  for (const m of marks) {
    const ratio = investable / m;
    if (ratio >= 1.0 && ratio < 1.03) {
      out.push({ kind: "networth", headline: `You're past ${money(m)}`, note: `Investable assets just cleared ${money(m)}. Numbers like this are a story of a lot of boring, consistent months. Nice.`, weight: 78 });
      break;
    }
    if (ratio >= 0.95 && ratio < 1.0) {
      out.push({ kind: "networth", headline: `Knocking on ${money(m)}`, note: `You're within a rounding error of ${money(m)} investable — one decent session away.`, weight: 66 });
      break;
    }
  }

  // ── Concentration easing ────────────────────────────────────────────────────
  if (equityOn && concentratedSymbol && concentration > 0 && concentration < 0.5) {
    out.push({
      kind: "concentration",
      headline: `${concentratedSymbol} is under half your portfolio`,
      note: `Concentration is down to ${Math.round(concentration * 100)}%. The diversification plan is quietly doing its job.`,
      weight: 62,
    });
  }

  // ── Funded-stop in sight ────────────────────────────────────────────────────
  if (fiYear != null) {
    const out_ = fiYear - year;
    if (out_ <= 0) out.push({ kind: "fi", headline: "You could stop now — on the base case", note: "Your assets fund every modeled expense to 100 on the median path. The Risk view has the odds-adjusted date.", weight: 82 });
    else if (out_ <= 2) out.push({ kind: "fi", headline: `A funded stop is in sight — ~${fiYear}`, note: `The base case says ${fiYear} funds the whole plan to 100. Close enough to taste.`, weight: 72 });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

function money(n: number): string {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `$${Math.round(n / 1000)}k`;
}

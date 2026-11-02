// Daily brief builder. Pure/deterministic: given a plan + market quotes, it
// assembles the content for the weekday-morning email — last-day portfolio move,
// the season's framing/affirmation, phase-transition alerts, things to keep in
// mind, seasonal note, and notable holding moves. No network or AI here (the
// route fetches quotes and may layer AI framing on top); keeping this pure makes
// it unit-testable and safe to run server-side on a schedule.

import {
  netWorthToday,
  portfolioAllocation,
  findCashflowFiPoint,
  type FinancialSnapshot,
  type SimulationConfiguration,
} from "@/engine/calculator";
import { buildSeasons, currentSeasonIndex, type Season } from "@/lib/seasons";
import { detectMilestones, type Milestone } from "@/lib/digest/milestones";

export interface QuoteLike { price: number; previousClose: number | null; changePct: number | null }

export interface DigestMover {
  symbol: string;
  changePct: number;   // fraction (0.012 = +1.2%)
  value: number;       // live-priced position value
}

export interface DigestPhaseAlert {
  current: string;
  next: string;
  startYear: number;
  monthsAway: number;
  whatChanges: string;
}

export interface Digest {
  dateLabel: string;             // "Monday, November 3"
  greetingName: string | null;
  portfolio: {
    investable: number;
    netWorth: number;
    concentrationPct: number;    // concentrated share of investable (0–1)
    concentratedSymbol: string;
    dayChange: number | null;    // $ across holdings we had a previous close for
    dayChangePct: number | null; // fraction
    pricedCoverage: number;      // fraction of investable we had day-move data for (0–1)
    movers: DigestMover[];       // notable movers, biggest absolute move first
  };
  framing: {
    seasonName: string;
    seasonLabel: string;
    tagline: string;
    permission: string;
    focus: string;
    actions: string[];
    intensity: number;
  };
  phaseAlert: DigestPhaseAlert | null;
  fiDate: string | null;         // deterministic base-case FI date, if reached
  /** Editorial lede — set deterministically here; the send route may replace it
   *  with an AI-written one when Gemini is available. */
  editorial: string;
  /** Human + financial milestones, most resonant first ([0] is featured). */
  milestones: Milestone[];
  keepInMind: string[];
  holdingsNotes: string[];
  seasonalNote: string;
}

export interface BuildDigestInput {
  profile?: { displayName?: string | null } | null;
  config: SimulationConfiguration;
  snapshot: FinancialSnapshot;
  /** Quotes keyed by UPPER-CASE symbol. */
  quotes: Record<string, QuoteLike>;
  /** Live price for the concentrated/employer symbol (0 → fall back to quote/snapshot). */
  liveConcentratedPrice?: number;
  now?: Date;
}

const MOVER_THRESHOLD = 0.01;     // |1%| counts as a notable daily move
const PHASE_ALERT_MONTHS = 12;    // alert when the next season starts within a year

function calendarSeason(month: number): string {
  // Northern-hemisphere meteorological seasons.
  if (month <= 1 || month === 11) return "Winter";
  if (month <= 4) return "Spring";
  if (month <= 7) return "Summer";
  return "Autumn";
}

function whatChangesEntering(next: Season): string {
  switch (next.type) {
    case "sabbatical": return "a deliberate full break from work — no earned income, so the plan leans on assets.";
    case "jump":       return "a high-agency career jump — variable income and more risk, higher potential upside.";
    case "bridge":     return "a lower-intensity bridge job — steady but smaller income before full retirement.";
    case "retired":    return "full retirement — assets, Social Security, and any rental/bridge income carry it from here.";
    default:           return "a lower-intensity chapter of your wind-down.";
  }
}

export function buildDigest(input: BuildDigestInput): Digest {
  const { config, snapshot, quotes } = input;
  const now = input.now ?? new Date();
  const live = input.liveConcentratedPrice ?? 0;

  // ── Portfolio: today's value + the day's move ──────────────────────────────
  const nw = netWorthToday(snapshot, config, live);
  const alloc = portfolioAllocation(snapshot, config, live);

  const concSym = alloc.concentratedSymbol;
  // Every priced holding: the concentrated position (as one line) + each fund/stock.
  const holdings: { symbol: string; shares: number; price: number }[] = [];
  if (concSym && alloc.concentratedValue > 0) {
    const concShares = (snapshot.other_investments ?? [])
      .filter((i) => (i.symbol ?? "").toUpperCase() === concSym)
      .reduce((s, i) => s + i.shares, 0) + (snapshot.share_counts?.google_shares ?? 0);
    const concPrice = live > 0 ? live : (snapshot.share_counts?.live_stock_price || 0);
    if (concShares > 0 && concPrice > 0) holdings.push({ symbol: concSym, shares: concShares, price: concPrice });
  }
  for (const inv of snapshot.other_investments ?? []) {
    const sym = (inv.symbol ?? "").toUpperCase();
    if (!sym || sym === concSym) continue;
    const q = quotes[sym];
    const price = q?.price ?? inv.current_price;
    if (inv.shares > 0 && price > 0) holdings.push({ symbol: sym, shares: inv.shares, price });
  }

  let prevValue = 0;        // Σ shares·previousClose for holdings we have a prev close for
  let curPricedValue = 0;   // Σ shares·price for those same holdings
  const movers: DigestMover[] = [];
  for (const h of holdings) {
    const q = quotes[h.symbol];
    const value = h.shares * h.price;
    if (q && q.previousClose != null && q.changePct != null) {
      prevValue += h.shares * q.previousClose;
      curPricedValue += value;
      if (Math.abs(q.changePct) >= MOVER_THRESHOLD) movers.push({ symbol: h.symbol, changePct: q.changePct, value });
    }
  }
  movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  const dayChange = prevValue > 0 ? curPricedValue - prevValue : null;
  const dayChangePct = prevValue > 0 ? dayChange! / prevValue : null;
  const pricedCoverage = alloc.investable > 0 ? curPricedValue / alloc.investable : 0;

  // ── Framing: current season + the next-phase transition ─────────────────────
  const seasons = buildSeasons(config);
  const idx = currentSeasonIndex(seasons);
  const current = seasons[idx];
  const next = seasons[idx + 1];

  let phaseAlert: DigestPhaseAlert | null = null;
  if (current && next) {
    const monthsAway = (next.startYear - now.getFullYear()) * 12 - now.getMonth();
    if (monthsAway >= 0 && monthsAway <= PHASE_ALERT_MONTHS) {
      phaseAlert = { current: current.name, next: next.name, startYear: next.startYear, monthsAway, whatChanges: whatChangesEntering(next) };
    }
  }

  // ── Deterministic FI date (base case) ───────────────────────────────────────
  const fiPt = findCashflowFiPoint(snapshot, config, live);
  const fiDate = fiPt?.date ?? null;

  // ── Things to keep in mind ──────────────────────────────────────────────────
  const keepInMind: string[] = [];
  if (alloc.concentration >= 0.4 && concSym) {
    keepInMind.push(`${Math.round(alloc.concentration * 100)}% of your investable assets sit in ${concSym} — a concentrated bet. Your divestment plan trims this over time; a daily swing here moves your whole number.`);
  }
  // (The phase transition gets its own "Where you are" block, so it isn't repeated here.)
  if (fiDate) keepInMind.push(`Base case: your plan funds a full stop by ${fiDate}. Open the Risk view for the odds-adjusted date.`);
  else keepInMind.push(`The base case doesn't yet reach a fully-funded stop in the horizon — more runway or lower spending moves it in.`);
  if (dayChangePct != null && Math.abs(dayChangePct) >= 0.02) {
    keepInMind.push(`Today's ${dayChangePct >= 0 ? "gain" : "drop"} of ${(Math.abs(dayChangePct) * 100).toFixed(1)}% is noise at your horizon — the plan is built to ride sequences like this. Zoom out.`);
  }

  // ── Holdings notes (v1: notable moves; real headlines are a later add-on) ────
  const holdingsNotes: string[] = [];
  for (const m of movers.slice(0, 4)) {
    holdingsNotes.push(`${m.symbol} ${m.changePct >= 0 ? "+" : ""}${(m.changePct * 100).toFixed(1)}% today (${usd(m.value)} position).`);
  }
  if (!holdingsNotes.length) holdingsNotes.push("No outsized moves in your holdings today — a quiet session.");

  // ── Seasonal note ───────────────────────────────────────────────────────────
  const seasonalNote = `${calendarSeason(now.getMonth())} — ${current?.focus ?? "stay the course and keep compounding."}`;

  // ── Milestones — the human-and-financial moments worth marking ──────────────
  const fiYear = fiDate ? Number(fiDate.split(" ")[1]) || null : null;
  const milestones = detectMilestones({
    now, config, seasons, currentIndex: idx,
    investable: nw.investable,
    concentration: alloc.concentration,
    concentratedSymbol: concSym,
    equityOn: config.use_equity_comp === true,
    fiYear,
  });

  // ── Editorial lede (deterministic default; the route may swap in an AI one) ──
  const editorial = composeEditorial({
    greetingName: input.profile?.displayName?.split(" ")[0] ?? null,
    dayChangePct,
    featured: milestones[0] ?? null,
    season: calendarSeason(now.getMonth()),
  });

  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return {
    dateLabel,
    greetingName: input.profile?.displayName?.split(" ")[0] ?? null,
    portfolio: {
      investable: nw.investable,
      netWorth: nw.netWorth,
      concentrationPct: alloc.concentration,
      concentratedSymbol: concSym,
      dayChange,
      dayChangePct,
      pricedCoverage,
      movers,
    },
    framing: {
      seasonName: current?.name ?? "Your plan",
      seasonLabel: current?.label ?? "",
      tagline: current?.tagline ?? "",
      permission: current?.permission ?? "",
      focus: current?.focus ?? "",
      actions: (current?.actions ?? []).slice(0, 3),
      intensity: current?.intensity ?? 0,
    },
    phaseAlert,
    fiDate,
    editorial,
    milestones,
    keepInMind,
    holdingsNotes,
    seasonalNote,
  };
}

/** A short editorial lede with a little personality. Deterministic but varied by
 *  the day's mood + the featured milestone, so it never reads like a form letter. */
function composeEditorial(a: { greetingName: string | null; dayChangePct: number | null; featured: Milestone | null; season: string }): string {
  const mood = a.dayChangePct == null ? "The market's quiet this morning"
    : a.dayChangePct >= 0.005 ? "Green on the screen this morning"
    : a.dayChangePct <= -0.005 ? "A little red on the tape — which, at your horizon, means almost nothing"
    : "The tape's flat this morning";
  // The featured milestone gets its own block below, so the lede only sets the
  // mood and points at it — it never repeats the milestone's words.
  if (a.featured) {
    return `${mood} — but the number isn't the headline today. There's a marker on the calendar worth more than any single session.`;
  }
  return `${mood}. A good ${a.season.toLowerCase()} morning to keep the plan boring and the compounding loud.`;
}

export function usd(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(2)}M`
    : abs >= 1_000 ? `$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`
    : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}

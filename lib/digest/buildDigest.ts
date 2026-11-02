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
  runSimulation,
  type FinancialSnapshot,
  type SimulationConfiguration,
  type PlanHealth,
} from "@/engine/calculator";
import { runMonteCarlo } from "@/engine/montecarlo";
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
  /** Reassurance that the plan still holds — health + a plain-language line. */
  plan: { health: PlanHealth; headline: string; reassurance: string };
  /** Monte Carlo odds of funding the plan to 100, with the day-over-day change.
   *  deltaPts is null on the first brief (no prior value to compare against). */
  monteCarlo: { successRate: number; deltaPts: number | null };
  /** "If your stocks do better, you could move your date up" — null if no gain. */
  upside: { betterFiYear: number; yearsEarlier: number | null; note: string } | null;
  /** Today's key figures — the send route persists these so tomorrow's brief can
   *  show the day-over-day deltas (Monte Carlo odds especially). */
  metrics: { ymd: string; mcSuccess: number; investable: number; fiYear: number | null };
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
  /** Yesterday's brief figures (the send route loads them from the user doc), so
   *  the brief can report the day-over-day change in the Monte Carlo odds. */
  previous?: { mcSuccess?: number | null; investable?: number | null; fiYear?: number | null } | null;
  /** Monte Carlo paths for the odds number. Fixed seed, so the day-over-day delta
   *  reflects real plan/price moves, not sampling noise. Default 400. */
  monteCarloRuns?: number;
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
  const base = runSimulation(snapshot, config, live);
  const fiPt = findCashflowFiPoint(snapshot, config, live, base);
  const fiDate = fiPt?.date ?? null;
  const fiYearBase = fiDate ? Number(fiDate.split(" ")[1]) || null : null;

  // ── "If your stocks do better" — recompute the FI year under hotter returns ──
  // Nudge the concentrated position's growth (and the diversified rate a touch)
  // up by a few points and see whether a funded exit pulls forward. This is the
  // reassuring, actionable bit: good markets could move the date up.
  const better: SimulationConfiguration = {
    ...structuredClone(config),
    market_assumptions: {
      ...config.market_assumptions,
      goog_growth_rate: (config.market_assumptions.goog_growth_rate ?? 0) + (config.use_equity_comp ? 3 : 0),
      market_return_rate: (config.market_assumptions.market_return_rate ?? 0) + 1.5,
    },
  };
  const betterFiPt = findCashflowFiPoint(snapshot, better, live);
  const betterFiYear = betterFiPt ? Number(betterFiPt.date.split(" ")[1]) || null : null;
  let upside: Digest["upside"] = null;
  // Only a forward move counts: the better year must be this year or later AND
  // earlier than the base case (you can't pull a date into the past).
  if (betterFiYear != null && betterFiYear >= now.getFullYear() && (fiYearBase == null || betterFiYear < fiYearBase)) {
    const yearsEarlier = fiYearBase != null ? fiYearBase - betterFiYear : null;
    upside = {
      betterFiYear,
      yearsEarlier,
      note: fiYearBase == null
        ? `Here's the upside: if markets run a few points hotter than planned, a fully-funded exit shows up around ${betterFiYear} — where the base case doesn't reach one yet. Worth watching the tape with that in mind.`
        : `Here's the upside: if your stocks compound a few points faster than planned, a funded exit moves up to ~${betterFiYear}${yearsEarlier && yearsEarlier >= 1 ? ` — about ${yearsEarlier} year${yearsEarlier === 1 ? "" : "s"} sooner` : ""}. If the market keeps cooperating, it's worth revisiting whether you could pull the date forward.`,
    };
  }

  // ── Monte Carlo odds of funding to 100, + the day-over-day change ───────────
  // Fixed seed (runMonteCarlo's default) → the number only moves when the plan or
  // prices move, so the delta since yesterday is signal, not sampling jitter.
  const mcSuccess = runMonteCarlo(snapshot, config, live, { runs: input.monteCarloRuns ?? 400 }).successRate;
  const prevMc = input.previous?.mcSuccess;
  const monteCarlo = {
    successRate: mcSuccess,
    deltaPts: prevMc != null ? (mcSuccess - prevMc) * 100 : null,
  };

  // ── Plan reassurance — keyed off the HONEST odds, not just the median path ──
  const plan = composePlan(mcSuccess, fiDate);

  // ── Things to keep in mind ──────────────────────────────────────────────────
  const keepInMind: string[] = [];
  if (alloc.concentration >= 0.4 && concSym) {
    keepInMind.push(`${Math.round(alloc.concentration * 100)}% of your investable assets sit in ${concSym} — a concentrated bet. Your divestment plan trims this over time; a daily swing here moves your whole number.`);
  }
  // (The phase transition and the FI date get their own blocks, so they aren't repeated here.)
  if (dayChangePct != null && Math.abs(dayChangePct) >= 0.02) {
    keepInMind.push(`Today's ${dayChangePct >= 0 ? "gain" : "drop"} of ${(Math.abs(dayChangePct) * 100).toFixed(1)}% is noise at your horizon — the plan is built to ride sequences like this. Zoom out.`);
  }
  if (!keepInMind.length) keepInMind.push("Nothing urgent on the board. Most days the best move is no move — keep the plan boring and let it compound.");

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
    plan,
    monteCarlo,
    upside,
    metrics: {
      ymd: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      mcSuccess,
      investable: nw.investable,
      fiYear: fiYearBase,
    },
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

/** Plain-language reassurance keyed off the Monte Carlo odds — the honest,
 *  sequence-risk-aware number — so the prose never oversells a shaky plan next to
 *  a low success rate. `health` is derived here for the UI chip color. */
function composePlan(mcSuccess: number, fiDate: string | null): Digest["plan"] {
  const pct = Math.round(mcSuccess * 100);
  const fi = fiDate ? ` A fully-funded stop pencils out by ${fiDate}.` : "";
  if (mcSuccess >= 0.88) {
    return {
      health: "on-track",
      headline: "Your plan is intact.",
      reassurance: `The odds back it up — about ${pct}% of simulated market paths fund every expense to 100, mortgage and healthcare included.${fi} Nothing on the tape today changes that.`,
    };
  }
  if (mcSuccess >= 0.72) {
    return {
      health: "on-track",
      headline: "Your plan is in good shape.",
      reassurance: `Roughly ${pct}% of randomized market paths fund the whole thing to 100 — a solid base with a little room to firm up.${fi}`,
    };
  }
  if (mcSuccess >= 0.55) {
    return {
      health: "tight",
      headline: "Your plan works — with real sequence risk.",
      reassurance: `The median path funds to 100, but only about ${pct}% of randomized paths do; a rough early decade is the thing to respect.${fi} Keeping spending and the exit date a little flexible is the whole game here.`,
    };
  }
  return {
    health: "shortfall",
    headline: "The odds need shoring up — not a crisis.",
    reassurance: `About ${pct}% of market paths fund to 100 right now, so a bad sequence would bite.${fiDate ? "" : " There's no fully-funded stop date in view yet."} More runway, slightly lower spending, or stronger returns moves it — and you've got levers for all three.`,
  };
}

export function usd(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(2)}M`
    : abs >= 1_000 ? `$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`
    : `$${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}

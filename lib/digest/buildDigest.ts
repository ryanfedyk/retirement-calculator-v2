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
import { detectMilestones, orderMilestones, type Milestone, type MilestoneKind } from "@/lib/digest/milestones";

export interface QuoteLike { price: number; previousClose: number | null; changePct: number | null }

/** The broad market's recent regime, read from the trailing ~1-month return, so
 *  the copy reflects what's actually happening instead of assuming good weather. */
export type MarketRegime = "drawdown" | "risk-on" | "range-bound" | "unknown";

function regimeOf(oneMonthPct: number | null): MarketRegime {
  if (oneMonthPct == null) return "unknown";
  if (oneMonthPct <= -0.03) return "drawdown";
  if (oneMonthPct >= 0.03) return "risk-on";
  return "range-bound";
}

/** Broad-market indices fetched alongside holdings to give the "market & months
 *  ahead" synthesis some real conditions to read. Yahoo symbols. */
export const MARKET_INDICES: { symbol: string; label: string }[] = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
];

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
  /** The scannable "what's new today" summary at the top, most important first. */
  roundup: string[];
  /** A synthesis of market conditions + a measured outlook for the months ahead.
   *  Deterministic default; the send route swaps in an AI-written one. */
  marketOutlook: string;
  /** Broad-market read used by the outlook (and shown as a compact line). Includes
   *  the trailing ~1-month move and the regime derived from it, so copy can reflect
   *  an actual up/down/flat stretch rather than assuming the market is cooperating. */
  marketContext: {
    indices: { symbol: string; label: string; changePct: number | null }[];
    oneMonthPct: number | null;
    regime: MarketRegime;
  };
  /** The day's motivational "thought" — a rotating public-domain quote by default;
   *  the send route may swap in an AI-written original line (attribution null). */
  motivation: { quote: string; attribution: string | null };
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
  /** The broad market's trailing ~1-month return (the route fetches it), so the
   *  brief can read the current regime and stop assuming markets are "cooperating."
   *  Absent → regime "unknown" and the outlook falls back to a direction-neutral read. */
  marketTrend?: { oneMonthPct: number | null } | null;
  /** Monte Carlo paths for the odds number. Fixed seed, so the day-over-day delta
   *  reflects real plan/price moves, not sampling noise. Default 400. */
  monteCarloRuns?: number;
}

const MOVER_THRESHOLD = 0.01;     // |1%| counts as a notable daily move
const PHASE_ALERT_MONTHS = 12;    // alert when the next season starts within a year

// Public-domain quotes (ancient/old authors) — safe to reproduce with attribution.
// Rotated by day-of-year so each day differs and it's stable within a day.
const DAILY_QUOTES: { quote: string; attribution: string }[] = [
  { quote: "We suffer more often in imagination than in reality.", attribution: "Seneca" },
  { quote: "The impediment to action advances action. What stands in the way becomes the way.", attribution: "Marcus Aurelius" },
  { quote: "Wealth consists not in having great possessions, but in having few wants.", attribution: "Epictetus" },
  { quote: "It is not that we have a short time to live, but that we waste a lot of it.", attribution: "Seneca" },
  { quote: "Go confidently in the direction of your dreams. Live the life you have imagined.", attribution: "Henry David Thoreau" },
  { quote: "The best time to plant a tree was twenty years ago. The second best time is now.", attribution: "Proverb" },
  { quote: "Do not spoil what you have by desiring what you have not.", attribution: "Epicurus" },
  { quote: "A journey of a thousand miles begins with a single step.", attribution: "Lao Tzu" },
  { quote: "Nature does not hurry, yet everything is accomplished.", attribution: "Lao Tzu" },
  { quote: "Begin at once to live, and count each separate day as a separate life.", attribution: "Seneca" },
  { quote: "Patience is bitter, but its fruit is sweet.", attribution: "Aristotle" },
  { quote: "First say to yourself what you would be; and then do what you have to do.", attribution: "Epictetus" },
  { quote: "He who is not contented with what he has would not be contented with what he would like to have.", attribution: "Socrates" },
  { quote: "The whole future lies in uncertainty: live immediately.", attribution: "Seneca" },
  { quote: "Well-being is realized by small steps, but is truly no small thing.", attribution: "Zeno of Citium" },
  { quote: "Luck is what happens when preparation meets opportunity.", attribution: "Seneca" },
  { quote: "Waste no more time arguing what a good person should be. Be one.", attribution: "Marcus Aurelius" },
  { quote: "That which is not good for the hive is not good for the bee.", attribution: "Marcus Aurelius" },
];

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
  // Day-of-year drives the daily rotation of the featured milestone, the lede, and
  // the thought — stable within a day, different the next, so nothing repeats.
  const dayOfYear = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86400000);
  const oneMonthPct = input.marketTrend?.oneMonthPct ?? null;
  const regime = regimeOf(oneMonthPct);

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
    // Keep this about the LONG-RUN assumption beating plan — not "if the market
    // keeps cooperating," which reads tone-deaf in a down stretch. Acknowledge a
    // soft tape when that's the reality.
    const softNote = regime === "drawdown"
      ? " Markets have been soft lately, so hold this as a long-run possibility, not a read on the current tape."
      : "";
    upside = {
      betterFiYear,
      yearsEarlier,
      note: fiYearBase == null
        ? `Here's the upside: if your long-run returns land a few points above the plan's assumptions, a fully-funded exit could show up around ${betterFiYear} — where the base case doesn't reach one yet.${softNote}`
        : `Here's the upside: if your investments compound a few points faster than the plan assumes, a funded exit moves up to ~${betterFiYear}${yearsEarlier && yearsEarlier >= 1 ? ` — about ${yearsEarlier} year${yearsEarlier === 1 ? "" : "s"} sooner` : ""}. Worth revisiting the date against the long-run trend, not any single week.${softNote}`,
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
  const detected = detectMilestones({
    now, config, seasons, currentIndex: idx,
    investable: nw.investable,
    concentration: alloc.concentration,
    concentratedSymbol: concSym,
    equityOn: config.use_equity_comp === true,
    fiYear,
  });
  // Rotate the featured milestone by day so the brief doesn't headline the same
  // "Nth-to-last autumn" every single morning for a whole season.
  const milestones = orderMilestones(detected, dayOfYear);

  // ── Editorial lede (deterministic default; the route may swap in an AI one) ──
  const editorial = composeEditorial({
    dayChangePct,
    featured: milestones[0] ?? null,
    season: calendarSeason(now.getMonth()),
    dayOfYear,
    regime,
  });

  // ── Market context (broad indices) + a measured outlook ─────────────────────
  const indices = MARKET_INDICES.map((ix) => ({ symbol: ix.symbol, label: ix.label, changePct: quotes[ix.symbol]?.changePct ?? null }));
  const marketContext = { indices, oneMonthPct, regime };
  const marketOutlook = composeMarketOutlook(indices, alloc.concentration, concSym, oneMonthPct, regime);

  // ── The roundup — the scannable "what's new" at the very top ─────────────────
  const roundup: string[] = [];
  if (dayChange != null && dayChangePct != null) {
    const mcBit = monteCarlo.deltaPts != null && Math.abs(monteCarlo.deltaPts) >= 0.1
      ? `, funding odds ${Math.round(mcSuccess * 100)}% (${monteCarlo.deltaPts > 0 ? "▲" : "▼"}${Math.abs(monteCarlo.deltaPts).toFixed(1)} pts)`
      : ` (${Math.round(mcSuccess * 100)}% funding odds)`;
    roundup.push(`Portfolio ${dayChange >= 0 ? "▲" : "▼"} ${usd(dayChange)} (${dayChangePct >= 0 ? "+" : "−"}${(Math.abs(dayChangePct) * 100).toFixed(1)}%) today${mcBit}.`);
  } else {
    roundup.push(`Funding odds ${Math.round(mcSuccess * 100)}% — ${plan.headline.replace(/\.$/, "").toLowerCase()}.`);
  }
  if (milestones[0]) roundup.push(`Milestone: ${milestones[0].headline}.`);
  if (movers[0] && Math.abs(movers[0].changePct) >= 0.02) {
    roundup.push(`${movers[0].symbol} ${movers[0].changePct >= 0 ? "led" : "lagged"} your holdings (${movers[0].changePct >= 0 ? "+" : ""}${(movers[0].changePct * 100).toFixed(1)}%).`);
  }
  if (upside) roundup.push(`Hotter markets could pull a funded exit to ~${upside.betterFiYear}.`);

  // ── Thought for the day — a rotating public-domain quote (stable within a day) ─
  const motivation = { ...DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length] };

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
    roundup,
    marketOutlook,
    marketContext,
    motivation,
    milestones,
    keepInMind,
    holdingsNotes,
    seasonalNote,
  };
}

/** A measured, non-advice read of conditions + the months ahead. Deterministic
 *  fallback; the send route swaps in an AI-written version when Gemini is up. Reads
 *  the actual regime (trailing month) so it never pretends to good weather. */
function composeMarketOutlook(
  indices: { label: string; changePct: number | null }[],
  concentration: number,
  concSym: string,
  oneMonthPct: number | null,
  regime: MarketRegime,
): string {
  const named = indices.filter((i) => i.changePct != null);
  const tape = named.length
    ? named.map((i) => `${i.label} ${i.changePct! >= 0 ? "+" : "−"}${(Math.abs(i.changePct!) * 100).toFixed(1)}%`).join(", ")
    : "a quiet tape";
  const concLine = concSym && concentration >= 0.3
    ? ` With ~${Math.round(concentration * 100)}% in ${concSym}, your ride stays bumpier than the index until the diversification plan trims it.`
    : "";
  const mo = oneMonthPct != null ? Math.abs(Math.round(oneMonthPct * 100)) : null;
  const regimeLine =
    regime === "drawdown"
      ? `Stepping back: the broad market is down about ${mo}% over the past month — a real pullback, and an ordinary (if uncomfortable) part of the cycle. Drawdowns like this are the toll equities charge for their long-run returns, not a sign the plan is broken.`
      : regime === "risk-on"
      ? `Stepping back: the broad market is up about ${mo}% over the past month. Pleasant — but a strong month isn't a trend, and the plan doesn't need heroics, just time.`
      : regime === "range-bound"
      ? `Stepping back: the broad market has been roughly flat over the past month — the quiet kind of stretch where compounding does its work without drama.`
      : `The months ahead will bring their share of green and red — that's the normal weather of markets, not a signal.`;
  return `Today: ${tape}.${concLine} ${regimeLine} Your plan is built to fund a long retirement across a wide range of outcomes, so the useful posture is boring: keep contributing, let the divestment schedule do its quiet work, and judge progress by the funding odds over quarters, not by any single week's tape.`;
}

/** A one-line tease of what the featured milestone is about — WITHOUT repeating its
 *  headline (which has its own block). Lets the lede point at the day's milestone in
 *  fresh words, and it changes as the featured milestone rotates day to day. */
function milestoneTease(kind: MilestoneKind, season: string): string {
  switch (kind) {
    case "season":        return `you're another ${season} deeper into the back nine of working life`;
    case "review":        return `review season is a lever this year, not just a ritual`;
    case "concentration": return `the concentration keeps quietly easing in the background`;
    case "fi":            return `a funded finish line keeps inching closer`;
    case "phase":         return `a new chapter of the wind-down is basically here`;
    case "newyear":       return `a clean page — a good moment to reconnect with the why`;
    case "yearend":       return `the year's into its home stretch`;
    case "networth":      return `the number just cleared a round mark worth a nod`;
    default:              return `there's a thread worth more than any single session`;
  }
}

/** A short editorial lede with personality. Deterministic but genuinely varied:
 *  it builds a pool of mood-, milestone-, regime-, and season-aware openers and
 *  rotates by day-of-year, so consecutive mornings never read the same. */
function composeEditorial(a: {
  dayChangePct: number | null;
  featured: Milestone | null;
  season: string;
  dayOfYear: number;
  regime: MarketRegime;
}): string {
  const season = a.season.toLowerCase();
  const pool: string[] = [];

  // Regime-aware openers — honest about a soft (or hot) tape.
  if (a.regime === "drawdown") {
    pool.push(`Markets have been heavy lately — less a warning than a weather report. Your plan was built to walk through exactly this.`);
    pool.push(`It's been a red stretch out there, and that's alright: the plan is measured in decades, and decades include months like this one.`);
  } else if (a.regime === "risk-on") {
    pool.push(`The tape's been generous lately — enjoy it, but the plan doesn't need the good months, only time.`);
  }

  // Milestone-aware openers — point at today's featured marker in fresh words.
  if (a.featured) {
    const tease = milestoneTease(a.featured.kind, season);
    pool.push(`Look up from the ticker for a second — ${tease}.`);
    pool.push(`The numbers will take care of themselves today; the part worth a beat is further down — ${tease}.`);
    pool.push(`One to actually notice this morning: ${tease}.`);
  }

  // Mood-of-the-day openers — today's tape, lightly held.
  if (a.dayChangePct != null) {
    if (a.dayChangePct >= 0.005) pool.push(`Green on the screen this morning — pleasant, and nearly beside the point at your horizon.`);
    else if (a.dayChangePct <= -0.005) pool.push(`A little red on the tape, which at your horizon rounds to noise. Onward.`);
    else pool.push(`A flat open — the quiet kind of morning where compounding does the real work.`);
  }

  // Evergreen seasonal openers — always available so the pool is never empty.
  pool.push(`A good ${season} morning to keep the plan boring and the compounding loud.`);
  pool.push(`Another ${season} morning on the glide path — steady hands, long view.`);

  return pool[a.dayOfYear % pool.length];
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

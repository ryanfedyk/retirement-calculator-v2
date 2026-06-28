import type { SimulationConfiguration } from "@/engine/calculator";

// ── Season model ──────────────────────────────────────────────────────────────
export type SeasonType = "taper" | "sabbatical" | "jump" | "bridge" | "retired";

export interface Season {
  id: number;
  type: SeasonType;
  name: string;        // e.g. "The Structural Architect"
  label: string;       // e.g. "2026–2027"
  startYear: number;
  endYear: number;     // exclusive-ish boundary for display
  intensity: number;   // 0–100 work intensity / throttle
  tagline: string;
  focus: string;
  actions: string[];
  permission: string;
  color: string;
}

// A signature that uniquely identifies a timeline shape — used for caching the
// Gemini enrichment so we only re-fetch when the plan actually changes.
export function seasonsSignature(config: SimulationConfiguration): string {
  const cp = config.career_path;
  return [
    new Date().getFullYear(),
    cp.exit_year,
    cp.use_sabbatical ? cp.sabbatical_duration : 0,
    cp.use_jump ? cp.jump_duration : 0,
    cp.use_bridge ? cp.bridge_duration : 0,
  ].join("-");
}

// Palette — first four match C.phase (taper greens); later ones distinguish
// the post-career-exit phase types.
const PALETTE = {
  taper:      ["#1e4a3e", "#2d7a66", "#4aab92", "#80c4ae"],
  sabbatical: "#d98a3d",
  jump:       "#2a9d7f",
  bridge:     "#3a7d9c",
  retired:    "#7a6da8",
};

// When you're still several years out, there's no reason to ease off — this is
// the "bank peak earnings" season that fills the runway BEFORE the wind-down.
const PEAK_CAREER = {
  name: "Peak Career", intensity: 95,
  tagline: "Full throttle. You're still years out — bank peak earnings while you can.",
  focus: "Compound earnings and equity; there's no need to taper yet.",
  permission: "You are permitted to go all-in — the wind-down comes later, not now.",
  actions: [
    "Max out every tax-advantaged account while the income is high.",
    "Push for the comp, scope, and equity you've earned.",
    "Bank the surplus — every year now shortens the glide later.",
    "Note what energizes vs. drains you; it informs the taper to come.",
  ],
};

// Wind-down archetypes for the FINAL years before exit — ordered most→least
// intensive, so the last season is always "The Ultimate Offramp".
const TAPER_ARCHETYPES = [
  {
    name: "The Structural Architect", intensity: 85,
    tagline: "Build systems. Remove yourself as the single point of failure.",
    focus: "Remove yourself as the single point of failure.",
    permission: "You are permitted to stop attending meetings where your presence is optional.",
    actions: [
      "Document every key process you own — start this week.",
      "Identify your top reports and begin deliberate succession prep.",
      "Stop being the default escalation path. Route decisions downstream.",
      "Write down what only you know. That list is your delegation backlog.",
    ],
  },
  {
    name: "The Radical Delegator", intensity: 65,
    tagline: "Force autonomy downstream. Exit the firefighting loop.",
    focus: "Force autonomy. Stop rescuing people from their own decisions.",
    permission: "You are permitted to let imperfect decisions stand without intervening.",
    actions: [
      "Remove yourself from at least two recurring meetings this month.",
      "Let a decision made without you stand — even if imperfect.",
      "Stop responding to messages after 6pm. Permanently.",
      "Measure your team's autonomy, not your own heroism.",
    ],
  },
  {
    name: "The Sovereign Advisor", intensity: 40,
    tagline: "Air cover only. Succession planning. Calendar opens up.",
    focus: "Become the advisor, not the operator.",
    permission: "You are permitted to take a full week off without checking in.",
    actions: [
      "Protect 40% unscheduled white space on your calendar.",
      "Begin the formal succession conversation with HR.",
      "Ask 'What do you think?' instead of answering. Every time.",
      "Start a private exit memo — what the org must know before you leave.",
    ],
  },
  {
    name: "The Ultimate Offramp", intensity: 20,
    tagline: "Pure glide-slope. Documentation, handoff, and exit with grace.",
    focus: "Execute the glide slope. Nothing new, everything handed off.",
    permission: "You are permitted to say no to anything that doesn't serve the handoff.",
    actions: [
      "Documentation sprint: every system, contact, and context written down.",
      "No new long-term commitments. Zero.",
      "Plan a proper farewell — not a ghost exit.",
      "Schedule your last day and count backward from it.",
    ],
  },
];

// Default content for each post-career-exit phase type.
const POST_DEFAULTS: Record<Exclude<SeasonType, "taper">, Omit<Season, "id" | "label" | "startYear" | "endYear" | "color" | "type">> = {
  sabbatical: {
    name: "The Sabbatical", intensity: 0,
    tagline: "A deliberate pause. Decompress, reconnect, and rediscover what you want.",
    focus: "Fully detach from work identity and recover your baseline.",
    permission: "You are permitted to do absolutely nothing productive and call it success.",
    actions: [
      "Take the first month with zero plans. Let the nervous system reset.",
      "Reconnect with people and hobbies that work crowded out.",
      "Notice what you reach for when no one is asking anything of you.",
      "Travel slowly — depth over itinerary.",
    ],
  },
  jump: {
    name: "The Career Jump", intensity: 70,
    tagline: "A high-agency second act. Equity upside on your own terms.",
    focus: "Channel experience into a venture you actually own.",
    permission: "You are permitted to bet on yourself without a corporate safety net.",
    actions: [
      "Define the smallest version of the bet that proves the thesis.",
      "Protect your downside — keep fixed costs low while you ramp.",
      "Build with people you'd want in the foxhole.",
      "Set a clear date to evaluate: is this working?",
    ],
  },
  bridge: {
    name: "The Bridge Role", intensity: 40,
    tagline: "Lower-intensity work that bridges income and full retirement.",
    focus: "Trade peak earnings for autonomy and a softer landing.",
    permission: "You are permitted to optimize for ease and meaning over title and pay.",
    actions: [
      "Choose work that fits your life, not the reverse.",
      "Negotiate flexibility explicitly — days, hours, location.",
      "Keep one foot in the game without carrying the whole org.",
      "Use the steady income to delay drawing down investments.",
    ],
  },
  retired: {
    name: "Full Retirement", intensity: 0,
    tagline: "The chapter everything was built for. Time is now fully yours.",
    focus: "Live the life the entire plan was designed to fund.",
    permission: "You are permitted to measure days by presence, not productivity.",
    actions: [
      "Build a weekly rhythm around people, health, and curiosity.",
      "Give your time to things that compound meaning, not money.",
      "Revisit the plan annually — adjust spending to reality.",
      "Be fully present. You earned this.",
    ],
  },
};

/**
 * Build the deterministic season timeline from the retirement model.
 * Spans from this year through the final post-exit phase. This is the
 * source of truth for year ranges; Gemini (when available) enriches the
 * names/taglines/actions but the structure here always renders.
 */
export function buildSeasons(config: SimulationConfiguration): Season[] {
  const cp = config.career_path;
  const nowYear = new Date().getFullYear();
  const seasons: Season[] = [];
  let id = 0;

  // ── Career runway: now → exit_year ────────────────────────────────────────
  // The active wind-down (delegating, succession, glide-slope) belongs in the
  // FINAL few years — not the moment someone is still 4+ years out. So fill the
  // lead years with a single "Peak Career" season and reserve the taper
  // archetypes (ending in "Ultimate Offramp") for the last ~3 years.
  const exit = cp.exit_year;
  const taperSpan = Math.max(0, exit - nowYear);
  const WIND_DOWN_MAX = 3;

  if (taperSpan > 0) {
    const windDown = Math.min(WIND_DOWN_MAX, taperSpan); // final years that actually taper
    const leadSpan = taperSpan - windDown;               // steady "peak" years before it

    // Lead season: still years out → no need to ease off yet.
    if (leadSpan > 0) {
      seasons.push({
        id: id++, type: "taper", ...PEAK_CAREER,
        label: leadSpan === 1 ? `${nowYear}` : `${nowYear}–${nowYear + leadSpan}`,
        startYear: nowYear, endYear: nowYear + leadSpan,
        color: PALETTE.taper[0],
      });
    }

    // Wind-down: one archetype per remaining year, ending in "Ultimate Offramp".
    // A gentle 3-step (build systems → advise → glide); the most aggressive
    // "Radical Delegator" is reserved and not shown years out.
    const WIND_DOWN = [TAPER_ARCHETYPES[0], TAPER_ARCHETYPES[2], TAPER_ARCHETYPES[3]];
    const archetypes = WIND_DOWN.slice(WIND_DOWN.length - windDown);
    for (let i = 0; i < windDown; i++) {
      const start = nowYear + leadSpan + i;
      const a = archetypes[i];
      seasons.push({
        id: id++, type: "taper", ...a,
        label: `${start}`,
        startYear: start, endYear: start + 1,
        color: PALETTE.taper[Math.min(3, 4 - windDown + i)],
      });
    }
  }

  // ── Post-exit career phases ─────────────────────────────────────────────
  let cursor = exit;
  const pushPost = (type: Exclude<SeasonType, "taper" | "retired">, dur: number) => {
    if (dur <= 0) return;
    const d = POST_DEFAULTS[type];
    seasons.push({
      id: id++, type, ...d,
      label: dur === 1 ? `${cursor}` : `${cursor}–${cursor + dur}`,
      startYear: cursor, endYear: cursor + dur,
      color: PALETTE[type],
    });
    cursor += dur;
  };

  if (cp.use_sabbatical) pushPost("sabbatical", cp.sabbatical_duration);
  if (cp.use_jump)       pushPost("jump",       cp.jump_duration);
  if (cp.use_bridge)     pushPost("bridge",     cp.bridge_duration);

  // ── Full retirement (open-ended) ──────────────────────────────────────────
  const r = POST_DEFAULTS.retired;
  seasons.push({
    id: id++, type: "retired", ...r,
    label: `${cursor}+`, startYear: cursor, endYear: cursor + 1,
    color: PALETTE.retired,
  });

  return seasons;
}

/** Index of the season that contains the current calendar year. */
export function currentSeasonIndex(seasons: Season[]): number {
  const y = new Date().getFullYear();
  const idx = seasons.findIndex(s => y >= s.startYear && y < s.endYear);
  if (idx >= 0) return idx;
  // Before the first season → 0; after the last → last.
  return y < seasons[0]?.startYear ? 0 : seasons.length - 1;
}

/**
 * Guided-wizard logic for Perfect Day / Perfect Year.
 *
 * The wizards walk a user to the *payoff* with as little reading and setup as
 * possible: pick a few days that sound like you → see what your retirement is
 * really about; pick a few kinds of experiences → see a year take shape. These
 * pure helpers produce the choices the wizard offers and the instant, rules-only
 * synthesis behind each reveal (no AI round-trip, so a reveal never stalls or
 * depends on a key being configured — the richer AI read still lives in the
 * detailed editor for anyone who wants to go deeper).
 */
import {
  ACTIVITY_BY_ID, type ActivityCategory, type PerfectDayItem,
} from "@/lib/perfectDay";
import type { SeedInputs } from "@/lib/perfectSeed";
import { ADVENTURE_SEEDS } from "@/data/adventureSeeds";
import type { AdventureBlueprint, AdventureCategory } from "@/types/horizon";

const joinNames = (names: string[]): string => {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`;
};

// ── Perfect-Day archetypes ────────────────────────────────────────────────────
// A short menu of fully-formed days the wizard offers as tap-to-choose cards, so
// the user assembles rich days without ever opening an activity picker. The
// "connected" day is personalized to the household; the rest are universal.
export function dayArchetypes(inp: SeedInputs): PerfectDayItem[] {
  const kids = inp.childNames.length > 0;
  const names = joinNames(inp.childNames);
  const connectedName = kids
    ? `A day with ${names}`
    : inp.hasPartner ? "A day with the people you love" : "A slow, connected day";

  return [
    {
      id: "arch-connected", name: connectedName,
      blocks: {
        morning:   ["coffeeritual", "walk"],
        afternoon: kids || inp.hasPartner ? ["grandkids", "cook"] : ["coffee", "cook"],
        evening:   inp.hasPartner ? ["datenight", "shows"] : ["dinner", "shows"],
      },
    },
    {
      id: "arch-yours", name: "A day that's yours",
      blocks: { morning: ["walk", "read"], afternoon: ["passion", "hike"], evening: ["instrument", "journal"] },
    },
    {
      id: "arch-adventure", name: "An adventurous day",
      blocks: { morning: ["hike"], afternoon: ["daytrip", "photo"], evening: ["lunchout", "journal"] },
    },
    {
      id: "arch-purpose", name: "A day of purpose",
      blocks: { morning: ["walk", "coffeeritual"], afternoon: ["volunteer", "mentor"], evening: ["cook", "read"] },
    },
    {
      id: "arch-restful", name: "A restful day",
      blocks: { morning: ["coffeeritual", "yoga"], afternoon: ["read", "nap"], evening: ["spa", "shows"] },
    },
  ];
}

/** A one-line, human vignette of a day — "Slow coffee, a walk, then time with
 *  family and dinner with friends" — for the archetype cards. */
export function dayVignette(d: PerfectDayItem, max = 4): string {
  const ids = [...d.blocks.morning, ...d.blocks.afternoon, ...d.blocks.evening];
  const labels = ids.map((id) => ACTIVITY_BY_ID[id]?.label.toLowerCase()).filter(Boolean) as string[];
  const seen = new Set<string>();
  const uniq = labels.filter((l) => (seen.has(l) ? false : (seen.add(l), true))).slice(0, max);
  if (uniq.length === 0) return "";
  if (uniq.length === 1) return cap(uniq[0]);
  return cap(`${uniq.slice(0, -1).join(", ")} and ${uniq[uniq.length - 1]}`);
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ── Instant, rules-only synthesis (the Perfect-Day reveal) ────────────────────
export type Synthesis = { title: string; essence: string; passions: string[]; themes: string[] };

const THEME: Record<ActivityCategory, { noun: string; passion: string; hash: string }> = {
  Health:    { noun: "vitality",   passion: "Staying active",       hash: "movement" },
  Social:    { noun: "connection", passion: "The people you love",  hash: "connection" },
  Purpose:   { noun: "purpose",    passion: "Work that matters",    hash: "purpose" },
  Learning:  { noun: "growth",     passion: "Always learning",      hash: "growth" },
  Leisure:   { noun: "ease",       passion: "Unhurried pleasures",  hash: "ease" },
  Adventure: { noun: "adventure",  passion: "Adventure & travel",   hash: "adventure" },
  Home:      { noun: "ritual",     passion: "Home & ritual",        hash: "home" },
};

/** Turn the chosen days into a warm, one-glance "what your retirement is about"
 *  read — no AI, so it appears instantly and always works. */
export function synthesizeDays(days: PerfectDayItem[]): Synthesis {
  const counts = new Map<ActivityCategory, number>();
  for (const d of days) {
    for (const id of [...d.blocks.morning, ...d.blocks.afternoon, ...d.blocks.evening]) {
      const a = ACTIVITY_BY_ID[id];
      if (a) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);

  if (ranked.length === 0) {
    return {
      title: "A life that's yours to shape",
      essence: "Pick a couple of days that sound like you and the throughline will appear here.",
      passions: [], themes: [],
    };
  }

  const n1 = THEME[ranked[0]].noun;
  const n2 = ranked[1] ? THEME[ranked[1]].noun : null;
  const title = n2 ? `A life of ${n1} and ${n2}` : `A life of ${n1}`;
  const essence = n2
    ? `The days you picked keep returning to the same things — ${n1} and ${n2}. That's the shape of your retirement: not a to-do list, but a life that makes room for what matters most to you.`
    : `The days you picked keep returning to one thing above all — ${n1}. That's the heart of the retirement you're building toward.`;

  const passions = ranked.slice(0, 4).map((c) => THEME[c].passion);
  const themes = ranked.slice(0, 4).map((c) => THEME[c].hash);
  return { title, essence, passions, themes };
}

// ── Perfect-Year experience kinds & placement ─────────────────────────────────
export const YEAR_CATEGORIES: { id: AdventureCategory; icon: string; blurb: string }[] = [
  { id: "Immersive Travel", icon: "✈️", blurb: "Slow months in a new place, bucket-list regions, family trips." },
  { id: "Creative Mastery",  icon: "🎸", blurb: "The instrument, the studio, the camera, the book in you." },
  { id: "Endurance/Active",  icon: "🏔️", blurb: "Long trails, cycling tours, the body still capable." },
  { id: "Slow Living",       icon: "🌿", blurb: "Gardens, rituals, decelerating into a gentler rhythm." },
];

/** A few representative adventures for the chosen kinds — the deepest-scoring,
 *  most evocative seeds first — for an optional "pick specifics" step. */
export function adventuresForCategories(cats: AdventureCategory[], perCat = 3): AdventureBlueprint[] {
  const out: AdventureBlueprint[] = [];
  for (const cat of cats) {
    const items = ADVENTURE_SEEDS.filter((s) => s.category === cat).sort((a, b) => b.depthScore - a.depthScore);
    out.push(...items.slice(0, perCat));
  }
  return out;
}

// A pleasant spread of months so a placed year feels distributed across seasons
// rather than clumped. Deterministic (no RNG → SSR-safe, resume-safe).
const SPREAD_MONTHS = [8, 0, 5, 3, 9, 6, 1, 10, 4, 2, 7, 11];

/** Place chosen adventure seeds across the year, one per month on a season-spread
 *  cadence, so the reveal calendar looks intentional. */
export function placeAdventures(seedIds: string[]): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  seedIds.forEach((id, i) => {
    const m = SPREAD_MONTHS[i % SPREAD_MONTHS.length];
    out[m] = [...(out[m] ?? []), id];
  });
  return out;
}

/** From selected kinds, auto-pick a handful of seeds and place them — the
 *  one-tap "build my year" path when the user doesn't drill into specifics. */
export function yearFromCategories(cats: AdventureCategory[]): Record<number, string[]> {
  const perCat = cats.length <= 2 ? 3 : 2;
  const seeds = adventuresForCategories(cats, perCat).map((s) => s.id);
  return placeAdventures(seeds);
}

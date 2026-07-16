/**
 * Perfect Day / Perfect Year auto-seeding.
 *
 * Both features used to start from a blank canvas — the user had to hand-build
 * several rich days before the payoff (the "what your retirement is about"
 * synthesis) even unlocked. These pure functions draft a personalized starting
 * point from what Taper already knows (kids, partner), so the user lands on a
 * finished, editable picture instead of an empty grid. Seeded only when empty;
 * a "rebuild" action re-runs them on demand.
 */
import { emptyBlocks, type PerfectDayItem } from "@/lib/perfectDay";

export interface SeedInputs {
  /** Names of the user's children, for personalization (may be empty). */
  childNames: string[];
  /** Whether the household includes a partner/spouse. */
  hasPartner: boolean;
  /** Retirement month (0 = Jan … 11 = Dec), so the seeded year is anchored to
   *  when the new chapter actually begins. Omit/undefined if unknown. */
  exitMonth?: number;
  /** Lowercased life-event names (college years, planned trips…) used to weave a
   *  couple of resonant adventures into the seeded year. */
  lifeEventTags?: string[];
}

/** "Oona & Veda", "Oona, Veda & Mia", or "" — a natural names list. */
function joinNames(names: string[]): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`;
}

/**
 * Three rich, ready-to-read "perfect days" drafted from the household. Each day
 * has 5-6 activities across morning/afternoon/evening, so they clear the
 * "rich" bar (≥3) immediately and the AI culmination fires without any manual
 * building. Activity ids reference the ACTIVITIES catalog in lib/perfectDay.
 */
export function seedPerfectDays(inp: SeedInputs): { days: PerfectDayItem[]; activeId: string } {
  const kids = inp.childNames.length > 0;
  const names = joinNames(inp.childNames);

  const familyName = kids
    ? `A day with ${names}`
    : inp.hasPartner
      ? "A day with the people you love"
      : "A slow, connected day";

  const familyDay: PerfectDayItem = {
    id: "seed-connected",
    name: familyName,
    blocks: {
      morning:   ["coffeeritual", "walk"],
      afternoon: kids || inp.hasPartner ? ["grandkids", "cook"] : ["coffee", "cook"],
      evening:   inp.hasPartner ? ["datenight", "shows"] : ["dinner", "shows"],
    },
  };

  const yourDay: PerfectDayItem = {
    id: "seed-yours",
    name: "A day that's yours",
    blocks: {
      morning:   ["walk", "read"],
      afternoon: ["passion", "hike"],
      evening:   ["instrument", "journal"],
    },
  };

  const adventureDay: PerfectDayItem = {
    id: "seed-adventure",
    name: "An adventurous day",
    blocks: {
      morning:   ["hike"],
      afternoon: ["daytrip", "photo"],
      evening:   ["lunchout", "journal"],
    },
  };

  return { days: [familyDay, yourDay, adventureDay], activeId: familyDay.id };
}

/**
 * A starting "perfect year" — adventures spread across all four seasons and
 * categories (travel / slow living / active / creative), tuned to the household
 * and, when known, anchored to the real retirement month and woven with the
 * user's life events. Seed ids reference data/adventureSeeds. Month 0 = January.
 */
export function seedPerfectYear(inp: SeedInputs): Record<number, string[]> {
  const kids = inp.childNames.length > 0;
  const tags = inp.lifeEventTags ?? [];
  const has = (kw: string) => tags.some((t) => t.includes(kw));

  // Base spread — one adventure per placed month, family-tuned.
  const placed: Record<number, string> = {
    0: "it-02",                    // Jan · Japan winter circuit
    3: "sl-03",                    // Apr · garden-to-table year
    6: kids ? "ea-03" : "ea-04",   // Jul · family backpacking / cycling tour
    7: kids ? "it-04" : "it-03",   // Aug · month in Portugal w/ family / solo city
    8: "it-01",                    // Sep · autumn slow-down in Mallorca
    9: "cm-04",                    // Oct · documentary photography year
  };

  // Life-event weave (only fills otherwise-open months, so it never crowds out
  // the base spread): kids heading to college → a "before they're grown" family
  // train trip; a planned trip/vacation event → an extra bucket-list journey.
  if (kids && (has("college") || has("school")) && !placed[4]) placed[4] = "it-06"; // May
  if ((has("trip") || has("travel") || has("vacation")) && !placed[1]) placed[1] = "it-05"; // Feb · Patagonia

  // Anchor to the real retirement month: the month you actually step away gets a
  // "first year of freedom" seed, so the year visibly begins when your new life
  // does. Takes priority over any base seed in that month.
  const exitM = inp.exitMonth;
  if (exitM != null && exitM >= 0 && exitM <= 11) placed[exitM] = "sl-01"; // Year-One Deceleration Protocol

  const out: Record<number, string[]> = {};
  for (const [m, id] of Object.entries(placed)) out[Number(m)] = [id];
  return out;
}

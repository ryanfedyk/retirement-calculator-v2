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
 * A starting "perfect year" — six adventures spread across all four seasons and
 * all four categories (travel / slow living / active / creative), tuned to
 * whether there are kids. Seed ids reference data/adventureSeeds. Month index
 * 0 = January.
 */
export function seedPerfectYear(inp: SeedInputs): Record<number, string[]> {
  const kids = inp.childNames.length > 0;
  return {
    0: ["it-02"],                          // Jan · Japan winter circuit
    3: ["sl-03"],                          // Apr · garden-to-table year
    6: [kids ? "ea-03" : "ea-04"],         // Jul · family backpacking / cycling tour
    7: [kids ? "it-04" : "it-03"],         // Aug · month in Portugal w/ family / solo city
    8: ["it-01"],                          // Sep · autumn slow-down in Mallorca
    9: ["cm-04"],                          // Oct · documentary photography year
  };
}

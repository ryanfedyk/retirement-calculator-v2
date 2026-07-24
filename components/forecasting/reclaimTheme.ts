// "Composing a life" — the design language for the Reclaim / Design experience.
// A landscape palette drawn from the arc's own seasons (dawn sea → field → dusk
// gold), a warm-grey ground, and an editorial serif for display, so the feature
// reads as a calm studio for shaping a life rather than a form-filling wizard.
// Scoped to these components; the rest of the app keeps the global `C` palette.

export const R = {
  ground:   "#eef1ea",  // misted green-grey ground
  ground2:  "#e7ebe2",
  card:     "#fbfcf8",
  card2:    "#ffffff",
  ink:      "#1a2620",
  inkSoft:  "#53625a",
  inkFaint: "#8c988f",
  line:     "#d9ded4",
  lineSoft: "#e7eae1",

  // landscape accents
  sea:      "#4e9e86",
  sky:      "#5aa0bf",
  plum:     "#8a6da0",
  field:    "#7f9a58",
  gold:     "#c4915a",
  clay:     "#c17a5c",

  accent:   "#3f8f77",
  accentInk:"#2b6a58",
} as const;

/** Editorial serif for display headings — a system stack, no webfont needed. */
export const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif';

/** Colour per day-archetype (the five "kinds of day"). */
export const DAY_COLOR: Record<string, string> = {
  "arch-connected": R.sea,
  "arch-adventure": R.sky,
  "arch-craft":     R.plum,
  "arch-purpose":   R.field,
  "arch-restful":   R.gold,
};

/** Colour per year "world" (the pursuit categories), drawn from the landscape. */
export const YEAR_COLOR: Record<string, string> = {
  "Immersive Travel": R.sky,
  "Creative Mastery": R.plum,
  "Endurance/Active": R.field,
  "Slow Living":      R.gold,
};

/** A word for a kind's presence, from its 0–100 weight. */
export function presenceWord(w: number): string {
  return w <= 0 ? "not for me" : w < 34 ? "a little" : w < 70 ? "often" : "this is me";
}

/** The three seasons of the arc — name, glyph, and landscape colour. Ordered
 *  as a warm progression: the open road → deep roots → still waters. */
export type ArcSeasonKey = "open" | "roots" | "still";
export const SEASON_META: Record<ArcSeasonKey, { name: string; emoji: string; color: string; tint: string; blurb: string }> = {
  open:  { name: "The Open Road", emoji: "🌄", color: "#3f8f77", tint: "#eaf4ef", blurb: "Do the big things while the body's game — travel far, move, say yes to everything." },
  roots: { name: "Deep Roots",    emoji: "🌳", color: "#2b6a58", tint: "#e7f0ea", blurb: "Deepen your craft and the people around you — mastery, mentoring, community." },
  still: { name: "Still Waters",  emoji: "🌅", color: "#c17a5c", tint: "#f6ece5", blurb: "Presence and what you pass on — family, giving back, and unhurried days." },
};
export const ARC_ORDER: ArcSeasonKey[] = ["open", "roots", "still"];

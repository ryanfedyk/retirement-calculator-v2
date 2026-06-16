// Single source of truth for the Garden Morning Light palette.
// Using a JS constants object avoids CSS variable resolution issues in Tailwind v4.

export const C = {
  // Page surfaces — light, airy, majority white
  bg:         "#fbfdfd",   // near-white page (a whisper of cool mint)
  bgHeader:   "#f5faf8",   // barely-there header/footer band
  bgCard:     "#ffffff",

  // Text — forest family, warm not cold
  ink:        "#1a2e25",   // deep forest
  inkMid:     "#3d5e52",   // forest-teal mid
  inkSoft:    "#6a8e82",   // muted teal-grey
  inkFaint:   "#a7c4bc",   // very soft hint (slightly lifted, less muddy)

  // Borders — light & crisp (was a dusty sage-grey that grimed everything up)
  border:     "#e7eeeb",
  borderSoft: "#f1f6f4",

  // Teal — the hero accent
  teal:       "#3a9e87",
  tealDark:   "#2a7a68",
  tealLight:  "#a6d4c8",
  tealWash:   "#e2f2ee",

  // Warm terracotta — brings the "pleasant" quality
  warm:       "#c4784e",
  warmLight:  "#ecc4a8",
  warmWash:   "#fdf3ec",

  // Phase journey — deep forest → bright morning teal
  phase: ["#1e4a3e", "#2d7a66", "#4aab92", "#80c4ae"] as const,
} as const;

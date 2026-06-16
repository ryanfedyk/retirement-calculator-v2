// Core configuration for the Horizon dashboard.
// Dates and personal data are sourced from sharedConfig so both views stay in sync.
import { PERSONAL } from "./sharedConfig";

export const HORIZON_CONFIG = {
  user: {
    name: PERSONAL.name,
    currentRole: "Corporate Leader",
    retirementDate: new Date(PERSONAL.retirementYear, PERSONAL.retirementMonth, 1),
    startDate: new Date("2024-01-01"),
    corporateStartDate: new Date(PERSONAL.corporateStartYear, 0, 1),
  },

  children: PERSONAL.children.map(c => ({
    name: c.name,
    birthDate: new Date(c.birthYear, c.birthMonth, 1),
  })),

  work: {
    avgHoursPerWeek: 55,
    corporateTheaterHoursPerWeek: 12, // meetings, performative work, admin theater
  },

  phases: [
    {
      id: 1,
      name: "The Structural Architect",
      label: "Year 1",
      startOffset: 0,   // months from now
      endOffset: 12,
      tagline: "Build systems. Remove yourself as the single point of failure.",
      intensity: 85,    // % of current intensity
      color: "#2d4a7a",
    },
    {
      id: 2,
      name: "The Radical Delegator",
      label: "Year 2",
      startOffset: 12,
      endOffset: 24,
      tagline: "Force autonomy downstream. Exit the firefighting loop.",
      intensity: 65,
      color: "#3d6b9e",
    },
    {
      id: 3,
      name: "The Sovereign Advisor",
      label: "Year 3",
      startOffset: 24,
      endOffset: 36,
      tagline: "Air cover only. Succession planning. Calendar opens up.",
      intensity: 40,
      color: "#5a8fa8",
    },
    {
      id: 4,
      name: "The Ultimate Offramp",
      label: "Year 4",
      startOffset: 36,
      endOffset: 48,
      tagline: "Pure glide-slope. Documentation, handoff, and exit with grace.",
      intensity: 20,
      color: "#7aab9e",
    },
  ],

  mantras: [
    "Practice corporate detachment today. Watch the organizational theater like a neutral sociologist, not an anxious participant.",
    "You are not the organization. The organization is not you. This distinction is your freedom.",
    "Every meeting you leave early, every email you don't send—these are not failures. They are precision.",
    "Delegate with conviction today. Their growth is your exit ramp.",
    "The energy you conserve at work is the energy you spend fully present with the people who matter.",
    "You have built more than enough. Today is about elegant maintenance, not heroic construction.",
    "Let the drama belong to someone else. Your job is the long game.",
    "Urgency is a feeling, not a fact. Choose your response deliberately.",
    "The best thing you can do for your team today is trust them completely.",
    "Four years is both very close and very spacious. Use this day with intention.",
    "Burnout is not a badge of honor. Tapering is the sophisticated move.",
    "Your successor is already in the room. Start teaching them, even invisibly.",
  ],
} as const;

// Design token constants matching the Tailwind config
export const DESIGN_TOKENS = {
  colors: {
    navyDeep: "#1a365d",
    slateGrey: "#4a5568",
    slateLight: "#edf2f7",
    sageMuted: "#6b9e8a",
    creamSoft: "#f7f3ed",
    slateMid: "#718096",
    indigo: "#3b5998",
  },
  transitions: {
    calm: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

export type HorizonPhase = typeof HORIZON_CONFIG.phases[number];
export type HorizonChild = typeof HORIZON_CONFIG.children[number];

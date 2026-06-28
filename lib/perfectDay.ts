/**
 * Perfect Day — the data + logic behind "Build your ideal day in retirement".
 * A curated catalog of activities (each tagged with a rough monthly cost and a
 * "start now" prep note) plus a rule-based insight engine that turns the day you
 * build into financial and readiness guidance.
 */

export type DayBlock = "morning" | "afternoon" | "evening";

export const BLOCKS: { id: DayBlock; label: string; hint: string; emoji: string }[] = [
  { id: "morning",   label: "Morning",   hint: "How you wake up & start", emoji: "🌅" },
  { id: "afternoon", label: "Afternoon", hint: "The heart of your day",    emoji: "☀️" },
  { id: "evening",   label: "Evening",   hint: "How you wind down",        emoji: "🌙" },
];

export type ActivityCategory = "Health" | "Social" | "Purpose" | "Learning" | "Leisure" | "Adventure" | "Home";

export const CATEGORY_COLOR: Record<ActivityCategory, string> = {
  Health:    "#2a9d7f",
  Social:    "#d98a3d",
  Purpose:   "#7a6da8",
  Learning:  "#3a7d9c",
  Leisure:   "#c45b6b",
  Adventure: "#2a7a68",
  Home:      "#9b7b4d",
};

export interface Activity {
  id: string;
  label: string;
  emoji: string;
  category: ActivityCategory;
  /** Rough incremental monthly cost in retirement, in today's dollars. */
  cost: number;
  /** One thing to start doing now to be ready for this in retirement. */
  prep?: string;
}

export const ACTIVITIES: Activity[] = [
  // Health & movement
  { id: "walk",      label: "Morning walk or run",   emoji: "🚶", category: "Health",   cost: 0 },
  { id: "yoga",      label: "Yoga or pilates",       emoji: "🧘", category: "Health",   cost: 80 },
  { id: "gym",       label: "Gym session",           emoji: "🏋️", category: "Health",   cost: 50 },
  { id: "golf",      label: "A round of golf",       emoji: "⛳", category: "Health",   cost: 300, prep: "Join a course or club before you retire so you have a standing tee-time community." },
  { id: "pickleball",label: "Tennis / pickleball",   emoji: "🎾", category: "Health",   cost: 60,  prep: "Find a local league or partners now so it's social, not solo." },
  { id: "swim",      label: "Swim",                  emoji: "🏊", category: "Health",   cost: 40 },

  // Social & connection
  { id: "coffee",    label: "Coffee with friends",   emoji: "☕", category: "Social",   cost: 40,  prep: "Nurture a few local friendships now — proximity matters once work stops connecting you." },
  { id: "dinner",    label: "Host a dinner",         emoji: "🍽️", category: "Social",   cost: 120, prep: "Cultivate a circle you'll actually cook for." },
  { id: "club",      label: "Club or community group",emoji: "🤝", category: "Social",  cost: 30,  prep: "Join one community group before you retire so the calendar isn't empty day one." },
  { id: "grandkids", label: "Time with family",      emoji: "👨‍👩‍👧", category: "Social", cost: 0,  prep: "Think about how close you want to live to the people you love." },
  { id: "datenight", label: "Date night",            emoji: "💞", category: "Social",   cost: 160 },

  // Purpose & contribution
  { id: "volunteer", label: "Volunteer",             emoji: "🙌", category: "Purpose",  cost: 0,   prep: "Find an organization now and start with a few hours a month." },
  { id: "mentor",    label: "Mentor or advise",      emoji: "🧭", category: "Purpose",  cost: 0,   prep: "Build your network and a simple offering before you leave full-time work." },
  { id: "passion",   label: "Passion work / side gig",emoji: "💡", category: "Purpose", cost: 0,   prep: "Test the waters now — a small project that could keep going (and may add income)." },
  { id: "create",    label: "Creative project",      emoji: "🎨", category: "Purpose",  cost: 40 },
  { id: "garden",    label: "Garden",                emoji: "🌱", category: "Purpose",  cost: 30,  prep: "Start a small garden this season to learn what thrives." },

  // Learning & growth
  { id: "read",      label: "Read",                  emoji: "📚", category: "Learning", cost: 10 },
  { id: "class",     label: "Take a class",          emoji: "🎓", category: "Learning", cost: 120, prep: "Audit a class now to find what you'd love to go deeper on." },
  { id: "instrument",label: "Play an instrument",    emoji: "🎸", category: "Learning", cost: 60,  prep: "Buy the instrument and start lessons now — the learning curve is the fun." },
  { id: "language",  label: "Learn a language",      emoji: "🗣️", category: "Learning", cost: 15,  prep: "Start a daily habit now so you can actually use it when you travel." },

  // Leisure & play
  { id: "cook",      label: "Cook a real meal",      emoji: "🍳", category: "Leisure",  cost: 0 },
  { id: "lunchout",  label: "Long lunch out",        emoji: "🥂", category: "Leisure",  cost: 200 },
  { id: "shows",     label: "Movies & shows",        emoji: "🎬", category: "Leisure",  cost: 20 },
  { id: "spa",       label: "Spa or massage",        emoji: "💆", category: "Leisure",  cost: 160 },
  { id: "nap",       label: "An unhurried nap",      emoji: "😴", category: "Leisure",  cost: 0 },

  // Adventure & travel
  { id: "hike",      label: "Hike",                  emoji: "🥾", category: "Adventure", cost: 10 },
  { id: "daytrip",   label: "Day trip",              emoji: "🚗", category: "Adventure", cost: 120 },
  { id: "travel",    label: "Plan / take travel",    emoji: "✈️", category: "Adventure", cost: 0,  prep: "Earmark a travel budget line and a first-year trip list." },
  { id: "bigtrip",   label: "Extended trip abroad",  emoji: "🌍", category: "Adventure", cost: 400, prep: "Pick one bucket-list region and start a rough itinerary + budget now." },
  { id: "visitfar",  label: "Visit far-away family", emoji: "🧳", category: "Adventure", cost: 150, prep: "Factor regular trips to the people you love who live far away." },
  { id: "boat",      label: "Sailing or boating",    emoji: "⛵", category: "Adventure", cost: 300, prep: "Rent before you buy — carrying costs are the real expense." },
  { id: "photo",     label: "Photography",           emoji: "📷", category: "Adventure", cost: 30 },

  // Home & ritual
  { id: "coffeeritual",label: "Slow coffee ritual",  emoji: "🫖", category: "Home",      cost: 0 },
  { id: "diy",       label: "Home project / DIY",    emoji: "🔨", category: "Home",       cost: 60 },
  { id: "pet",       label: "Time with a pet",       emoji: "🐕", category: "Home",       cost: 40,  prep: "If a pet is part of the picture, factor in the time and cost." },
  { id: "journal",   label: "Journal or reflect",    emoji: "📓", category: "Home",       cost: 0 },
];

export const ACTIVITY_BY_ID: Record<string, Activity> = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));

export const THOUGHT_STARTERS: string[] = [
  "How do you want to wake up — and with whom?",
  "What would make today feel meaningful, not just restful?",
  "Who do you want to see this week?",
  "What did you make, learn, or move today?",
  "Where does adventure fit — near home or far away?",
  "What's the ritual you'd never skip?",
];

export interface DayInsights {
  /** Unique activities chosen across all blocks. */
  count: number;
  monthlyCost: number;
  annualCost: number;
  /** "Start now" prep notes from the chosen activities (deduped). */
  prep: string[];
  /** Categories present, with how many activities fall in each. */
  categories: { category: ActivityCategory; count: number }[];
  /** A single coaching sentence about the day's balance. */
  balanceNote: string;
  /** The category most missing that tends to matter most (or null if balanced). */
  gap: ActivityCategory | null;
}

const GAP_NOTES: Record<string, string> = {
  Social:  "Your day has little social time — connection is the strongest predictor of retirement happiness. Consider a standing meetup, club, or shared meal.",
  Purpose: "There's no sense of purpose or contribution yet — many retirees thrive with a project, mentoring, or volunteering to anchor the week.",
  Health:  "No movement yet — daily activity is what sustains the energy to enjoy everything else for decades.",
};

/** Rule-based analysis of the built day → cost + readiness + balance guidance. */
export function analyzeDay(activityIds: string[]): DayInsights {
  const unique = Array.from(new Set(activityIds)).map((id) => ACTIVITY_BY_ID[id]).filter(Boolean) as Activity[];
  const monthlyCost = unique.reduce((s, a) => s + a.cost, 0);
  const prep = Array.from(new Set(unique.map((a) => a.prep).filter(Boolean) as string[]));

  const counts = new Map<ActivityCategory, number>();
  for (const a of unique) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  const categories = [...counts.entries()].map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Surface the most important missing dimension, in priority order.
  let gap: ActivityCategory | null = null;
  for (const cat of ["Social", "Purpose", "Health"] as ActivityCategory[]) {
    if (!counts.get(cat)) { gap = cat; break; }
  }

  const balanceNote = unique.length === 0
    ? "Add a few activities to see what your ideal day asks of your plan."
    : gap
      ? GAP_NOTES[gap]
      : "Nice balance — movement, connection, and purpose are all in your day. That mix is what makes retirement feel full.";

  return { count: unique.length, monthlyCost, annualCost: monthlyCost * 12, prep, categories, balanceNote, gap };
}

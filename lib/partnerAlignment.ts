/**
 * Partner alignment — help a couple compare their retirement *expectations*
 * (not the numbers) and talk through where they diverge. A focused
 * questionnaire, a rule-based alignment score, and discussion prompts. Answers
 * encode into a shareable link so a partner can fill theirs on any device.
 */

export type AnsValue = string | number;
export type Answers = Record<string, AnsValue>;

export interface Question {
  id: string;
  label: string;
  emoji: string;
  type: "choice" | "number" | "text";
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
  /** Reflective free-text — shown side by side but excluded from the score. */
  reflective?: boolean;
  /** Prompt to spark conversation when the two answers differ. */
  prompt?: string;
}

export const QUESTIONS: Question[] = [
  { id: "age", label: "Ideal retirement age", emoji: "🎯", type: "number", min: 50, max: 75, unit: "yrs old",
    prompt: "You picture leaving work at different ages — what's driving the gap, and could a phased exit bridge it?" },
  { id: "lifestyle", label: "Lifestyle you want", emoji: "🏡", type: "choice", options: ["Simple & frugal", "Comfortable", "Generous", "Luxurious"],
    prompt: "You imagine different spending levels — talk through what 'enough' looks like for each of you." },
  { id: "location", label: "Where you'll live", emoji: "📍", type: "choice", options: ["Stay put", "Downsize nearby", "Somewhere new", "Snowbird / split", "Abroad"],
    prompt: "You see home differently — what would it take for each of you to feel at home?" },
  { id: "travel", label: "How much travel", emoji: "✈️", type: "choice", options: ["Rarely", "A trip or two a year", "Frequent", "Nomadic"],
    prompt: "Your appetite for travel differs — which trips are non-negotiable for each of you?" },
  { id: "work", label: "Work in retirement", emoji: "💼", type: "choice", options: ["Fully done", "Passion project", "Part-time / consult", "Start something"],
    prompt: "One of you wants to keep working more than the other — what would make that feel like freedom, not obligation?" },
  { id: "social", label: "Daily life centers on", emoji: "🤝", type: "choice", options: ["Family", "Friends & community", "Hobbies & solo time", "Adventure"],
    prompt: "Your ideal days point in different directions — how do you make room for both?" },
  { id: "together", label: "Time together vs. apart", emoji: "💞", type: "choice", options: ["Mostly together", "Balanced", "Lots of independence"],
    prompt: "You want different amounts of togetherness — name what you each need to feel close and free." },
  { id: "hope", label: "Most excited about", emoji: "🌅", type: "text", reflective: true },
  { id: "worry", label: "Biggest worry", emoji: "🌧️", type: "text", reflective: true },
];

export type AlignStatus = "aligned" | "close" | "differ" | "incomplete";

export interface Comparison {
  q: Question;
  you?: AnsValue;
  partner?: AnsValue;
  status: AlignStatus;
}

function statusFor(q: Question, you?: AnsValue, partner?: AnsValue): AlignStatus {
  if (you == null || you === "" || partner == null || partner === "") return "incomplete";
  if (q.reflective) return "aligned"; // not scored; never flagged
  if (q.type === "number") {
    const d = Math.abs(Number(you) - Number(partner));
    return d <= 1 ? "aligned" : d <= 4 ? "close" : "differ";
  }
  if (you === partner) return "aligned";
  // Choice: adjacent options read as "close", further apart as "differ".
  const i = q.options?.indexOf(String(you)) ?? -1;
  const j = q.options?.indexOf(String(partner)) ?? -1;
  if (i >= 0 && j >= 0 && Math.abs(i - j) === 1) return "close";
  return "differ";
}

export function compare(you: Answers, partner: Answers): Comparison[] {
  return QUESTIONS.map((q) => ({ q, you: you[q.id], partner: partner[q.id], status: statusFor(q, you[q.id], partner[q.id]) }));
}

/** 0–100 alignment across the scored (non-reflective) questions both answered. */
export function alignmentScore(comparisons: Comparison[]): number | null {
  const scored = comparisons.filter((c) => !c.q.reflective && c.status !== "incomplete");
  if (!scored.length) return null;
  const pts = scored.reduce((s, c) => s + (c.status === "aligned" ? 1 : c.status === "close" ? 0.5 : 0), 0);
  return Math.round((pts / scored.length) * 100);
}

// ── Shareable link encoding (backendless: answers ride in the URL) ──
export function encodeAnswers(a: Answers): string {
  try {
    const json = JSON.stringify(a);
    const b64 = typeof btoa !== "undefined" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json).toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch { return ""; }
}

export function decodeAnswers(s: string): Answers | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob !== "undefined" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString();
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? (obj as Answers) : null;
  } catch { return null; }
}

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// The LLM call can take longer than the default serverless budget; give it room.
export const runtime = "nodejs";
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Same model preference + graceful fallback as /api/analyze.
const MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

interface DayPayload {
  blocks: { label: string; activities: string[] }[];
  categories: string[];
  monthlyCost: number;
  yearsToRetirement?: number | null;
  exitYear?: number | null;
}

interface CulminationPayload {
  mode: "culmination";
  days: { name: string; blocks: { label: string; activities: string[] }[]; categories: string[] }[];
  /** The Perfect Year adventure catalog the AI may draw from to seed the year. */
  catalog: { id: string; concept: string; category: string }[];
  yearsToRetirement?: number | null;
  exitYear?: number | null;
}

interface IdeasPayload {
  mode: "ideas";
  /** Passion/theme labels from the user's day blend (e.g. "Adventure & travel"). */
  themes?: string[];
  /** Free-text interest the user typed while exploring (optional). */
  interest?: string;
  /** Concepts already in the catalog, so the AI proposes genuinely new ones. */
  exclude?: string[];
  count?: number;
}

/** Build the prompt for generating fresh, personalized retirement pursuits. */
function ideasPrompt(p: IdeasPayload): string {
  const n = Math.min(8, Math.max(3, p.count ?? 6));
  const themes = (p.themes ?? []).filter(Boolean).join(", ");
  const exclude = (p.exclude ?? []).slice(0, 60).join("; ");
  return `
You are a warm, imaginative retirement-life coach — NOT a financial advisor. You help people discover vivid, specific pursuits for their retirement: hobbies, crafts, journeys, and projects worth building a chapter of life around.

Propose ${n} fresh, INSPIRING, concrete pursuits.
${themes ? `Lean toward what this person seems to love: ${themes}.` : "Offer a diverse, surprising mix."}
${p.interest ? `They're especially curious about: "${p.interest}". Make most ideas speak to that.` : ""}
Each pursuit must be specific and evocative (a real, nameable thing to do — not "travel more" or "get healthy"). Avoid anything already covered here: ${exclude || "(none)"}.

Classify each into EXACTLY ONE category from this set: "Immersive Travel", "Creative Mastery", "Endurance/Active", "Slow Living".
Give a mix of categories. Avoid financial-planning advice.

Return ONLY raw JSON in this exact shape (no markdown, no code fences):
{
  "ideas": [
    {
      "concept": "a specific, evocative pursuit name (max ~9 words)",
      "category": "one of the four categories, exactly",
      "commitment": "Micro-Prototype OR Macro-Adventure",
      "whenToStart": "Now OR Phase 2+ OR Post-Retirement",
      "depthScore": 1,
      "whyFactor": "1-2 warm sentences on why this pursuit is meaningful and worth the time",
      "microDoseAction": "one small, concrete first step they can take this week",
      "tags": ["3-5 short lowercase interest tags"]
    }
  ]
}
`;
}

/** Build the prompt for a single-day reflection. */
function singleDayPrompt(day: DayPayload): string {
  const dayText = day.blocks
    .map((b) => `- ${b.label}: ${b.activities.length ? b.activities.join(", ") : "(nothing planned)"}`)
    .join("\n");
  const horizon = day.yearsToRetirement != null
    ? `They are about ${day.yearsToRetirement} year(s) from retiring${day.exitYear ? ` (target exit ${day.exitYear})` : ""}.`
    : "";
  return `
You are a warm, perceptive retirement-life coach — NOT a financial advisor. You help people design a retirement that feels meaningful, not just affordable. You are reflecting on the "perfect day" someone has sketched for their retirement.

Their ideal day:
${dayText}

Life dimensions present: ${day.categories.join(", ") || "none yet"}.
Rough discretionary cost of this day: about $${Math.round(day.monthlyCost)}/month.
${horizon}

Reflect on THIS specific day — reference the actual activities they chose. Be warm, concrete, and encouraging, but honest about what might be missing (e.g. connection, purpose, movement, novelty). Avoid generic platitudes and avoid financial-planning advice (no talk of withdrawal rates or portfolios). Focus on the human design of the day and how to start growing into it now.

Return ONLY raw JSON in this exact shape (no markdown, no code fences):
{
  "headline": "a short, warm one-liner that names the character of their day (max ~10 words)",
  "reflection": "2-3 sentences reflecting on what this day reveals — what's lovely, and what may be missing — referencing their actual activities",
  "prepare": ["a specific thing to start doing now to grow into this day", "another", "a third"],
  "tryAdding": ["one thoughtful activity or moment they didn't include that would round out the day", "optionally a second"]
}
`;
}

/** Build the prompt for the culmination — the throughline across several days,
 * plus picks from the adventure catalog to seed the Perfect Year. */
function culminationPrompt(p: CulminationPayload): string {
  const daysText = p.days
    .map((d, i) => {
      const inner = d.blocks
        .map((b) => `    ${b.label}: ${b.activities.length ? b.activities.join(", ") : "(nothing)"}`)
        .join("\n");
      return `Day ${i + 1} — "${d.name}":\n${inner}`;
    })
    .join("\n\n");
  const catalogText = p.catalog.map((c) => `- ${c.id} · [${c.category}] ${c.concept}`).join("\n");
  const horizon = p.yearsToRetirement != null
    ? `They are about ${p.yearsToRetirement} year(s) from retiring${p.exitYear ? ` (target exit ${p.exitYear})` : ""}.`
    : "";
  return `
You are a warm, perceptive retirement-life coach — NOT a financial advisor. Someone has sketched several different "perfect days" for their retirement. Your job is to find the THROUGHLINE — what their retirement is fundamentally about — and to name the passions and values that recur across these days.

Their perfect days:
${daysText}
${horizon}

Then, from the adventure catalog below, choose 3–6 experiences that best fit the passions you see and would make a meaningful year. Each must use an EXACT id from this catalog, and assign each a month (0 = January … 11 = December) that fits its nature (e.g. warm-weather trips in summer). Pick a diverse, inspiring set — not all from one category.

Adventure catalog:
${catalogText}

Be specific and human — reference the actual activities they chose across days. Avoid platitudes and avoid financial-planning advice.

Return ONLY raw JSON in this exact shape (no markdown, no code fences):
{
  "title": "what their retirement is fundamentally about (max ~8 words)",
  "essence": "2-3 warm sentences naming the throughline across their days — the passions and values that recur, referencing their actual choices",
  "themes": ["3-5 short theme tags, 1-3 words each"],
  "passions": ["2-4 inferred passions as short phrases"],
  "yearSeeds": [{ "seedId": "<exact id from the catalog>", "month": 0, "why": "one short sentence tying this to their days" }]
}
`;
}

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: "Gemini API key not configured",
          detail: "GEMINI_API_KEY is missing. Locally: set it in .env.local. In production (Firebase App Hosting): create the secret with `firebase apphosting:secrets:set GEMINI_API_KEY`, grant the backend access, and redeploy.",
        },
        { status: 503 }
      );
    }

    const body = (await req.json()) as DayPayload | CulminationPayload | IdeasPayload;
    const mode = (body as { mode?: string }).mode;
    const prompt = mode === "culmination"
      ? culminationPrompt(body as CulminationPayload)
      : mode === "ideas"
        ? ideasPrompt(body as IdeasPayload)
        : singleDayPrompt(body as DayPayload);

    let responseText = "";
    let lastErr: any = null;
    for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        if (responseText) break;
      } catch (e: any) {
        lastErr = e;
        console.warn(`Gemini model ${modelName} failed: ${e?.message}`);
      }
    }

    if (!responseText) {
      const msg = lastErr?.message || "All Gemini models failed";
      const isAuth = /API key|PERMISSION_DENIED|leaked|API_KEY_INVALID/i.test(msg);
      return NextResponse.json(
        {
          error: isAuth ? "Gemini API key invalid or revoked" : "Insight generation failed",
          detail: isAuth
            ? "Your GEMINI_API_KEY was rejected (likely revoked/leaked). Generate a new key at aistudio.google.com/apikey and update .env.local."
            : msg,
        },
        { status: isAuth ? 401 : 502 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText.replace(/```json|```/g, "").trim());
    } catch {
      return NextResponse.json({ error: "Insight generation failed", detail: "Unexpected response format." }, { status: 502 });
    }

    return mode === "culmination"
      ? NextResponse.json({ culmination: parsed })
      : mode === "ideas"
        ? NextResponse.json({ ideas: (parsed?.ideas ?? parsed) })
        : NextResponse.json({ insight: parsed });
  } catch (err: any) {
    console.error("Perfect Day insight error:", err.message);
    return NextResponse.json({ error: "Insight generation failed", detail: err.message }, { status: 500 });
  }
}

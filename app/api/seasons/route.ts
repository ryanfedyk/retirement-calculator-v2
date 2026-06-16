import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

// POST { seasons: Season[] } → { seasons: Season[] } with Gemini-enriched
// names/taglines/focus/actions. Year ranges and types are preserved exactly.
// If Gemini is unavailable, returns the input unchanged so the UI still renders.
export async function POST(req: Request) {
  const { seasons } = await req.json();

  if (!Array.isArray(seasons) || seasons.length === 0) {
    return NextResponse.json({ seasons: [], source: "empty" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ seasons, source: "fallback" });
  }

  // Compact description of the timeline for the prompt.
  const timeline = seasons.map((s: any) =>
    `#${s.id} [${s.type}] ${s.startYear}–${s.endYear} (intensity ${s.intensity}%)`
  ).join("\n");

  const prompt = `
You are a thoughtful career and life-design coach mapping out the "macro-seasons"
of a tech executive's glide path from full-time work to retirement.

Here is the timeline (each season already has fixed years, type, and a work-intensity %):
${timeline}

Season types:
- taper      = winding down at the current employer (Google), progressively lower intensity
- sabbatical = a deliberate full break from work
- jump       = a high-agency entrepreneurial "career jump" / startup bet
- bridge     = a lower-intensity bridge job between peak career and full retirement
- retired    = full retirement

For EACH season (match by id), write fresh, specific, motivating content that fits its
type, its calendar years, and its intensity. Return ONLY raw JSON (no markdown fences):

{
  "seasons": [
    {
      "id": <number, matching input>,
      "name": "evocative 2-4 word season name",
      "tagline": "one vivid sentence",
      "focus": "the single core focus of this season",
      "permission": "a permission slip — 'You are permitted to ...'",
      "actions": ["3 to 4 concrete, specific actions"]
    }
  ]
}
Keep names distinct across seasons. Reference the actual years where natural.`;

  let text = "";
  let lastErr: any = null;
  for (const model of MODEL_CANDIDATES) {
    try {
      const m = genAI.getGenerativeModel({ model });
      const r = await m.generateContent(prompt);
      text = r.response.text();
      if (text) break;
    } catch (e: any) {
      lastErr = e;
    }
  }

  if (!text) {
    // Auth/quota failure → graceful fallback to deterministic content.
    return NextResponse.json({ seasons, source: "fallback", detail: lastErr?.message });
  }

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    const byId = new Map<number, any>((parsed.seasons ?? []).map((s: any) => [s.id, s]));
    const merged = seasons.map((s: any) => {
      const g = byId.get(s.id);
      if (!g) return s;
      return {
        ...s,
        name:       g.name       ?? s.name,
        tagline:    g.tagline    ?? s.tagline,
        focus:      g.focus      ?? s.focus,
        permission: g.permission ?? s.permission,
        actions:    Array.isArray(g.actions) && g.actions.length ? g.actions : s.actions,
      };
    });
    return NextResponse.json({ seasons: merged, source: "gemini" });
  } catch {
    return NextResponse.json({ seasons, source: "fallback-parse" });
  }
}

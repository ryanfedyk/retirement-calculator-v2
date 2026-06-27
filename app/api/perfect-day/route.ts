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

    const day = (await req.json()) as DayPayload;

    const dayText = day.blocks
      .map((b) => `- ${b.label}: ${b.activities.length ? b.activities.join(", ") : "(nothing planned)"}`)
      .join("\n");

    const horizon = day.yearsToRetirement != null
      ? `They are about ${day.yearsToRetirement} year(s) from retiring${day.exitYear ? ` (target exit ${day.exitYear})` : ""}.`
      : "";

    const prompt = `
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

    let insight;
    try {
      insight = JSON.parse(responseText.replace(/```json|```/g, "").trim());
    } catch {
      return NextResponse.json({ error: "Insight generation failed", detail: "Unexpected response format." }, { status: 502 });
    }

    return NextResponse.json({ insight });
  } catch (err: any) {
    console.error("Perfect Day insight error:", err.message);
    return NextResponse.json({ error: "Insight generation failed", detail: err.message }, { status: 500 });
  }
}

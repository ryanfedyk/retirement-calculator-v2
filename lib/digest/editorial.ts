import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Digest } from "@/lib/digest/buildDigest";

const MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"];

/**
 * Let Gemini write the brief's editorial lede — 2–3 sentences of warm, witty,
 * specific morning voice that weaves the day's mood, the featured milestone, and
 * the plan's standing. Employer-agnostic, never financial advice. Returns null if
 * Gemini isn't configured or errors, so the caller keeps the deterministic lede
 * and the brief still sends.
 */
export async function writeEditorial(d: Digest): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const mv = d.portfolio.dayChangePct;
  const mood = mv == null ? "unknown" : mv >= 0.005 ? "up" : mv <= -0.005 ? "down" : "flat";
  const featured = d.milestones[0];
  const facts = [
    `Reader first name: ${d.greetingName ?? "(none)"}`,
    `Market mood today: ${mood}${mv != null ? ` (${(mv * 100).toFixed(1)}%)` : ""}`,
    `Investable: $${Math.round(d.portfolio.investable).toLocaleString()}`,
    `Plan standing: ${d.plan.headline} (${Math.round(d.monteCarlo.successRate * 100)}% Monte Carlo odds${d.monteCarlo.deltaPts != null ? `, ${d.monteCarlo.deltaPts >= 0 ? "+" : ""}${d.monteCarlo.deltaPts.toFixed(1)} pts since yesterday` : ""})`,
    `Featured milestone: ${featured ? `${featured.headline} — ${featured.note}` : "(none)"}`,
    `Current life/career season: ${d.framing.seasonName}`,
  ].join("\n");

  const prompt = `You are the voice of a personal morning financial-and-life brief called "The Morning Glide" for one reader winding down toward retirement.

Write the opening editorial lede: 2-3 sentences, warm and a little witty, specific to today, in second person. Set the mood and point the reader at the day's most meaningful thread (usually the milestone, not the money). It should feel like a sharp friend who gets that this is about a life, not a spreadsheet.

Hard rules:
- Do NOT name or imply any specific employer, company, or ticker.
- NOT financial advice; no "you should buy/sell".
- No greeting like "Good morning" and do NOT include the reader's name (the template adds it).
- No markdown, no quotes around the output, no headings. Just the 2-3 sentences.

Today's facts:
${facts}`;

  for (const model of MODEL_CANDIDATES) {
    try {
      const m = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model });
      const res = await m.generateContent(prompt);
      const text = res.response.text()?.trim();
      if (text) return text.replace(/^["']|["']$/g, "");
    } catch {
      /* try next model */
    }
  }
  return null;
}

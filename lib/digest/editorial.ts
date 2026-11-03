import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Digest } from "@/lib/digest/buildDigest";

const MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"];

export interface BriefProse {
  /** 1–2 sentence opening lede. */
  lede: string | null;
  /** 2–4 sentence synthesis of conditions + a measured outlook for the months ahead. */
  marketOutlook: string | null;
  /** An original one-line "thought for the day" (no attribution — it's original). */
  motivation: string | null;
}

/**
 * One Gemini call that writes the brief's two interpretive pieces: the opening
 * lede and the "market & the months ahead" synthesis. Returns nulls if Gemini
 * isn't configured or errors, so the caller keeps the deterministic versions and
 * the brief still sends. Employer-agnostic; explicitly NOT financial advice.
 */
export async function writeBriefProse(d: Digest): Promise<BriefProse> {
  if (!process.env.GEMINI_API_KEY) return { lede: null, marketOutlook: null, motivation: null };

  const mv = d.portfolio.dayChangePct;
  const mood = mv == null ? "unknown" : mv >= 0.005 ? "up" : mv <= -0.005 ? "down" : "flat";
  const indices = d.marketContext.indices
    .filter((i) => i.changePct != null)
    .map((i) => `${i.label} ${(i.changePct! * 100).toFixed(1)}%`)
    .join(", ") || "(no index data)";
  const facts = [
    `Reader first name: ${d.greetingName ?? "(none)"}`,
    `Today's market mood: ${mood}${mv != null ? ` (${(mv * 100).toFixed(1)}%)` : ""}`,
    `Broad market today: ${indices}`,
    `Investable: $${Math.round(d.portfolio.investable).toLocaleString()}`,
    `Concentration: ${Math.round(d.portfolio.concentrationPct * 100)}% in the employer/concentrated position`,
    `Plan standing: ${d.plan.headline} (${Math.round(d.monteCarlo.successRate * 100)}% Monte Carlo odds of funding to 100${d.monteCarlo.deltaPts != null ? `, ${d.monteCarlo.deltaPts >= 0 ? "+" : ""}${d.monteCarlo.deltaPts.toFixed(1)} pts since yesterday` : ""})`,
    `Today's featured life/career milestone: ${d.milestones[0] ? d.milestones[0].headline : "(none)"}`,
    `Current life/career season: ${d.framing.seasonName}`,
    `Years to planned exit: based on the plan (do not invent specifics)`,
  ].join("\n");

  const prompt = `You are the voice of a personal weekday morning brief called "The Morning Glide" for one reader steadily diversifying out of a concentrated employer-stock position and gliding toward retirement.

Write THREE things and return them as raw JSON (no markdown fences): {"lede": "...", "marketOutlook": "...", "motivation": "..."}

1. "lede": 1-2 sentences, warm and a little witty, in second person. Set the mood and point at the day's most meaningful thread (usually the milestone or the plan, not the daily tape). No "Good morning", do NOT include the reader's name (the template adds it).

2. "marketOutlook": 2-4 sentences synthesizing today's conditions into a calm read of the MONTHS AHEAD for a long-horizon, diversifying investor. Weave the broad-market data into a coherent narrative (not a list). Be measured and humble about uncertainty; frame it as "what to expect / what to watch", emphasizing that volatility is normal and the plan is built for a range of outcomes and that steady diversification reduces single-stock risk regardless of the tape.

3. "motivation": ONE original, uplifting sentence — a "thought for the day" that fits someone patiently building toward the freedom to retire on their terms. It must be YOUR OWN words, not a quote; do NOT attribute it to anyone or invent a source. Specific and warm, not a platitude.

Hard rules for ALL THREE:
- Do NOT name or imply any specific employer, company, or ticker.
- This is NOT financial advice. Never say to buy, sell, or time anything. No price targets or predictions stated as fact.
- No markdown, no headings, no surrounding quotes. Just the JSON object.

Today's facts:
${facts}`;

  for (const model of MODEL_CANDIDATES) {
    try {
      const m = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model, generationConfig: { responseMimeType: "application/json" } });
      const res = await m.generateContent(prompt);
      const text = res.response.text()?.trim();
      if (!text) continue;
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      return { lede: str(parsed.lede), marketOutlook: str(parsed.marketOutlook), motivation: str(parsed.motivation) };
    } catch {
      /* try next model */
    }
  }
  return { lede: null, marketOutlook: null, motivation: null };
}

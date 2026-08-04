import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { estimatePIA, estimateMonthlySocialSecurity, estimateSpousalBenefit } from "@/engine/social_security";
import { buildScenarioReport } from "@/lib/scenarioReport";

// The LLM call can take longer than the default serverless budget; give it room.
export const runtime = "nodejs";
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Current Gemini models, in order of preference. 1.5-flash is being retired,
// so prefer 2.x and fall back gracefully on per-model errors (404/429/etc).
const MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

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

    const { config, snapshot, liveGoogPrice } = await req.json();
    const currentYear = new Date().getFullYear();

    // Social Security is normally DERIVED from salary (`social_security_linked` /
    // `partner_ss_linked` default true), so the stored `monthly_amount` and
    // `partner_monthly_amount` fields sit at 0 and read as "no benefit" to the
    // model — which then wrongly claims a spouse has no Social Security. Resolve
    // the actual monthly benefits the engine uses (partner = greater of her own
    // record or a spousal benefit) and surface them explicitly.
    const ssCfg = config.social_security;
    const ipCfg = config.income_profile ?? {};
    let ssContext = "";
    if (ssCfg) {
      const claimAge = ssCfg.start_age ?? 67;
      const primaryYears = Math.max(0, (config.career_path?.exit_year ?? currentYear) - ((config.birth_year ?? 1985) + 22));
      const primaryMonthly = ssCfg.social_security_linked !== false
        ? estimateMonthlySocialSecurity(ipCfg.gross_annual_salary || 0, claimAge, primaryYears)
        : (ssCfg.monthly_amount || 0);
      const primaryPIA = estimatePIA(ipCfg.gross_annual_salary || 0, primaryYears);
      let partnerMonthly = 0;
      if (ipCfg.use_partner_income) {
        partnerMonthly = ssCfg.partner_ss_linked !== false
          ? Math.max(estimateMonthlySocialSecurity(ipCfg.partner_gross_annual_salary || 0, claimAge), estimateSpousalBenefit(primaryPIA, claimAge))
          : (ssCfg.partner_monthly_amount || 0);
      }
      ssContext = `\n- Resolved Social Security monthly benefits (claimed at age ${claimAge}): primary ≈ $${primaryMonthly}/mo${ipCfg.use_partner_income ? `, partner ≈ $${partnerMonthly}/mo — the greater of her own record or a spousal benefit (a married partner ALWAYS draws Social Security, even with no earnings record). Do NOT state the partner has no Social Security income.` : "."}`;
    }

    // The FULL, auditable plan report — balance sheet, assumptions, taxes, Social
    // Security, the exact FI test, the deterministic results, the Monte-Carlo
    // sequence-of-returns risk (§11) and the sensitivity table (§12) — so the model
    // weighs EVERY factor, not a thin summary. Falls back to raw JSON if it can't build.
    let planReport: string;
    try {
      planReport = buildScenarioReport({
        scenarioName: "This scenario",
        snapshot, config,
        liveGoogPrice: typeof liveGoogPrice === "number" ? liveGoogPrice : 0,
        includeMonteCarlo: true,
        monteCarloRuns: 1500, // solid odds (±~1% at the 90% mark) while keeping the request within budget
        generatedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      console.warn("buildScenarioReport failed; using raw JSON:", e?.message);
      planReport = `### Configuration\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n### Snapshot\n\`\`\`json\n${JSON.stringify({ ...snapshot, other_investments: snapshot.other_investments?.slice(0, 10) }, null, 2)}\n\`\`\``;
    }

    const prompt = `
You are a world-class financial planner analyzing a retirement plan for a tech professional.

IMPORTANT CONTEXT:
- Current year: ${currentYear}; all time references must be relative to it.
- Rental income ($${config.income_profile?.monthly_rental_income || 0}/mo) is RELIABLE PASSIVE income continuing throughout retirement.
- Healthcare household size (for ACA/FPL subsidies and per-capita premiums) is derived automatically from filing status + children still on the plan; do not flag any household-size inconsistency.
- \`partner_has_health_insurance: false\` means the household conservatively buys its OWN (ACA/self-paid) coverage — the safer assumption, NOT a coverage gap. Do not raise it as an uncovered risk.${ssContext}

Below is the COMPLETE, auditable plan report. Base your analysis on ALL of it — do not stop at the base-case/deterministic path. You MUST explicitly weigh:
- **§11 Sequence-of-returns risk (Monte Carlo):** the success rate, the confidence-graded FI dates (90/95/99%), and the ending net-worth bands. A low Monte-Carlo success rate is a MATERIAL risk even when the base case "works" — reflect it in the status ratings.
- **§12 Sensitivity:** which assumptions actually move the FI date (employer-stock underperformance or a crash, lost rental income, higher healthcare, a Social Security cut).
- Every other factor: taxes, healthcare inflation, Social Security & rental timing, the mortgage payoff, RMDs, and single-stock / employer-equity concentration.

Your two status ratings and the risks list must REFLECT the Monte-Carlo odds and these sensitivities, not just the median path.

### Plan report
${planReport}

Please evaluate TWO separate goals:
1. **Retirement Track** — Is the user on track to retire at ${config.career_path?.exit_year} with sustainable, high-confidence income?
2. **FI Track** — Is the user on track to achieve Financial Independence where assets fund every expense to age 100 across most market paths?

Be specific: cite actual numbers from the report (net worth, spendable vs the FI number, the Monte-Carlo success rate, sensitivity shifts, market/employer-stock rates, spending). Do NOT name a specific employer or company. Be direct and personal — this is their actual plan.

Return ONLY raw JSON in this exact shape (no markdown, no code fences):
{
  "retirementStatus": "On Track" | "At Risk" | "Needs Attention",
  "retirementExplanation": "2-3 sentence explanation referencing actual numbers...",
  "fiStatus": "On Track" | "At Risk" | "Needs Attention",
  "fiExplanation": "2-3 sentence explanation referencing actual numbers...",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "risks": ["specific risk 1", "specific risk 2", "specific risk 3"],
  "tips": ["actionable tip 1", "actionable tip 2", "actionable tip 3"]
}
`;

    // Try each candidate model until one succeeds.
    let responseText = "";
    let lastErr: any = null;
    for (const modelName of MODEL_CANDIDATES) {
      try {
        // Force JSON output so parsing is reliable (no stray prose / code fences).
        const model  = genAI.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
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
          error: isAuth ? "Gemini API key invalid or revoked" : "Analysis failed",
          detail: isAuth
            ? "Your GEMINI_API_KEY was rejected (likely revoked/leaked). Generate a new key at aistudio.google.com/apikey and update .env.local."
            : msg,
        },
        { status: isAuth ? 401 : 502 }
      );
    }

    let analysisData;
    try {
      const clean = responseText.replace(/```json|```/g, "").trim();
      analysisData = JSON.parse(clean);
    } catch {
      analysisData = {
        retirementStatus: "Needs Attention",
        retirementExplanation: "Analysis returned an unexpected format.",
        fiStatus: "Needs Attention",
        fiExplanation: "Analysis returned an unexpected format.",
        strengths: [],
        risks: ["Failed to parse AI response."],
        tips: ["Try refreshing the analysis."],
        rawOutput: responseText,
      };
    }

    return NextResponse.json({ analysis: analysisData });
  } catch (err: any) {
    console.error("Analyze error:", err.message);
    return NextResponse.json({ error: "Analysis failed", detail: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { estimatePIA, estimateMonthlySocialSecurity, estimateSpousalBenefit } from "@/engine/social_security";

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

    const { config, snapshot, trajectory } = await req.json();

    const currentYear = new Date().getFullYear();

    let trueRetirementYear = config.career_path.exit_year;
    if (config.career_path.use_sabbatical) trueRetirementYear += (config.career_path.sabbatical_duration || 0);
    if (config.career_path.use_jump)       trueRetirementYear += (config.career_path.jump_duration || 0);
    if (config.career_path.use_bridge)     trueRetirementYear += (config.career_path.bridge_duration || 0);

    const finalNW     = trajectory?.length > 0 ? trajectory[trajectory.length - 1].totalNetWorth : "N/A";
    const fiAchieved  = trajectory?.some((p: any) => p.isIndependent) ? "Yes" : "No";
    const indepPoint  = trajectory?.find((p: any) => p.isIndependent);

    // Sanitize the config before showing it to the model. Two ACA fields are
    // vestigial — the engine derives household size from the ACTUAL household
    // (adults + kids still on the plan) and ignores these — but they persist in
    // saved configs and mislead the analysis (e.g. a stale `aca_family_size: 1`
    // reads as a data inconsistency). Strip them so the model doesn't flag them.
    const { aca_family_size: _afs, aca_benchmark_monthly_premium: _abp, ...taxOpt } =
      config.tax_optimization ?? {};
    const displayConfig = { ...config, tax_optimization: taxOpt };

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
      displayConfig.social_security = {
        ...ssCfg,
        resolved_primary_monthly_benefit: primaryMonthly,
        ...(ipCfg.use_partner_income ? { resolved_partner_monthly_benefit: partnerMonthly } : {}),
      };
      ssContext = `\n- Social Security is DERIVED from income when \`*_linked\` is true (the default), so the raw \`monthly_amount\` / \`partner_monthly_amount\` fields may read 0 even though the modeled benefit is not. The engine's RESOLVED monthly benefits (claimed at age ${claimAge}) are: primary ≈ $${primaryMonthly}/mo${ipCfg.use_partner_income ? `, partner ≈ $${partnerMonthly}/mo — the greater of her own record or a spousal benefit (a married partner ALWAYS draws Social Security, even with no earnings record). Do NOT state the partner has no Social Security income.` : "."}`;
    }

    const prompt = `
You are a world-class financial planner analyzing a retirement plan for a tech professional.

IMPORTANT CONTEXT:
- Current year: ${currentYear}
- True retirement year (after all career phases): ${trueRetirementYear}
- All time references must be relative to ${currentYear}
- Rental income ($${config.income_profile.monthly_rental_income || 0}/mo) is RELIABLE PASSIVE income continuing forever in retirement
- Healthcare household size (for ACA/FPL subsidies and per-capita premiums) is derived automatically from filing status + children still on the plan; it is NOT a config field, so do not flag any household-size inconsistency.
- \`partner_has_health_insurance: false\` means the partner's employer does NOT supply the family's coverage, so the model conservatively assumes the household buys its own (ACA/self-paid) coverage. It does NOT mean anyone is uninsured — it is the safer assumption, not a coverage gap. Do not raise it as an uncovered risk.${ssContext}

### Configuration:
\`\`\`json
${JSON.stringify(displayConfig, null, 2)}
\`\`\`

### Financial Snapshot:
\`\`\`json
${JSON.stringify({
  ...snapshot,
  other_investments: snapshot.other_investments?.slice(0, 10), // truncate for token budget
}, null, 2)}
\`\`\`

### Trajectory Summary:
- Final Net Worth (30-year horizon): $${finalNW}
- Financial Independence Achieved? ${fiAchieved}
${indepPoint ? `- FI Date: ${indepPoint.date}` : ""}

Please evaluate TWO separate goals:
1. **Retirement Track** — Is the user on track to retire at ${config.career_path.exit_year} with sustainable income?
2. **FI Track** — Is the user on track to achieve Financial Independence where assets cover expenses indefinitely?

Be specific: reference actual numbers from the data (salary, concentrated/employer stock, spending, market rates, etc). Do NOT name a specific employer or company. Be direct and personal — this is their actual plan, not a hypothetical.

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

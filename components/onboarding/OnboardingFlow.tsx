"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { C } from "@/config/colors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFinancialStore } from "@/store/useFinancialStore";
import { DEFAULT_SIM_CONFIG, DEFAULT_SNAPSHOT } from "@/config/sharedConfig";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
import { STATE_OPTIONS } from "@/engine/state_tax";
import { launchConfetti } from "@/lib/fx/confetti";

const CURRENT_YEAR = new Date().getFullYear();

const optNum = (s: string): number | undefined => {
  const n = Number(String(s).replace(/,/g, ""));
  return s.trim() !== "" && !isNaN(n) ? n : undefined;
};
const num = (s: string, fallback = 0) => optNum(s) ?? fallback;

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
  color: C.inkSoft, marginBottom: 6, display: "block",
};
const fieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.ink, outline: "none",
};
const selectStyle: React.CSSProperties = {
  ...fieldStyle,
  appearance: "none", WebkitAppearance: "none", MozAppearance: "none", paddingRight: 36,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236a8e82' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", backgroundSize: "12px",
};
const optionalTag = (
  <span style={{ textTransform: "none", color: C.inkFaint, fontWeight: 400 }}>(optional)</span>
);

function MoneyField({ label, value, onChange, placeholder }: {
  label: React.ReactNode; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6, ...fieldStyle, padding: "0 13px" }}>
        <span style={{ color: C.inkFaint, fontSize: 14 }}>$</span>
        <input
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.ink, fontSize: 14, padding: "11px 0" }}
          type="number" inputMode="numeric" placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

type KidDraft = { name: string; month: string; year: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Onboarding that captures the data that actually moves a retirement
 * trajectory — household, money in, money out, taxes — then, instead of asking
 * when you want to retire, computes and reveals when you *can*. Every step past
 * the first is skippable ("you can add this later").
 */
export default function OnboardingFlow() {
  const { user } = useAuth();
  const { updateProfile, updateConfig, updateNestedSnapshot, setChildren, seedBaseline } = useFinancialStore();

  const [step, setStep] = useState(0);

  // Step 1 — You
  const [name, setName] = useState(user?.displayName ?? "");
  const [birthYear, setBirthYear] = useState<string>(String(CURRENT_YEAR - 40));

  // Step 2 — Household
  const [hasPartner, setHasPartner] = useState(false);
  const [partnerAge, setPartnerAge] = useState<string>("");
  const [partnerSalary, setPartnerSalary] = useState<string>("");
  const [kids, setKids] = useState<KidDraft[]>([]);

  // Step 3 — Money in
  const [salary, setSalary] = useState<string>("");
  const [savings, setSavings] = useState<string>("");
  const [k401, setK401] = useState<string>("");
  const [roth, setRoth] = useState<string>("");

  // Step 4 — Money out
  const [monthlySpend, setMonthlySpend] = useState<string>("");
  const [housing, setHousing] = useState<string>("");

  // Step 5 — Taxes
  const [filing, setFiling] = useState<string>("single");
  const [stateCode, setStateCode] = useState<string>("NONE");

  const by = Number(birthYear);
  const essentialsValid = name.trim().length > 0 && by >= 1920 && by <= CURRENT_YEAR;

  const STEP_META = [
    { title: "Let’s chart your horizon", subtitle: "Two essentials to begin — you can refine everything later." },
    { title: "Your household", subtitle: "Partners and kids shape taxes, spending and milestones. None? Just continue." },
    { title: "Money in", subtitle: "Salary and what you’ve already banked. Rough numbers are fine — skip what you’re unsure of." },
    { title: "Money out", subtitle: "What you spend keeps the projection honest. You can fine-tune later." },
    { title: "Taxes", subtitle: "Filing status and state are big levers on your take-home — and your timeline." },
    { title: "Here’s your horizon", subtitle: "Based on what you’ve shared." },
  ];
  const REVEAL = STEP_META.length - 1;
  const isFirst = step === 0;
  const onReveal = step === REVEAL;

  // ── Kid helpers ──
  // New kids start at a real, editable birthday (not ghosted placeholder) so the
  // year stepper works immediately and nothing gets silently dropped.
  const addKid = () => setKids((k) => [...k, { name: "", month: "0", year: String(CURRENT_YEAR - 8) }]);
  const removeKid = (i: number) => setKids((k) => k.filter((_, idx) => idx !== i));
  const updateKid = (i: number, patch: Partial<KidDraft>) =>
    setKids((k) => k.map((kid, idx) => (idx === i ? { ...kid, ...patch } : kid)));

  const kidYearValid = (k: KidDraft) => { const y = Number(k.year); return y >= 1990 && y <= CURRENT_YEAR + 30; };
  const kidsValid = kids.every(kidYearValid);

  const validKids = () => kids
    .filter(kidYearValid)
    .map((k) => ({ name: k.name.trim() || "Child", birthYear: Number(k.year), birthMonth: Number(k.month) || 0 }));

  // Build the full config + snapshot from the inputs (defaults fill the blanks).
  // Used for BOTH the reveal projection and the committed plan, so the dashboard
  // reproduces exactly what we showed on the reveal — no "retire 2040 / can't
  // retire" contradiction.
  const assemble = () => {
    const cfg = structuredClone(DEFAULT_SIM_CONFIG);
    cfg.birth_year = by;
    const grossSalary = num(salary, cfg.income_profile.gross_annual_salary);
    cfg.income_profile.gross_annual_salary = grossSalary;
    cfg.income_profile.google_net_monthly = Math.round(grossSalary * 0.65 / 12);
    cfg.income_profile.use_partner_income = hasPartner;
    if (hasPartner) {
      cfg.income_profile.partner_gross_annual_salary = num(partnerSalary, 0);
      const pa = optNum(partnerAge);
      if (pa !== undefined) cfg.income_profile.partner_birth_year = CURRENT_YEAR - pa;
    }
    cfg.spending.monthly_lifestyle = num(monthlySpend, cfg.spending.monthly_lifestyle);
    cfg.spending.mortgage_payment = num(housing, 0);
    cfg.tax_assumptions.filing_status = filing as typeof cfg.tax_assumptions.filing_status;
    cfg.tax_assumptions.state_of_residence = stateCode as typeof cfg.tax_assumptions.state_of_residence;
    cfg.children = validKids().map((k) => ({ birthYear: k.birthYear }));

    const snap = structuredClone(DEFAULT_SNAPSHOT);
    snap.liquid_assets.cash_savings = num(savings, 0);
    snap.retirement_assets.k401 = num(k401, 0);
    snap.retirement_assets.roth_ira = num(roth, 0);
    return { cfg, snap };
  };

  // Find the earliest exit year for which the plan stays solvent through the
  // horizon — i.e. the earliest date they can safely retire.
  const projection = useMemo(() => {
    if (!essentialsValid || !onReveal) return undefined;
    const { cfg: baseCfg, snap } = assemble();
    const maxYear = by + 72;
    for (let exitYear = CURRENT_YEAR; exitYear <= maxYear; exitYear++) {
      const cfg = { ...baseCfg, career_path: { ...baseCfg.career_path, exit_year: exitYear } };
      if (findIndependencePoint(runSimulation(snap, cfg, 0))) {
        return { fi: true as const, fiYear: exitYear, age: exitYear - by };
      }
    }
    // Not reachable in-horizon — report how far along they are (working long).
    const longCfg = { ...baseCfg, career_path: { ...baseCfg.career_path, exit_year: maxYear } };
    const p0 = runSimulation(snap, longCfg, 0)[0];
    const progress = p0 && p0.swrTarget > 0 ? Math.min(100, Math.round((p0.investableAssets / p0.swrTarget) * 100)) : 0;
    return { fi: false as const, progress };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReveal, essentialsValid, by, salary, partnerSalary, partnerAge, hasPartner, monthlySpend, housing, filing, stateCode, savings, k401, roth, kids]);

  // Celebrate on the reveal.
  useEffect(() => {
    if (onReveal && projection?.fi) {
      const t = setTimeout(() => launchConfetti({ count: 180 }), 250);
      return () => clearTimeout(t);
    }
  }, [onReveal, projection?.fi]);

  const commitAndEnter = () => {
    if (!essentialsValid) { setStep(0); return; }
    const fiYear = projection?.fi ? projection.fiYear : by + 25;

    // Write the SAME assembled config we simulated for the reveal, with the
    // computed retirement year baked in, so the dashboard matches the reveal.
    const { cfg, snap } = assemble();
    cfg.career_path.exit_year = fiYear;
    cfg.divestment_strategy.end_year = fiYear;

    updateProfile({ name: name.trim(), birthYear: by, retirementYear: fiYear, retirementMonth: 0, onboarded: true });
    updateConfig(cfg);
    // The onboarding answers ARE the baseline — so every scenario (and future
    // ones) starts from the user's real income, spending, taxes, etc.
    seedBaseline(cfg);
    updateNestedSnapshot("liquid_assets", { cash_savings: snap.liquid_assets.cash_savings });
    updateNestedSnapshot("retirement_assets", { k401: snap.retirement_assets.k401, roth_ira: snap.retirement_assets.roth_ira });
    setChildren(validKids());
  };

  // Step gating: essentials on step 0; valid kid birthdays on the household step.
  const canAdvance = essentialsValid && (step !== 1 || kidsValid);
  const next = () => { if (canAdvance) setStep((s) => Math.min(REVEAL, s + 1)); };
  const skipToReveal = () => { if (canAdvance) setStep(REVEAL); };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: C.bg }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 3, height: 30, borderRadius: 2, background: C.teal }} />
          <div style={{ color: C.ink, fontSize: 14, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase" }}>Taper</div>
        </div>
        <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 600, marginTop: 18, marginBottom: 6 }}>{STEP_META[step].title}</h1>
        <p style={{ color: C.inkSoft, fontSize: 14, marginBottom: 18 }}>{STEP_META[step].subtitle}</p>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
          {STEP_META.map((_, i) => (
            <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= step ? C.teal : C.border, transition: "background 0.2s" }} />
          ))}
        </div>

        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: `0 1px 3px ${C.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* ── Step 1 — You ── */}
            {step === 0 && (
              <>
                <div>
                  <label style={labelStyle}>What should we call you?</label>
                  <input style={fieldStyle} type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Birth year</label>
                  <input style={fieldStyle} type="number" inputMode="numeric" placeholder="1985" min={1920} max={CURRENT_YEAR}
                         value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
                  {user?.displayName && (
                    <p style={{ fontSize: 12, color: C.inkFaint, marginTop: 6, lineHeight: 1.4 }}>
                      We pulled your name from Google — but Google doesn’t share your birth year, so pop it in here.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ── Step 2 — Household ── */}
            {step === 1 && (
              <>
                <button onClick={() => setHasPartner((v) => !v)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                  padding: "12px 14px", borderRadius: 10, border: `1px solid ${hasPartner ? C.teal : C.border}`,
                  background: hasPartner ? `${C.teal}14` : C.bgCard, cursor: "pointer",
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: hasPartner ? C.teal : C.inkMid }}>I have a spouse / partner</span>
                  <span style={{ width: 40, height: 23, borderRadius: 999, padding: 2, background: hasPartner ? C.teal : C.border, display: "flex", justifyContent: hasPartner ? "flex-end" : "flex-start", transition: "all 0.2s" }}>
                    <span style={{ width: 19, height: 19, borderRadius: "50%", background: "white" }} />
                  </span>
                </button>
                {hasPartner && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Partner age {optionalTag}</label>
                      <input style={fieldStyle} type="number" inputMode="numeric" placeholder="40" value={partnerAge} onChange={(e) => setPartnerAge(e.target.value)} />
                    </div>
                    <div style={{ flex: 1.4 }}>
                      <MoneyField label={<>Partner salary {optionalTag}</>} value={partnerSalary} onChange={setPartnerSalary} placeholder="90,000" />
                    </div>
                  </div>
                )}

                {kids.map((kid, i) => {
                  const yearBad = !kidYearValid(kid);
                  return (
                  <div key={i}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1.4 }}>
                      <label style={labelStyle}>Child name</label>
                      <input style={fieldStyle} type="text" placeholder="Child’s name" value={kid.name} onChange={(e) => updateKid(i, { name: e.target.value })} />
                    </div>
                    <div style={{ flex: 0.9 }}>
                      <label style={labelStyle}>Born</label>
                      <select style={selectStyle} value={kid.month} onChange={(e) => updateKid(i, { month: e.target.value })}>
                        {MONTHS.map((m, mi) => <option key={mi} value={mi}>{m}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 0.8 }}>
                      <label style={labelStyle}>Year</label>
                      <input style={{ ...fieldStyle, ...(yearBad ? { borderColor: C.warm } : {}) }} type="number" inputMode="numeric" min={1990} max={CURRENT_YEAR + 30}
                             value={kid.year} onChange={(e) => updateKid(i, { year: e.target.value })} />
                    </div>
                    <button onClick={() => removeKid(i)} aria-label="Remove child"
                      style={{ flexShrink: 0, height: 40, width: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.warm, cursor: "pointer" }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {yearBad && <p style={{ fontSize: 12, color: C.warm, marginTop: 5 }}>Add a birth year so we can time college and benefits.</p>}
                  </div>
                  );
                })}
                <button onClick={addKid}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", background: C.tealWash, border: `1px solid ${C.tealLight}`, borderRadius: 8, color: C.tealDark, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={15} /> {kids.length === 0 ? "Add a child" : "Add another child"}
                </button>
              </>
            )}

            {/* ── Step 3 — Money in ── */}
            {step === 2 && (
              <>
                <MoneyField label={<>Gross annual salary {optionalTag}</>} value={salary} onChange={setSalary} placeholder="120,000" />
                <MoneyField label={<>Current cash savings {optionalTag}</>} value={savings} onChange={setSavings} placeholder="50,000" />
                <MoneyField label={<>401(k) balance {optionalTag}</>} value={k401} onChange={setK401} placeholder="120,000" />
                <MoneyField label={<>Roth IRA balance {optionalTag}</>} value={roth} onChange={setRoth} placeholder="30,000" />
              </>
            )}

            {/* ── Step 4 — Money out ── */}
            {step === 3 && (
              <>
                <MoneyField label={<>Monthly spend, excl. housing {optionalTag}</>} value={monthlySpend} onChange={setMonthlySpend} placeholder="5,000" />
                <MoneyField label={<>Monthly rent / mortgage {optionalTag}</>} value={housing} onChange={setHousing} placeholder="2,500" />
              </>
            )}

            {/* ── Step 5 — Taxes ── */}
            {step === 4 && (
              <>
                <div>
                  <label style={labelStyle}>Filing status {optionalTag}</label>
                  <select style={selectStyle} value={filing} onChange={(e) => setFiling(e.target.value)}>
                    <option value="single">Single</option>
                    <option value="married_joint">Married Filing Jointly</option>
                    <option value="married_separate">Married Filing Separately</option>
                    <option value="head_household">Head of Household</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>State {optionalTag}</label>
                  <select style={selectStyle} value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
                    {STATE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* ── Reveal ── */}
            {onReveal && (
              <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
                {projection?.fi ? (
                  <>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.teal, marginBottom: 10 }}>
                      <Sparkles size={14} /> You can retire in
                    </div>
                    <div style={{ fontSize: 52, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{projection.fiYear}</div>
                    <div style={{ fontSize: 16, color: C.inkSoft, marginTop: 8 }}>
                      at age <strong style={{ color: C.ink }}>{projection.age}</strong> — when your portfolio covers 25× your spending.
                    </div>
                    <div style={{ marginTop: 14, fontSize: 13, color: C.inkFaint }}>
                      We’ve set this as your starting plan. Tweak any assumption and watch the date move.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 40, marginBottom: 6 }}>🌱</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>You’re on your way</div>
                    <div style={{ fontSize: 14, color: C.inkSoft, marginTop: 8 }}>
                      You’re <strong style={{ color: C.ink }}>{projection?.progress ?? 0}%</strong> of the way to financial independence.
                      Add more detail and we’ll pinpoint the year you can step back.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Navigation ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              {!isFirst && (
                <button onClick={goBack} style={{ background: "transparent", color: C.inkSoft, border: `1px solid ${C.border}`, borderRadius: 8, padding: "13px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>← Back</button>
              )}
              <div style={{ flex: 1 }} />
              {!onReveal && !isFirst && (
                <button onClick={skipToReveal} disabled={!canAdvance}
                  style={{ background: "transparent", color: canAdvance ? C.teal : C.inkFaint, border: `1px solid ${canAdvance ? C.tealLight : C.border}`, borderRadius: 8, padding: "13px 16px", fontSize: 14, fontWeight: 600, cursor: canAdvance ? "pointer" : "not-allowed" }}>
                  Skip ahead
                </button>
              )}
              {onReveal ? (
                <button onClick={commitAndEnter}
                  style={{ background: C.teal, color: "#fff", border: "none", borderRadius: 8, padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: `0 2px 8px ${C.tealLight}` }}>
                  Enter Taper →
                </button>
              ) : (
                <button onClick={next} disabled={!canAdvance}
                  style={{ background: C.teal, color: "#fff", border: "none", borderRadius: 8, padding: "13px 22px", fontSize: 14, fontWeight: 700, cursor: canAdvance ? "pointer" : "not-allowed", opacity: canAdvance ? 1 : 0.55, boxShadow: canAdvance ? `0 2px 8px ${C.tealLight}` : "none" }}>
                  {isFirst ? "Start →" : "Next →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

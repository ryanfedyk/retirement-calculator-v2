"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { C } from "@/config/colors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFinancialStore } from "@/store/useFinancialStore";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();

// Parse an optional numeric input — returns undefined when left blank so we can
// fall back to defaults for any step the user skips.
const optNum = (s: string): number | undefined => {
  const n = Number(String(s).replace(/,/g, ""));
  return s.trim() !== "" && !isNaN(n) ? n : undefined;
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
  color: C.inkSoft, marginBottom: 6, display: "block",
};
const fieldStyle: React.CSSProperties = {
  width: "100%", background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.ink, outline: "none",
};
const optionalTag = (
  <span style={{ textTransform: "none", color: C.inkFaint, fontWeight: 400 }}>(optional)</span>
);

// Defined at module scope so it isn't remounted on each parent render (which
// would drop focus mid-typing).
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

type KidDraft = { name: string; year: string };

/**
 * Stepped onboarding. Step 1 collects the essentials needed to render a
 * meaningful dashboard; the remaining steps are optional. From any step the
 * user can hit "Finish" to jump straight in, or "Add more" to keep refining.
 * Anything left blank keeps a sensible default.
 */
export default function OnboardingFlow() {
  const { user } = useAuth();
  const {
    updateProfile, updateConfig, updateCareerPath,
    updateNestedSnapshot, updateIncomeProfile, updateSpending, setChildren,
  } = useFinancialStore();

  const [step, setStep] = useState(0);

  // Step 1 — essentials (required)
  const [name, setName] = useState(user?.displayName ?? "");
  const [birthYear, setBirthYear] = useState<string>(String(CURRENT_YEAR - 40));
  const [retYear, setRetYear] = useState<string>(String(CURRENT_YEAR + 10));
  const [retMonth, setRetMonth] = useState<number>(0);

  // Step 2 — family (optional)
  const [kids, setKids] = useState<KidDraft[]>([]);

  // Step 3 — savings & accounts (optional)
  const [savings, setSavings] = useState<string>("");
  const [k401, setK401] = useState<string>("");
  const [roth, setRoth] = useState<string>("");

  // Step 4 — income & spending (optional)
  const [salary, setSalary] = useState<string>("");
  const [monthlySpend, setMonthlySpend] = useState<string>("");

  const by = Number(birthYear);
  const ry = Number(retYear);
  const essentialsValid =
    name.trim().length > 0 &&
    by >= 1920 && by <= CURRENT_YEAR &&
    ry >= CURRENT_YEAR && ry <= CURRENT_YEAR + 60;

  const STEP_META = [
    { title: "Let’s chart your horizon", subtitle: "Just a few essentials to get you started. You can refine everything later." },
    { title: "Do you have kids?", subtitle: "Add them to put their milestones on your timeline — we’ll also plan for college costs and an empty-nest phase. No kids? Just continue." },
    { title: "What have you saved?", subtitle: "Optional — a rough picture sharpens your projection. Skip any you’re unsure of." },
    { title: "Income & spending", subtitle: "Optional — helps model your runway. Leave blank to use sensible defaults." },
  ];
  const TOTAL_STEPS = STEP_META.length;
  const isFirst = step === 0;
  const isLast = step === TOTAL_STEPS - 1;

  // ── Kid helpers ──────────────────────────────────────────────────────────
  const addKid    = () => setKids((k) => [...k, { name: "", year: "" }]);
  const removeKid  = (i: number) => setKids((k) => k.filter((_, idx) => idx !== i));
  const updateKid  = (i: number, patch: Partial<KidDraft>) =>
    setKids((k) => k.map((kid, idx) => (idx === i ? { ...kid, ...patch } : kid)));

  const finish = () => {
    if (!essentialsValid) { setStep(0); return; }

    updateProfile({
      name: name.trim(),
      birthYear: by,
      retirementYear: ry,
      retirementMonth: retMonth,
      onboarded: true,
    });
    updateConfig({ birth_year: by });
    updateCareerPath({ exit_year: ry });

    // Children drive milestones, the empty-nest phase, and college costs.
    const validKids = kids
      .map((k) => ({ name: k.name.trim() || "Child", year: Number(k.year) }))
      .filter((k) => k.year >= 1990 && k.year <= CURRENT_YEAR + 30)
      .map((k) => ({ name: k.name, birthYear: k.year, birthMonth: 0 }));
    setChildren(validKids);

    // Optional fields — only applied when the user actually entered something.
    const cash = optNum(savings);
    if (cash !== undefined) updateNestedSnapshot("liquid_assets", { cash_savings: Math.max(0, cash) });
    const k = optNum(k401);
    if (k !== undefined) updateNestedSnapshot("retirement_assets", { k401: Math.max(0, k) });
    const r = optNum(roth);
    if (r !== undefined) updateNestedSnapshot("retirement_assets", { roth_ira: Math.max(0, r) });

    const gross = optNum(salary);
    if (gross !== undefined) {
      updateIncomeProfile({ gross_annual_salary: Math.max(0, gross), google_net_monthly: Math.round(Math.max(0, gross) * 0.65 / 12) });
    }
    const spend = optNum(monthlySpend);
    if (spend !== undefined) updateSpending({ monthly_lifestyle: Math.max(0, spend) });
  };

  const addMore = () => {
    if (!essentialsValid) return;
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: C.bg }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 3, height: 30, borderRadius: 2, background: C.teal }} />
          <div style={{ color: C.ink, fontSize: 14, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Horizon
          </div>
        </div>
        <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 600, marginTop: 18, marginBottom: 6 }}>
          {STEP_META[step].title}
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 14, marginBottom: 18 }}>
          {STEP_META[step].subtitle}
        </p>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              height: 4, flex: 1, borderRadius: 2,
              background: i <= step ? C.teal : C.border, transition: "background 0.2s",
            }} />
          ))}
        </div>

        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: `0 1px 3px ${C.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* ── Step 1 — Essentials ── */}
            {step === 0 && (
              <>
                <div>
                  <label style={labelStyle}>What should we call you?</label>
                  <input style={fieldStyle} type="text" placeholder="Your name" value={name}
                         onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Birth year</label>
                  <input style={fieldStyle} type="number" inputMode="numeric" placeholder="1985"
                         min={1920} max={CURRENT_YEAR} value={birthYear}
                         onChange={(e) => setBirthYear(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Target retirement date</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <select style={{ ...fieldStyle, flex: 1.4 }} value={retMonth}
                            onChange={(e) => setRetMonth(Number(e.target.value))}>
                      {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                    <input style={{ ...fieldStyle, flex: 1 }} type="number" inputMode="numeric"
                           min={CURRENT_YEAR} max={CURRENT_YEAR + 60} value={retYear}
                           onChange={(e) => setRetYear(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* ── Step 2 — Family ── */}
            {step === 1 && (
              <>
                {kids.map((kid, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1.5 }}>
                      <label style={labelStyle}>Name</label>
                      <input style={fieldStyle} type="text" placeholder="Child’s name" value={kid.name}
                             onChange={(e) => updateKid(i, { name: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Birth year</label>
                      <input style={fieldStyle} type="number" inputMode="numeric" placeholder="2015" value={kid.year}
                             onChange={(e) => updateKid(i, { year: e.target.value })} />
                    </div>
                    <button onClick={() => removeKid(i)} aria-label="Remove child"
                      style={{ flexShrink: 0, height: 40, width: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.warm, cursor: "pointer" }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button onClick={addKid}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "11px 0", background: C.tealWash, border: `1px solid ${C.tealLight}`, borderRadius: 8, color: C.tealDark, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={15} /> {kids.length === 0 ? "Add a child" : "Add another child"}
                </button>
              </>
            )}

            {/* ── Step 3 — Savings & accounts ── */}
            {step === 2 && (
              <>
                <MoneyField label={<>Current cash savings {optionalTag}</>} value={savings} onChange={setSavings} placeholder="50,000" />
                <MoneyField label={<>401(k) balance {optionalTag}</>} value={k401} onChange={setK401} placeholder="120,000" />
                <MoneyField label={<>Roth IRA balance {optionalTag}</>} value={roth} onChange={setRoth} placeholder="30,000" />
              </>
            )}

            {/* ── Step 4 — Income & spending ── */}
            {step === 3 && (
              <>
                <MoneyField label={<>Gross annual salary {optionalTag}</>} value={salary} onChange={setSalary} placeholder="120,000" />
                <MoneyField label={<>Monthly lifestyle spend {optionalTag}</>} value={monthlySpend} onChange={setMonthlySpend} placeholder="5,000" />
              </>
            )}

            {/* ── Navigation ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              {!isFirst && (
                <button
                  onClick={goBack}
                  style={{
                    background: "transparent", color: C.inkSoft, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "13px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  ← Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              {!isLast && (
                <button
                  onClick={addMore}
                  disabled={!essentialsValid}
                  style={{
                    background: "transparent", color: essentialsValid ? C.teal : C.inkFaint,
                    border: `1px solid ${essentialsValid ? C.tealLight : C.border}`, borderRadius: 8,
                    padding: "13px 18px", fontSize: 14, fontWeight: 600,
                    cursor: essentialsValid ? "pointer" : "not-allowed",
                  }}
                >
                  Add more
                </button>
              )}
              <button
                onClick={finish}
                disabled={!essentialsValid}
                style={{
                  background: C.teal, color: "#fff", border: "none", borderRadius: 8,
                  padding: "13px 22px", fontSize: 14, fontWeight: 700,
                  cursor: essentialsValid ? "pointer" : "not-allowed", opacity: essentialsValid ? 1 : 0.55,
                  boxShadow: essentialsValid ? `0 2px 8px ${C.tealLight}` : "none",
                }}
              >
                Finish →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

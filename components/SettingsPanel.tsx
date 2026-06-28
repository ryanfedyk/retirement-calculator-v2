"use client";
import { useEffect } from "react";
import { X, Trash2, Plus, RotateCcw } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { useConfirm } from "@/components/ui/DialogProvider";
import { STATE_OPTIONS } from "@/engine/state_tax";
import { estimateMonthlySocialSecurity, estimatePIA, estimateSpousalBenefit } from "@/engine/social_security";
import { ageFromISO, isoDate, yearOfISO } from "@/config/sharedConfig";
import LinkedNumberField from "@/components/finance/LinkedNumberField";

// ── Primitives (touch-friendly; fontSize 16 avoids iOS zoom) ──────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "10px 12px", fontSize: 15, color: C.ink, background: C.bg, outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
  color: C.inkSoft, display: "block", marginBottom: 5,
};
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div style={{ marginBottom: 13 }}>
    <span style={labelStyle}>{label}</span>
    {children}
    {hint && <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 4 }}>{hint}</div>}
  </div>
);
const Two = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
);
const Num = ({ value, onChange, step = 1, prefix }: { value: number; onChange: (v: number) => void; step?: number; prefix?: string }) => (
  <div style={{ position: "relative" }}>
    {prefix && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.inkFaint, fontSize: 15 }}>{prefix}</span>}
    <input type="number" inputMode="decimal" step={step} value={value}
      onChange={e => onChange(e.target.value === "" ? 0 : +e.target.value)}
      style={{ ...inputStyle, paddingLeft: prefix ? 24 : 12 }} />
  </div>
);
const todayISO = new Date().toISOString().slice(0, 10);
const DateField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <input type="date" max={todayISO} value={value || ""}
    onChange={e => { if (e.target.value) onChange(e.target.value); }}
    style={{ ...inputStyle, cursor: "pointer" }} />
);
const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }} />
);
const stepBtnStyle: React.CSSProperties = {
  padding: "8px 16px", background: C.bgCard, border: "none", cursor: "pointer",
  fontSize: 18, lineHeight: 1, fontWeight: 700, color: C.teal,
};
const Stepper = ({ value, onChange, min = 0, max = 20 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
  <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.border}`, borderRadius: 8, width: "fit-content", overflow: "hidden" }}>
    <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))} style={stepBtnStyle}>−</button>
    <span style={{ minWidth: 46, textAlign: "center", fontSize: 15, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums", borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: "8px 0" }}>{value}</span>
    <button type="button" aria-label="Increase" onClick={() => onChange(Math.min(max, value + 1))} style={stepBtnStyle}>+</button>
  </div>
);
const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button onClick={() => onChange(!on)} style={{
    display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
    padding: "12px 14px", borderRadius: 10, marginBottom: 10,
    border: `1px solid ${on ? C.teal : C.border}`, background: on ? `${C.teal}14` : C.bgCard, cursor: "pointer",
  }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: on ? C.teal : C.inkMid }}>{label}</span>
    <span style={{ width: 40, height: 23, borderRadius: 999, padding: 2, background: on ? C.teal : C.border, display: "flex", justifyContent: on ? "flex-end" : "flex-start", transition: "all 0.2s" }}>
      <span style={{ width: 19, height: 19, borderRadius: "50%", background: "white" }} />
    </span>
  </button>
);
const Section = ({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
      <span style={{ width: 4, height: 16, borderRadius: 2, background: accent }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: "0.02em" }}>{title}</span>
    </div>
    {children}
  </div>
);

/**
 * Profile — the stable "who you are" facts (birthday, family, location, taxes,
 * Social Security & Medicare) plus the baseline market assumptions and the one
 * true app setting (Display). The money that changes most — income and
 * spending — lives in "Your finances" instead. Opened from the profile menu.
 */
export default function SettingsPanel() {
  const open = useUIStore(s => s.settingsOpen);
  const setOpen = useUIStore(s => s.setSettingsOpen);
  const dollarMode = useUIStore(s => s.dollarMode);
  const setDollarMode = useUIStore(s => s.setDollarMode);
  const { baseline, profile, updateProfile, updateConfig, updateBaseline, setChildren, resetToDefaults } = useFinancialStore();
  const confirm = useConfirm();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Profile edits the shared **baseline** — the "real you" that flows into every
  // scenario unless a scenario has overridden a given field.
  const ip = baseline.income_profile;
  const ss = baseline.social_security;
  const ta = baseline.tax_assumptions;
  const ma = baseline.market_assumptions;
  const kids = profile.children;
  // Partner SS = the GREATER of their own benefit or a spousal benefit (up to
  // 50% of the primary's), so a partner with no earnings record still draws on
  // the primary's record — mirrors the engine so the displayed number matches.
  const partnerSSEstimate = Math.max(
    estimateMonthlySocialSecurity(ip.partner_gross_annual_salary || 0, ss?.start_age ?? 67),
    estimateSpousalBenefit(estimatePIA(ip.gross_annual_salary, 35), ss?.start_age ?? 67),
  );
  // Suggested W-4 allowances ≈ self (+ spouse) + dependents.
  const suggestedAllowances = (ta.filing_status === "married_joint" ? 2 : 1) + kids.length;
  const thisYear = new Date().getFullYear();
  const age = ageFromISO(profile.birthDate);
  const setBirthDate = (iso: string) => {
    updateProfile({ birthDate: iso });
    updateConfig({ birth_year: yearOfISO(iso) });
  };
  const partnerBirthDate = ip.partner_birth_date ?? (ip.partner_birth_year ? isoDate(ip.partner_birth_year) : profile.birthDate);
  const setPartnerBirthDate = (iso: string) =>
    updateBaseline("income_profile", { partner_birth_date: iso, partner_birth_year: yearOfISO(iso) });

  return (
    <>
      <div onClick={() => setOpen(false)} style={{
        position: "fixed", inset: 0, zIndex: 70, background: "rgba(26,46,37,0.45)", backdropFilter: "blur(2px)",
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s ease",
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 71, width: "min(440px, 100vw)",
        background: C.bg, boxShadow: "-8px 0 40px rgba(0,0,0,0.18)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ flexShrink: 0, padding: "18px 20px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>Profile</h2>
          <button onClick={() => setOpen(false)} aria-label="Close profile"
            style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={17} color={C.inkSoft} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px calc(28px + env(safe-area-inset-bottom))" }}>

          {/* ── About You ── */}
          <Section title="About You" accent={C.teal}>
            <Field label="Your Birthday" hint={`Age ${age} · your birthday keeps taxes, Medicare timing, the projection horizon and milestones precise.`}>
              <DateField value={profile.birthDate} onChange={setBirthDate} />
            </Field>
          </Section>

          {/* ── Family ── */}
          <Section title="Family" accent="#7a6da8">
            <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 12, lineHeight: 1.5 }}>
              Adding kids plots their milestones, plans college costs, and sets the empty-nest phase. Full birthdays make milestone timing exact.
            </div>
            {kids.map((child, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input placeholder="Child's name" value={child.name} style={inputStyle}
                  onChange={e => setChildren(kids.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))} />
                <DateField value={child.birthDate}
                  onChange={iso => setChildren(kids.map((c, i) => i === idx ? { ...c, birthDate: iso } : c))} />
                <button onClick={() => setChildren(kids.filter((_, i) => i !== idx))} aria-label="Remove child"
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, display: "flex" }}><Trash2 size={17} /></button>
              </div>
            ))}
            <button onClick={() => setChildren([...kids, { name: "", birthDate: isoDate(thisYear - 5, 0, 1) }])}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, border: `1px solid ${C.tealLight}`, background: C.tealWash, color: C.tealDark, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}>
              <Plus size={15} /> Add child
            </button>

            <Toggle label="I have a partner" on={ip.use_partner_income || false} onChange={v => updateBaseline("income_profile", { use_partner_income: v })} />
            {ip.use_partner_income && (
              <Field label="Partner's Birthday" hint="Informs their Medicare and Social Security timing. Partner income & retirement year are set in the Scenario plan (Additional Income).">
                <DateField value={partnerBirthDate} onChange={setPartnerBirthDate} />
              </Field>
            )}
          </Section>

          {/* ── Baseline note ── income & spending now live in Your Finances. */}
          <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: C.tealWash, border: `1px solid ${C.tealLight}` }}>
            The sections below are your <strong>baseline</strong> assumptions — every scenario starts from them, except where you&apos;ve overridden a field. Looking for income or spending? They now live in <strong>Your Finances</strong>.
          </div>

          {/* ── Location & Taxes ── */}
          <Section title="Location & Taxes" accent={C.inkMid}>
            <Field label="State of Residence">
              <Select value={ta.state_of_residence} onChange={e => updateBaseline("tax_assumptions", { state_of_residence: e.target.value as any })}>
                {STATE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Filing Status">
              <Select value={ta.filing_status} onChange={e => updateBaseline("tax_assumptions", { filing_status: e.target.value as any })}>
                <option value="single">Single</option>
                <option value="married_joint">Married Filing Jointly</option>
                <option value="married_separate">Married Filing Separately</option>
                <option value="head_household">Head of Household</option>
              </Select>
            </Field>
            <Field label="Deductions (W-4)" hint={`Allowances you claim on your W-4 — like 1, 2, 3, 4… for the people in your household. Each lowers taxable income (~$4,300); the standard deduction applies on top. Your household: ${suggestedAllowances} (you${ta.filing_status === "married_joint" ? " + spouse" : ""}${kids.length ? ` + ${kids.length} kid${kids.length > 1 ? "s" : ""}` : ""}).`}>
              <Stepper value={ta.w4_allowances ?? suggestedAllowances} onChange={v => updateBaseline("tax_assumptions", { w4_allowances: v })} />
            </Field>
          </Section>

          {/* ── Social Security & Medicare ── */}
          <Section title="Social Security & Medicare" accent={C.inkSoft}>
            <Two>
              <Field label="SS Claim Age"><Num value={ss?.start_age ?? 67} onChange={v => updateBaseline("social_security", { start_age: v } as any)} /></Field>
              <Field label="SS Monthly ($)">
                <LinkedNumberField
                  linked={ss?.social_security_linked !== false}
                  displayValue={ss?.social_security_linked !== false
                    ? estimateMonthlySocialSecurity(ip.gross_annual_salary, ss?.start_age ?? 67)
                    : (ss?.monthly_amount ?? 0)}
                  onOverride={() => updateBaseline("social_security", { social_security_linked: false, monthly_amount: estimateMonthlySocialSecurity(ip.gross_annual_salary, ss?.start_age ?? 67) } as any)}
                  onChange={v => updateBaseline("social_security", { monthly_amount: v, social_security_linked: false } as any)}
                  onRelink={() => updateBaseline("social_security", { social_security_linked: true } as any)} />
              </Field>
            </Two>
            <div style={{ fontSize: 10, color: C.inkFaint, marginTop: -6, marginBottom: 12 }}>
              {ss?.social_security_linked !== false ? "Estimated from your income · ✎ to override" : "Manual · ↺ to re-estimate"}
            </div>
            {ip.use_partner_income && (
              <Field label="Partner SS Monthly ($)" hint={`Begins when your partner reaches age ${ss?.start_age ?? 67}. ${ss?.partner_ss_linked !== false ? "Estimated from their income · ✎ to override" : "Manual · ↺ to re-estimate"}`}>
                <LinkedNumberField
                  linked={ss?.partner_ss_linked !== false}
                  displayValue={ss?.partner_ss_linked !== false
                    ? partnerSSEstimate
                    : (ss?.partner_monthly_amount ?? 0)}
                  onOverride={() => updateBaseline("social_security", { partner_ss_linked: false, partner_monthly_amount: partnerSSEstimate } as any)}
                  onChange={v => updateBaseline("social_security", { partner_monthly_amount: v, partner_ss_linked: false } as any)}
                  onRelink={() => updateBaseline("social_security", { partner_ss_linked: true } as any)} />
              </Field>
            )}
            <Two>
              <Field label="Medicare Age"><Num value={baseline.medicare?.start_age ?? 65} onChange={v => updateBaseline("medicare", { start_age: v } as any)} /></Field>
              <Field label="Medicare $/mo"><Num prefix="$" step={25} value={baseline.medicare?.monthly_premium ?? 185} onChange={v => updateBaseline("medicare", { monthly_premium: v } as any)} /></Field>
            </Two>
          </Section>

          {/* ── Market Assumptions (advanced) ── */}
          <Section title="Market Assumptions" accent="#7a6da8">
            <Two>
              <Field label="Market Return (%)"><Num step={0.1} value={ma.market_return_rate} onChange={v => updateBaseline("market_assumptions", { market_return_rate: v })} /></Field>
              <Field label="Inflation (%)"><Num step={0.25} value={ma.inflation_rate} onChange={v => updateBaseline("market_assumptions", { inflation_rate: v })} /></Field>
            </Two>
            <Two>
              <Field label="Volatility Drag (%)"><Num step={0.1} value={ma.volatility_drag} onChange={v => updateBaseline("market_assumptions", { volatility_drag: v })} /></Field>
              <Field label="Healthcare Inflation over CPI (%)"><Num step={0.25} value={ma.healthcare_inflation_premium ?? 2} onChange={v => updateBaseline("market_assumptions", { healthcare_inflation_premium: v })} /></Field>
            </Two>
          </Section>

          {/* ── Display ── the only true app setting. */}
          <Section title="Display" accent="#3a7d9c">
            <Field
              label="Dollar amounts"
              hint={
                dollarMode === "future"
                  ? "Future dollars — face value in each year, inflated by your CPI assumption. Big numbers, but a dollar buys less."
                  : "Today's dollars — every figure in current purchasing power, so amounts across years are directly comparable."
              }
            >
              <div style={{ display: "flex", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 3 }}>
                {([["today", "Today's $"], ["future", "Future $"]] as const).map(([id, label]) => {
                  const active = dollarMode === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setDollarMode(id)}
                      aria-pressed={active}
                      style={{
                        flex: 1, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                        fontSize: 14, fontWeight: 600,
                        background: active ? C.teal : "transparent",
                        color: active ? "#fff" : C.inkMid,
                        transition: "all 0.15s",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </Section>

          {/* ── Reset ── */}
          <Section title="Reset" accent={C.warm}>
            <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 12, lineHeight: 1.5 }}>
              Clear your plan and balance sheet and walk back through the quick setup. This can&apos;t be undone.
            </div>
            <button
              onClick={async () => {
                if (await confirm({ title: "Start over?", message: "This clears your plan and balance sheet and walks you back through the quick setup. It can't be undone.", confirmLabel: "Start over", danger: true })) {
                  resetToDefaults();
                  setOpen(false);
                }
              }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", borderRadius: 10, border: "1px solid #e0b4a6", background: "#fdece8", color: "#a23818", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              <RotateCcw size={15} /> Start over
            </button>
          </Section>
        </div>
      </div>
    </>
  );
}

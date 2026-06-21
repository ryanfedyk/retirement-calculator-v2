"use client";
import { useEffect } from "react";
import { X, Trash2, Plus } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { STATE_OPTIONS } from "@/engine/state_tax";
import { estimateMonthlySocialSecurity } from "@/engine/social_security";
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
const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }} />
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
 * Global Settings — the stable "who you are" facts (age, family, location,
 * taxes, Social Security & Medicare), separated from the scenario "plan" in the
 * main config panel. Opened from the profile menu.
 */
export default function SettingsPanel() {
  const open = useUIStore(s => s.settingsOpen);
  const setOpen = useUIStore(s => s.setSettingsOpen);
  const { config, profile, updateProfile, updateConfig, updateNestedConfig, setChildren } = useFinancialStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const ip = config.income_profile;
  const ss = config.social_security;
  const ta = config.tax_assumptions;
  const kids = profile.children;
  const thisYear = new Date().getFullYear();
  const age = thisYear - (config.birth_year || profile.birthYear || 1985);
  const setAge = (a: number) => {
    const birthYear = thisYear - Math.max(0, a);
    updateProfile({ birthYear });
    updateConfig({ birth_year: birthYear });
  };

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
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>Settings</h2>
          <button onClick={() => setOpen(false)} aria-label="Close settings"
            style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={17} color={C.inkSoft} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px calc(28px + env(safe-area-inset-bottom))" }}>

          {/* ── You ── */}
          <Section title="You" accent={C.teal}>
            <Field label="Your Age" hint={`Birth year ${thisYear - age} · used for taxes, Medicare timing, and the projection horizon`}>
              <Num value={age} onChange={setAge} />
            </Field>
          </Section>

          {/* ── Family ── */}
          <Section title="Family" accent="#7a6da8">
            <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 12, lineHeight: 1.5 }}>
              Adding kids plots their milestones, plans college costs, and sets the empty-nest phase.
            </div>
            {kids.map((child, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input placeholder="Child's name" value={child.name} style={inputStyle}
                  onChange={e => setChildren(kids.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))} />
                <input type="number" inputMode="numeric" placeholder="Birth yr" value={child.birthYear} style={inputStyle}
                  onChange={e => setChildren(kids.map((c, i) => i === idx ? { ...c, birthYear: +e.target.value || c.birthYear } : c))} />
                <button onClick={() => setChildren(kids.filter((_, i) => i !== idx))} aria-label="Remove child"
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, display: "flex" }}><Trash2 size={17} /></button>
              </div>
            ))}
            <button onClick={() => setChildren([...kids, { name: "", birthYear: thisYear - 5, birthMonth: 0 }])}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, border: `1px solid ${C.tealLight}`, background: C.tealWash, color: C.tealDark, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}>
              <Plus size={15} /> Add child
            </button>

            <Toggle label="I have a partner" on={ip.use_partner_income || false} onChange={v => updateNestedConfig("income_profile", { use_partner_income: v })} />
            {ip.use_partner_income && (
              <Field label="Partner's Age" hint="Informs their Medicare and Social Security timing. Partner income & retirement year are set in the plan (Additional Income).">
                <Num value={ip.partner_birth_year ? thisYear - ip.partner_birth_year : age}
                  onChange={v => updateNestedConfig("income_profile", { partner_birth_year: thisYear - Math.max(0, v) })} />
              </Field>
            )}
          </Section>

          {/* ── Location & Taxes ── */}
          <Section title="Location & Taxes" accent={C.inkMid}>
            <Field label="State of Residence">
              <Select value={ta.state_of_residence} onChange={e => updateNestedConfig("tax_assumptions", { state_of_residence: e.target.value as any })}>
                {STATE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Filing Status">
              <Select value={ta.filing_status} onChange={e => updateNestedConfig("tax_assumptions", { filing_status: e.target.value as any })}>
                <option value="single">Single</option>
                <option value="married_joint">Married Filing Jointly</option>
                <option value="married_separate">Married Filing Separately</option>
                <option value="head_household">Head of Household</option>
              </Select>
            </Field>
            <Field label="Deductions (W-4)" hint="Number of withholding allowances you claim on your W-4 — each lowers taxable income (~$4,300). The standard deduction is applied automatically on top.">
              <Num value={ta.w4_allowances ?? 0} onChange={v => updateNestedConfig("tax_assumptions", { w4_allowances: Math.max(0, Math.round(v)) })} />
            </Field>
          </Section>

          {/* ── Social Security & Medicare ── */}
          <Section title="Social Security & Medicare" accent={C.inkSoft}>
            <Two>
              <Field label="SS Claim Age"><Num value={ss?.start_age ?? 67} onChange={v => updateNestedConfig("social_security", { start_age: v } as any)} /></Field>
              <Field label="SS Monthly ($)">
                <LinkedNumberField
                  linked={ss?.social_security_linked !== false}
                  displayValue={ss?.social_security_linked !== false
                    ? estimateMonthlySocialSecurity(ip.gross_annual_salary, ss?.start_age ?? 67)
                    : (ss?.monthly_amount ?? 0)}
                  onOverride={() => updateNestedConfig("social_security", { social_security_linked: false, monthly_amount: estimateMonthlySocialSecurity(ip.gross_annual_salary, ss?.start_age ?? 67) } as any)}
                  onChange={v => updateNestedConfig("social_security", { monthly_amount: v, social_security_linked: false } as any)}
                  onRelink={() => updateNestedConfig("social_security", { social_security_linked: true } as any)} />
              </Field>
            </Two>
            <div style={{ fontSize: 10, color: C.inkFaint, marginTop: -6, marginBottom: 12 }}>
              {ss?.social_security_linked !== false ? "Estimated from your income · ✎ to override" : "Manual · ↺ to re-estimate"}
            </div>
            {ip.use_partner_income && (
              <>
                <Field label="Partner SS Monthly ($)" hint={`Begins when your partner reaches age ${ss?.start_age ?? 67}. ${ss?.partner_ss_linked !== false ? "Estimated from their income · ✎ to override" : "Manual · ↺ to re-estimate"}`}>
                  <LinkedNumberField
                    linked={ss?.partner_ss_linked !== false}
                    displayValue={ss?.partner_ss_linked !== false
                      ? estimateMonthlySocialSecurity(ip.partner_gross_annual_salary || 0, ss?.start_age ?? 67)
                      : (ss?.partner_monthly_amount ?? 0)}
                    onOverride={() => updateNestedConfig("social_security", { partner_ss_linked: false, partner_monthly_amount: estimateMonthlySocialSecurity(ip.partner_gross_annual_salary || 0, ss?.start_age ?? 67) } as any)}
                    onChange={v => updateNestedConfig("social_security", { partner_monthly_amount: v, partner_ss_linked: false } as any)}
                    onRelink={() => updateNestedConfig("social_security", { partner_ss_linked: true } as any)} />
                </Field>
              </>
            )}
            <Two>
              <Field label="Medicare Age"><Num value={config.medicare?.start_age ?? 65} onChange={v => updateNestedConfig("medicare", { start_age: v } as any)} /></Field>
              <Field label="Medicare $/mo"><Num prefix="$" step={25} value={config.medicare?.monthly_premium ?? 185} onChange={v => updateNestedConfig("medicare", { monthly_premium: v } as any)} /></Field>
            </Two>
          </Section>
        </div>
      </div>
    </>
  );
}

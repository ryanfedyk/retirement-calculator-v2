"use client";
import { useEffect, useState } from "react";
import { X, ChevronDown, Trash2, Plus, RotateCcw } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import TickerAutocomplete from "@/components/finance/TickerAutocomplete";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

// ── Touch-friendly primitives (fontSize 16 avoids iOS auto-zoom) ───────────────
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`,
  borderRadius: 10, padding: "11px 12px", fontSize: 16, color: C.ink,
  background: C.bgCard, outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
  color: C.inkSoft, display: "block", marginBottom: 6,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><span style={labelStyle}>{label}</span>{children}</div>;
}
function Num({ value, onChange, step = 1, prefix }: { value: number; onChange: (v: number) => void; step?: number; prefix?: string }) {
  return (
    <div style={{ position: "relative" }}>
      {prefix && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.inkFaint, fontSize: 16 }}>{prefix}</span>}
      <input type="number" inputMode="decimal" step={step} value={value}
        onChange={e => onChange(e.target.value === "" ? 0 : +e.target.value)}
        style={{ ...inputStyle, paddingLeft: prefix ? 26 : 12 }} />
    </div>
  );
}
function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={inputStyle} />;
}
function Pick({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
function Toggle({ on, onChange, label, color = C.teal }: { on: boolean; onChange: (v: boolean) => void; label: string; color?: string }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
      padding: "13px 14px", borderRadius: 12, marginBottom: 8,
      border: `1px solid ${on ? color : C.border}`, background: on ? `${color}14` : C.bgCard, cursor: "pointer",
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: on ? color : C.inkMid }}>{label}</span>
      <span style={{ width: 42, height: 24, borderRadius: 999, padding: 2, background: on ? color : C.border, display: "flex", justifyContent: on ? "flex-end" : "flex-start", transition: "all 0.2s" }}>
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </span>
    </button>
  );
}
function Two({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>;
}

// ── Accordion section ─────────────────────────────────────────────────────────
function Section({ title, accent, openId, setOpenId, id, children }: {
  title: string; accent: string; openId: string | null; setOpenId: (v: string | null) => void; id: string; children: React.ReactNode;
}) {
  const open = openId === id;
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: C.bgCard, marginBottom: 10, overflow: "hidden" }}>
      <button onClick={() => setOpenId(open ? null : id)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px", background: "transparent", border: "none", cursor: "pointer",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 18, borderRadius: 2, background: accent }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{title}</span>
        </span>
        <ChevronDown size={18} color={C.inkSoft} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && <div style={{ padding: "0 16px 18px" }}>{children}</div>}
    </div>
  );
}

export default function ConfigSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, snapshot, updateNestedConfig, updateNestedSnapshot, updateConfig, resetToDefaults } = useFinancialStore();
  const [openId, setOpenId] = useState<string | null>("quick");
  const [newEvent, setNewEvent] = useState({ name: "", year: 2030, cost: 50_000 });
  const [newInv, setNewInv] = useState({ symbol: "", name: "", shares: "", ret: "" });

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const cp = config.career_path;
  const ip = config.income_profile;
  const ma = config.market_assumptions;
  const sp = config.spending;
  const sec = (id: string) => ({ openId, setOpenId, id });

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 60, background: "rgba(26,46,37,0.45)", backdropFilter: "blur(2px)",
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s ease",
      }} />
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61,
        background: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
        height: "92vh", display: "flex", flexDirection: "column",
      }}>
        {/* Grabber + header */}
        <div style={{ flexShrink: 0, padding: "8px 20px 12px" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 10px" }}>
            <div style={{ width: 40, height: 5, borderRadius: 999, background: C.border }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 20, fontWeight: 300, color: C.ink }}>Adjust your plan</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { if (confirm("Reset all settings to defaults?")) resetToDefaults(); }}
                style={{ height: 34, padding: "0 12px", borderRadius: 999, border: `1px solid ${C.border}`, background: C.bgCard, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: C.inkSoft, fontSize: 12 }}>
                <RotateCcw size={13} /> Reset
              </button>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} color={C.inkSoft} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px calc(28px + env(safe-area-inset-bottom))", WebkitOverflowScrolling: "touch" }}>

          {/* ── Quick adjust (always-open feel) ── */}
          <Section title="Quick Adjust" accent={C.teal} {...sec("quick")}>
            <Field label={`Career Exit Year — ${cp.exit_year}`}>
              <input type="range" min={2024} max={2040} step={1} value={cp.exit_year}
                style={{ width: "100%", accentColor: C.teal, height: 28 }}
                onChange={e => {
                  const yr = +e.target.value;
                  updateNestedConfig("career_path", { exit_year: yr });
                  if (config.divestment_strategy.type === "progressive") {
                    const w = config.divestment_strategy.end_year - config.divestment_strategy.start_year;
                    updateNestedConfig("divestment_strategy", { start_year: yr, end_year: yr + w });
                  }
                }} />
            </Field>
            <Field label={`Monthly Spend — ${money(sp.monthly_lifestyle)}`}>
              <input type="range" min={3000} max={35000} step={250} value={sp.monthly_lifestyle}
                style={{ width: "100%", accentColor: C.warm, height: 28 }}
                onChange={e => updateNestedConfig("spending", { monthly_lifestyle: +e.target.value })} />
            </Field>
            <Toggle label="Take a Sabbatical" color="#d98a3d" on={cp.use_sabbatical} onChange={v => updateNestedConfig("career_path", { use_sabbatical: v })} />
            <Toggle label="Model a Career Jump" color="#2a9d7f" on={cp.use_jump} onChange={v => updateNestedConfig("career_path", { use_jump: v })} />
            <Toggle label="Model a Bridge Job" color="#3a7d9c" on={cp.use_bridge} onChange={v => updateNestedConfig("career_path", { use_bridge: v })} />
          </Section>

          {/* ── Assets & Liabilities ── */}
          <Section title="Assets & Liabilities" accent={C.teal} {...sec("assets")}>
            <Field label="Cash Savings"><Num prefix="$" step={1000} value={snapshot.liquid_assets.cash_savings} onChange={v => updateNestedSnapshot("liquid_assets", { cash_savings: v })} /></Field>
            <Two>
              <Field label="401(k)"><Num prefix="$" step={1000} value={snapshot.retirement_assets.k401} onChange={v => updateNestedSnapshot("retirement_assets", { k401: v })} /></Field>
              <Field label="Roth IRA"><Num prefix="$" step={1000} value={snapshot.retirement_assets.roth_ira} onChange={v => updateNestedSnapshot("retirement_assets", { roth_ira: v })} /></Field>
            </Two>
            <Field label="Traditional IRA"><Num prefix="$" step={1000} value={snapshot.retirement_assets.traditional_ira} onChange={v => updateNestedSnapshot("retirement_assets", { traditional_ira: v })} /></Field>
            <Two>
              <Field label="Mortgage Balance"><Num prefix="$" step={1000} value={snapshot.liabilities.mortgage_balance} onChange={v => updateNestedSnapshot("liabilities", { mortgage_balance: v })} /></Field>
              <Field label="Consumer Debt"><Num prefix="$" step={500} value={snapshot.liabilities.consumer_debt} onChange={v => updateNestedSnapshot("liabilities", { consumer_debt: v })} /></Field>
            </Two>
          </Section>

          {/* ── Career & Phases ── */}
          <Section title="Career & Phases" accent="#2a9d7f" {...sec("career")}>
            <Toggle label="Take a Sabbatical" color="#d98a3d" on={cp.use_sabbatical} onChange={v => updateNestedConfig("career_path", { use_sabbatical: v })} />
            {cp.use_sabbatical && <Field label="Sabbatical Duration (years)"><Num value={cp.sabbatical_duration} onChange={v => updateNestedConfig("career_path", { sabbatical_duration: v })} /></Field>}

            <Toggle label="Model a Career Jump" color="#2a9d7f" on={cp.use_jump} onChange={v => updateNestedConfig("career_path", { use_jump: v })} />
            {cp.use_jump && (
              <div style={{ marginBottom: 6 }}>
                <Two>
                  <Field label="Duration (yrs)"><Num value={cp.jump_duration} onChange={v => updateNestedConfig("career_path", { jump_duration: v })} /></Field>
                  <Field label="Bonus (%)"><Num value={ip.jump_bonus_rate || 0} onChange={v => updateNestedConfig("income_profile", { jump_bonus_rate: v })} /></Field>
                </Two>
                <Field label="Annual Base Salary"><Num prefix="$" step={1000} value={ip.jump_gross_annual} onChange={v => updateNestedConfig("income_profile", { jump_gross_annual: v })} /></Field>
                <Field label="Annual Equity"><Num prefix="$" step={1000} value={(ip.jump_grant_monthly || 0) * 12} onChange={v => updateNestedConfig("income_profile", { jump_grant_monthly: v / 12 })} /></Field>
              </div>
            )}

            <Toggle label="Model a Bridge Job" color="#3a7d9c" on={cp.use_bridge} onChange={v => updateNestedConfig("career_path", { use_bridge: v })} />
            {cp.use_bridge && (
              <div style={{ marginBottom: 6 }}>
                <Two>
                  <Field label="Duration (yrs)"><Num value={cp.bridge_duration} onChange={v => updateNestedConfig("career_path", { bridge_duration: v })} /></Field>
                  <Field label="Gross Salary"><Num prefix="$" step={1000} value={ip.bridge_gross_annual || 0} onChange={v => updateNestedConfig("income_profile", { bridge_gross_annual: v })} /></Field>
                </Two>
                <Toggle label="Supplies Health Insurance" on={ip.bridge_has_health_insurance || false} onChange={v => updateNestedConfig("income_profile", { bridge_has_health_insurance: v })} />
              </div>
            )}
          </Section>

          {/* ── Income ── */}
          <Section title="Income" accent="#4aab92" {...sec("income")}>
            <Field label="Gross Annual Salary">
              <Num prefix="$" step={1000} value={ip.gross_annual_salary || 0}
                onChange={v => updateNestedConfig("income_profile", { gross_annual_salary: v, google_net_monthly: Math.round(v * 0.65 / 12) })} />
            </Field>
            <Two>
              <Field label="Annual Raise (%)"><Num step={0.1} value={ip.income_growth_rate ?? 0} onChange={v => updateNestedConfig("income_profile", { income_growth_rate: v })} /></Field>
              <Field label="Target Bonus (%)"><Num value={ip.target_bonus_rate ?? 0} onChange={v => updateNestedConfig("income_profile", { target_bonus_rate: v })} /></Field>
            </Two>
            <Two>
              <Field label="Unvested Shares"><Num value={ip.initial_unvested_shares ?? 0} onChange={v => updateNestedConfig("income_profile", { initial_unvested_shares: v })} /></Field>
              <Field label="Vesting (yrs)"><Num value={ip.vesting_years ?? 4} onChange={v => updateNestedConfig("income_profile", { vesting_years: v })} /></Field>
            </Two>
            <Field label="Annual Equity Refresher"><Num prefix="$" step={1000} value={ip.annual_equity_grant ?? 0} onChange={v => updateNestedConfig("income_profile", { annual_equity_grant: v })} /></Field>
            <Two>
              <Field label="401(k) Contribution / yr"><Num prefix="$" step={500} value={ip.annual_401k_contribution ?? 0} onChange={v => updateNestedConfig("income_profile", { annual_401k_contribution: v })} /></Field>
              <Field label="Backdoor Roth / yr"><Num prefix="$" step={500} value={ip.annual_backdoor_roth ?? 0} onChange={v => updateNestedConfig("income_profile", { annual_backdoor_roth: v })} /></Field>
            </Two>
          </Section>

          {/* ── Supplemental Income ── */}
          <Section title="Supplemental Income" accent="#4aab92" {...sec("supplemental")}>
            <Field label="Monthly Rental Income"><Num prefix="$" step={100} value={ip.monthly_rental_income ?? 0} onChange={v => updateNestedConfig("income_profile", { monthly_rental_income: v })} /></Field>
            <Field label="Monthly Part-Time Work Income"><Num prefix="$" step={100} value={ip.monthly_parttime_income ?? 0} onChange={v => updateNestedConfig("income_profile", { monthly_parttime_income: v })} /></Field>
            <Toggle label="Include Partner Income" on={ip.use_partner_income || false} onChange={v => updateNestedConfig("income_profile", { use_partner_income: v })} />
            {ip.use_partner_income && (
              <>
                <Field label="Partner Gross Salary"><Num prefix="$" step={1000} value={ip.partner_gross_annual_salary || 0} onChange={v => updateNestedConfig("income_profile", { partner_gross_annual_salary: v })} /></Field>
                <Two>
                  <Field label="Start Year"><Num value={ip.partner_employment_start_year || 2025} onChange={v => updateNestedConfig("income_profile", { partner_employment_start_year: v })} /></Field>
                  <Field label="Retire Year"><Num value={ip.partner_retirement_year || 2030} onChange={v => updateNestedConfig("income_profile", { partner_retirement_year: v })} /></Field>
                </Two>
                <Toggle label="Partner Supplies Insurance" on={ip.partner_has_health_insurance || false} onChange={v => updateNestedConfig("income_profile", { partner_has_health_insurance: v })} />
              </>
            )}
          </Section>

          {/* ── Spending & Lifestyle ── */}
          <Section title="Spending & Lifestyle" accent={C.warm} {...sec("spending")}>
            <Field label="Monthly Spend"><Num prefix="$" step={250} value={sp.monthly_lifestyle} onChange={v => updateNestedConfig("spending", { monthly_lifestyle: v })} /></Field>
            <Field label="Monthly Mortgage Payment"><Num prefix="$" step={100} value={sp.mortgage_payment} onChange={v => updateNestedConfig("spending", { mortgage_payment: v })} /></Field>
            <Field label="Healthcare Premium ($/mo, pre-65)"><Num prefix="$" step={100} value={sp.healthcare_premium} onChange={v => updateNestedConfig("spending", { healthcare_premium: v })} /></Field>
            <Two>
              <Field label="Empty-Nest Year"><Num value={sp.empty_nest_year || 2038} onChange={v => updateNestedConfig("spending", { empty_nest_year: v })} /></Field>
              <Field label="Empty-Nest Spend"><Num prefix="$" step={250} value={sp.empty_nest_monthly_spend ?? 0} onChange={v => updateNestedConfig("spending", { empty_nest_monthly_spend: v })} /></Field>
            </Two>
          </Section>

          {/* ── Market Assumptions ── */}
          <Section title="Market Assumptions" accent="#7a6da8" {...sec("market")}>
            <Two>
              <Field label="Market Return (%)"><Num step={0.1} value={ma.market_return_rate} onChange={v => updateNestedConfig("market_assumptions", { market_return_rate: v })} /></Field>
              <Field label="Volatility Drag (%)"><Num step={0.1} value={ma.volatility_drag} onChange={v => updateNestedConfig("market_assumptions", { volatility_drag: v })} /></Field>
            </Two>
            <Two>
              <Field label="Employer Stock Ticker"><TextInput placeholder="e.g. AAPL" value={config.concentrated_symbol ?? ""} onChange={v => updateConfig({ concentrated_symbol: v.toUpperCase() })} /></Field>
              <Field label="Employer Stock Growth (%)"><Num step={0.5} value={ma.goog_growth_rate} onChange={v => updateNestedConfig("market_assumptions", { goog_growth_rate: v })} /></Field>
            </Two>
            <Field label="Inflation (%)"><Num step={0.25} value={ma.inflation_rate} onChange={v => updateNestedConfig("market_assumptions", { inflation_rate: v })} /></Field>
          </Section>

          {/* ── Divestment ── */}
          <Section title="Employer Stock Divestment" accent="#2a7a68" {...sec("divest")}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(["none", "progressive", "immediate"] as const).map(t => (
                <button key={t} onClick={() => updateNestedConfig("divestment_strategy", { type: t })} style={{
                  flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${config.divestment_strategy.type === t ? C.teal : C.border}`,
                  background: config.divestment_strategy.type === t ? C.tealWash : C.bgCard,
                  color: config.divestment_strategy.type === t ? C.tealDark : C.inkMid, textTransform: "capitalize",
                }}>{t}</button>
              ))}
            </div>
            {config.divestment_strategy.type === "progressive" && (
              <Two>
                <Field label="Start Year"><Num value={config.divestment_strategy.start_year} onChange={v => updateNestedConfig("divestment_strategy", { start_year: v })} /></Field>
                <Field label="End Year"><Num value={config.divestment_strategy.end_year} onChange={v => updateNestedConfig("divestment_strategy", { end_year: v })} /></Field>
              </Two>
            )}
          </Section>

          {/* ── Taxes ── */}
          <Section title="Taxes" accent={C.inkMid} {...sec("tax")}>
            <Field label="Filing Status">
              <Pick value={config.tax_assumptions.filing_status} onChange={v => updateNestedConfig("tax_assumptions", { filing_status: v as any })}
                options={[["single", "Single"], ["married_joint", "Married Filing Jointly"], ["married_separate", "Married Filing Separately"], ["head_household", "Head of Household"]]} />
            </Field>
            <Field label="State of Residence">
              <Pick value={config.tax_assumptions.state_of_residence} onChange={v => updateNestedConfig("tax_assumptions", { state_of_residence: v as any })}
                options={[["CA", "California"], ["WA", "Washington"], ["TX", "Texas"], ["NY", "New York"], ["NONE", "No State Tax"]]} />
            </Field>
          </Section>

          {/* ── Social Security & Medicare ── */}
          <Section title="Social Security & Medicare" accent={C.inkSoft} {...sec("ssmed")}>
            <Two>
              <Field label="SS Start Age"><Num value={config.social_security?.start_age ?? 67} onChange={v => updateNestedConfig("social_security", { start_age: v } as any)} /></Field>
              <Field label="SS Monthly"><Num prefix="$" step={100} value={config.social_security?.monthly_amount ?? 3500} onChange={v => updateNestedConfig("social_security", { monthly_amount: v } as any)} /></Field>
            </Two>
            <Two>
              <Field label="Medicare Age"><Num value={config.medicare?.start_age ?? 65} onChange={v => updateNestedConfig("medicare", { start_age: v } as any)} /></Field>
              <Field label="Medicare $/mo (per person)"><Num prefix="$" step={25} value={config.medicare?.monthly_premium ?? 250} onChange={v => updateNestedConfig("medicare", { monthly_premium: v } as any)} /></Field>
            </Two>
          </Section>

          {/* ── Life Events ── */}
          <Section title="Life Events" accent="#c4784e" {...sec("events")}>
            {(config.life_events || []).map((evt, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: C.bgCard, border: `1px solid ${C.borderSoft}`, marginBottom: 8 }}>
                <div><div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{evt.name}</div><div style={{ fontSize: 11, color: C.inkSoft }}>{evt.year} · {money(evt.cost)}</div></div>
                <button onClick={() => { const e = [...(config.life_events || [])]; e.splice(idx, 1); updateNestedConfig("life_events", e as any); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint }}><Trash2 size={16} /></button>
              </div>
            ))}
            <div style={{ marginTop: 4 }}>
              <TextInput placeholder="Event name" value={newEvent.name} onChange={v => setNewEvent({ ...newEvent, name: v })} />
              <div style={{ height: 10 }} />
              <Two>
                <Num value={newEvent.year} onChange={v => setNewEvent({ ...newEvent, year: v })} />
                <Num prefix="$" step={1000} value={newEvent.cost} onChange={v => setNewEvent({ ...newEvent, cost: v })} />
              </Two>
              <button onClick={() => { if (newEvent.name) { updateNestedConfig("life_events", [...(config.life_events || []), newEvent] as any); setNewEvent({ name: "", year: 2030, cost: 50_000 }); } }}
                style={{ marginTop: 10, width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgCard, color: C.teal, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Plus size={15} /> Add Event
              </button>
            </div>
          </Section>

          {/* ── Portfolio Holdings ── */}
          <Section title="Portfolio Holdings" accent="#c4784e" {...sec("holdings")}>
            {(snapshot.other_investments || []).map((inv, idx) => (
              <div key={inv.id || idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: C.bgCard, border: `1px solid ${C.borderSoft}`, marginBottom: 8 }}>
                <div><div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{inv.symbol}</div><div style={{ fontSize: 11, color: C.inkSoft }}>{inv.shares.toLocaleString(undefined, { maximumFractionDigits: 3 })} sh</div></div>
                <button onClick={() => { const a = [...(snapshot.other_investments || [])]; a.splice(idx, 1); updateNestedSnapshot("other_investments", a as any); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint }}><Trash2 size={16} /></button>
              </div>
            ))}
            <div style={{ marginTop: 4 }}>
              <TickerAutocomplete placeholder="Search ticker or company" value={newInv.symbol} inputStyle={inputStyle}
                onChange={v => setNewInv(prev => ({ ...prev, symbol: v }))}
                onSelect={r => setNewInv(prev => ({ ...prev, symbol: r.symbol, name: r.name }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <input type="number" inputMode="decimal" placeholder="Shares" value={newInv.shares} onChange={e => setNewInv({ ...newInv, shares: e.target.value })} style={inputStyle} />
              <input type="number" inputMode="decimal" placeholder="Ret%" value={newInv.ret} onChange={e => setNewInv({ ...newInv, ret: e.target.value })} style={inputStyle} />
            </div>
            <button onClick={() => {
              const sh = parseFloat(newInv.shares);
              if (newInv.symbol && sh) {
                const inv = { id: Date.now().toString(), name: newInv.name || newInv.symbol, symbol: newInv.symbol, shares: sh, cost_basis: 0, current_price: 0, expected_return: newInv.ret ? parseFloat(newInv.ret) : undefined };
                updateNestedSnapshot("other_investments", [...(snapshot.other_investments || []), inv] as any);
                setNewInv({ symbol: "", name: "", shares: "", ret: "" });
              }
            }} style={{ marginTop: 10, width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${C.warmLight}`, background: C.warmWash, color: C.warm, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={15} /> Add Holding
            </button>
          </Section>

          {/* ── Education (529) ── */}
          <Section title="Education (529)" accent={C.teal} {...sec("edu")}>
            {(snapshot.education_assets?.accounts || []).map((acc, idx) => (
              <div key={acc.id || idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input value={acc.name} onChange={e => { const a = [...(snapshot.education_assets.accounts || [])]; a[idx] = { ...acc, name: e.target.value }; updateNestedSnapshot("education_assets", { accounts: a }); }} style={{ ...inputStyle, flex: 1 }} />
                <input type="number" inputMode="decimal" value={acc.balance} onChange={e => { const a = [...(snapshot.education_assets.accounts || [])]; a[idx] = { ...acc, balance: +e.target.value }; updateNestedSnapshot("education_assets", { accounts: a }); }} style={{ ...inputStyle, width: 120, textAlign: "right" }} />
                <button onClick={() => { const a = (snapshot.education_assets.accounts || []).filter((_, i) => i !== idx); updateNestedSnapshot("education_assets", { accounts: a }); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint }}><Trash2 size={16} /></button>
              </div>
            ))}
            <button onClick={() => { const a = [...(snapshot.education_assets.accounts || []), { id: crypto.randomUUID(), name: "New 529", balance: 0 }]; updateNestedSnapshot("education_assets", { accounts: a }); }}
              style={{ marginTop: 4, width: "100%", padding: "12px", borderRadius: 10, border: `1px dashed ${C.border}`, background: C.bgCard, color: C.inkSoft, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={15} /> Add 529 Account
            </button>
          </Section>

          <button onClick={onClose} style={{ marginTop: 8, width: "100%", padding: "16px", borderRadius: 16, border: "none", background: C.teal, color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: `0 4px 16px ${C.teal}55` }}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}

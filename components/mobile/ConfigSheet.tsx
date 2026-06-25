"use client";
import { useEffect, useRef, useState } from "react";
import { X, Trash2, Plus, Wallet, ChevronRight } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import TickerAutocomplete from "@/components/finance/TickerAutocomplete";
import LinkedNumberField from "@/components/finance/LinkedNumberField";
import BaselineLinkBadge from "@/components/finance/BaselineLinkBadge";
import { money, inputStyle, Field, Num, TextInput, Toggle, Two, Section } from "./sheetUI";

export default function ConfigSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, profile, updateNestedConfig, updateConfig } = useFinancialStore();
  const setFinancesOpen = useUIStore((s) => s.setFinancesOpen);
  const kids = profile.children;
  const thisYear = new Date().getFullYear();
  const age = thisYear - (config.birth_year || profile.birthYear || 1985);
  const [openId, setOpenId] = useState<string | null>("career");
  const [newEvent, setNewEvent] = useState({ name: "", year: 2030, cost: 50_000 });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // The sheet stays mounted (slides off-screen), so reset its scroll to the top
  // each time it's opened rather than reopening wherever it was last left.
  useEffect(() => {
    if (open) requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
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
        // dvh (not vh) so the sheet's top isn't hidden behind the browser chrome.
        height: "92dvh", maxHeight: "92dvh", display: "flex", flexDirection: "column",
      }}>
        {/* Grabber + header */}
        <div style={{ flexShrink: 0, padding: "8px 20px 12px" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 10px" }}>
            <div style={{ width: 40, height: 5, borderRadius: 999, background: C.border }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 300, color: C.ink }}>Scenario plan</h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.inkFaint }}>Just this scenario</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} color={C.inkSoft} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px calc(28px + env(safe-area-inset-bottom))", WebkitOverflowScrolling: "touch" }}>

          {/* Shortcut to the shared balance sheet — assets/holdings/529s live in
              "Your finances" (shared across scenarios), not in this per-scenario plan. */}
          <button onClick={() => { onClose(); setFinancesOpen(true); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", marginBottom: 10, borderRadius: 16, border: `1px solid ${C.border}`, background: C.bgCard, cursor: "pointer", textAlign: "left" }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: C.tealWash, flexShrink: 0 }}>
              <Wallet size={17} color={C.teal} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.ink }}>Your finances</span>
              <span style={{ display: "block", fontSize: 11, color: C.inkFaint }}>Assets, holdings &amp; 529s · shared across scenarios</span>
            </span>
            <ChevronRight size={18} color={C.inkSoft} style={{ flexShrink: 0 }} />
          </button>

          {/* ── Career & Phases ── */}
          <Section title="Career & Phases" accent="#2a9d7f" {...sec("career")}>
            <Field label={`Career Exit Year — ${cp.exit_year}`}>
              <input type="range" min={2024} max={Math.max(2040, (config.birth_year || (thisYear - age)) + 75, cp.exit_year)} step={1} value={cp.exit_year}
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
            <BaselineLinkBadge section="income_profile" variant="mobile" />
            <Field label="Gross Annual Salary">
              <Num prefix="$" step={1000} value={ip.gross_annual_salary || 0}
                onChange={v => updateNestedConfig("income_profile", { gross_annual_salary: v, google_net_monthly: Math.round(v * 0.65 / 12) })} />
            </Field>
            <Two>
              <Field label="Annual Raise (%)"><Num step={0.1} value={ip.income_growth_rate ?? 0} onChange={v => updateNestedConfig("income_profile", { income_growth_rate: v })} /></Field>
              <Field label="Target Bonus (%)"><Num value={ip.target_bonus_rate ?? 0} onChange={v => updateNestedConfig("income_profile", { target_bonus_rate: v })} /></Field>
            </Two>
            <Toggle label="Company Equity / RSUs" on={config.use_equity_comp === true} onChange={v => updateConfig({ use_equity_comp: v })} />
            {config.use_equity_comp === true && (
              <>
                <Field label="Company Ticker"><TickerAutocomplete placeholder="e.g. AAPL" inputStyle={inputStyle} value={config.concentrated_symbol ?? ""} onChange={v => updateConfig({ concentrated_symbol: v })} onSelect={r => updateConfig({ concentrated_symbol: r.symbol })} /></Field>
                <Two>
                  <Field label="Expected Return (%)"><Num step={0.5} value={ma.goog_growth_rate} onChange={v => updateNestedConfig("market_assumptions", { goog_growth_rate: v })} /></Field>
                  <Field label="Annual Equity Refresher"><Num prefix="$" step={1000} value={ip.annual_equity_grant ?? 0} onChange={v => updateNestedConfig("income_profile", { annual_equity_grant: v })} /></Field>
                </Two>
                <Two>
                  <Field label="Unvested Shares"><Num value={ip.initial_unvested_shares ?? 0} onChange={v => updateNestedConfig("income_profile", { initial_unvested_shares: v })} /></Field>
                  <Field label="Vesting (yrs)"><Num value={ip.vesting_years ?? 4} onChange={v => updateNestedConfig("income_profile", { vesting_years: v })} /></Field>
                </Two>
              </>
            )}
            <Two>
              <Field label="401(k) Contribution / yr"><Num prefix="$" step={500} value={ip.annual_401k_contribution ?? 0} onChange={v => updateNestedConfig("income_profile", { annual_401k_contribution: v })} /></Field>
              <Field label="Backdoor Roth / yr"><Num prefix="$" step={500} value={ip.annual_backdoor_roth ?? 0} onChange={v => updateNestedConfig("income_profile", { annual_backdoor_roth: v })} /></Field>
            </Two>
          </Section>

          {/* ── Additional Income ── */}
          <Section title="Additional Income" accent="#4aab92" {...sec("supplemental")}>
            <Field label="Monthly Rental Income"><Num prefix="$" step={100} value={ip.monthly_rental_income ?? 0} onChange={v => updateNestedConfig("income_profile", { monthly_rental_income: v })} /></Field>
            <Field label="Rental Growth Rate"><Num suffix="%" step={0.25} value={ip.rental_income_growth_rate ?? 3} onChange={v => updateNestedConfig("income_profile", { rental_income_growth_rate: v })} /></Field>
            <Field label="Monthly Part-Time Work Income"><Num prefix="$" step={100} value={ip.monthly_parttime_income ?? 0} onChange={v => updateNestedConfig("income_profile", { monthly_parttime_income: v })} /></Field>
            {ip.use_partner_income ? (
              <>
                <Field label="Partner Gross Salary"><Num prefix="$" step={1000} value={ip.partner_gross_annual_salary || 0} onChange={v => updateNestedConfig("income_profile", { partner_gross_annual_salary: v })} /></Field>
                <Two>
                  <Field label="Start Year"><Num value={ip.partner_employment_start_year || 2025} onChange={v => updateNestedConfig("income_profile", { partner_employment_start_year: v })} /></Field>
                  <Field label="Retire Year"><Num value={ip.partner_retirement_year || 2030} onChange={v => updateNestedConfig("income_profile", { partner_retirement_year: v })} /></Field>
                </Two>
                <Toggle label="Partner Supplies Insurance" on={ip.partner_has_health_insurance || false} onChange={v => updateNestedConfig("income_profile", { partner_has_health_insurance: v })} />
              </>
            ) : (
              <div style={{ fontSize: 11, color: C.inkFaint }}>Add a partner in Settings → Family to model their income.</div>
            )}
          </Section>

          {/* ── Spending & Lifestyle ── */}
          <Section title="Spending & Lifestyle" accent={C.warm} {...sec("spending")}>
            <BaselineLinkBadge section="spending" variant="mobile" />
            <Field label="Monthly Spend (excl. rent/mortgage & healthcare)"><Num prefix="$" step={250} value={sp.monthly_lifestyle} onChange={v => updateNestedConfig("spending", { monthly_lifestyle: v })} /></Field>
            <Field label="Monthly Mortgage / Rent Payment"><Num prefix="$" step={100} value={sp.mortgage_payment} onChange={v => updateNestedConfig("spending", { mortgage_payment: v })} /></Field>
            <Field label="Healthcare Premium ($/mo, pre-65)"><Num prefix="$" step={100} value={sp.healthcare_premium} onChange={v => updateNestedConfig("spending", { healthcare_premium: v })} /></Field>
            <Field label="Long-Term Care ($/yr, today's $; 0 = off)"><Num prefix="$" step={5000} value={sp.ltc_annual_cost ?? 0} onChange={v => updateNestedConfig("spending", { ltc_annual_cost: v })} /></Field>
            {(sp.ltc_annual_cost ?? 0) > 0 && (
              <Two>
                <Field label="LTC Start Age"><Num step={1} value={sp.ltc_start_age ?? 80} onChange={v => updateNestedConfig("spending", { ltc_start_age: v })} /></Field>
                <Field label="LTC Years"><Num step={1} value={sp.ltc_years ?? 3} onChange={v => updateNestedConfig("spending", { ltc_years: v })} /></Field>
              </Two>
            )}
            {config.tax_assumptions.filing_status === "married_joint" && (
              <Two>
                <Field label="Survivor: First-Death Age (0=off)"><Num step={1} value={config.mortality?.first_death_age ?? 0} onChange={v => updateNestedConfig("mortality", { first_death_age: v })} /></Field>
                <Field label="Survivor Spend %"><Num suffix="%" step={5} value={Math.round((config.mortality?.survivor_spending_factor ?? 0.75) * 100)} onChange={v => updateNestedConfig("mortality", { survivor_spending_factor: v / 100 })} /></Field>
              </Two>
            )}
            {kids.length > 0 && (
              <>
                <Toggle label="Model an Empty-Nest Phase" on={sp.use_empty_nest !== false} onChange={v => updateNestedConfig("spending", { use_empty_nest: v })} />
                {sp.use_empty_nest !== false && (
                  <Two>
                    <Field label="Empty-Nest Year"><Num value={sp.empty_nest_year || 2038} onChange={v => updateNestedConfig("spending", { empty_nest_year: v })} /></Field>
                    <Field label="Empty-Nest Spend">
                      <LinkedNumberField variant="mobile" step={250}
                        linked={sp.empty_nest_linked !== false}
                        displayValue={sp.empty_nest_linked !== false ? Math.round(sp.monthly_lifestyle * 0.85) : (sp.empty_nest_monthly_spend ?? 0)}
                        onOverride={() => updateNestedConfig("spending", { empty_nest_linked: false, empty_nest_monthly_spend: Math.round(sp.monthly_lifestyle * 0.85) })}
                        onChange={v => updateNestedConfig("spending", { empty_nest_monthly_spend: v, empty_nest_linked: false })}
                        onRelink={() => updateNestedConfig("spending", { empty_nest_linked: true })} />
                    </Field>
                  </Two>
                )}
              </>
            )}
          </Section>

          {/* ── Market Assumptions ── */}
          <Section title="Market Assumptions" accent="#7a6da8" {...sec("market")}>
            <BaselineLinkBadge section="market_assumptions" variant="mobile" />
            <Two>
              <Field label="Market Return (%)"><Num step={0.1} value={ma.market_return_rate} onChange={v => updateNestedConfig("market_assumptions", { market_return_rate: v })} /></Field>
              <Field label="Volatility Drag (%)"><Num step={0.1} value={ma.volatility_drag} onChange={v => updateNestedConfig("market_assumptions", { volatility_drag: v })} /></Field>
            </Two>
            <Field label="Inflation (%)"><Num step={0.25} value={ma.inflation_rate} onChange={v => updateNestedConfig("market_assumptions", { inflation_rate: v })} /></Field>
            <Field label="Healthcare Inflation over CPI (%)"><Num step={0.25} value={ma.healthcare_inflation_premium ?? 2} onChange={v => updateNestedConfig("market_assumptions", { healthcare_inflation_premium: v })} /></Field>
          </Section>

          {/* ── Divestment (only relevant with company stock) ── */}
          {config.use_equity_comp === true && (
          <Section title="Company Stock Divestment" accent="#2a7a68" {...sec("divest")}>
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
          )}

          {/* Taxes, Social Security & Medicare now live in Settings (profile menu). */}

          {/* ── Life Events ── */}
          <Section title="Life Events" accent="#c4784e" {...sec("events")}>
            <BaselineLinkBadge section="life_events" variant="mobile" />
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

          {/* Family (kids & partner) now lives in Settings (profile menu). */}

          <button onClick={onClose} style={{ marginTop: 8, width: "100%", padding: "16px", borderRadius: 16, border: "none", background: C.teal, color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: `0 4px 16px ${C.teal}55` }}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}

"use client";
import { useState } from "react";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { IRS_401K } from "@/engine/calculator";
import TickerAutocomplete from "@/components/finance/TickerAutocomplete";
import LinkedNumberField from "@/components/finance/LinkedNumberField";
import PlanHistory from "@/components/finance/PlanHistory";
import { Field, Num, Two, Section, Toggle, TextInput, money, inputStyle, labelStyle } from "./sheetUI";

type Holding = { id?: string; name: string; symbol: string; shares: number; expected_return?: number; [k: string]: unknown };

/** A single saved holding — tap the pencil to edit shares / expected return
 * inline (mobile previously only allowed delete + re-add). */
function HoldingRow({ inv, onUpdate, onRemove }: { inv: Holding; onUpdate: (v: Holding) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [shares, setShares] = useState(String(inv.shares));
  const [ret, setRet] = useState(inv.expected_return != null ? String(inv.expected_return) : "");

  if (editing) {
    return (
      <div style={{ padding: "12px", borderRadius: 10, background: C.warmWash, border: `1px solid ${C.warmLight}`, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{inv.symbol}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><span style={labelStyle}>Shares</span>
            <input type="number" inputMode="decimal" value={shares} onChange={e => setShares(e.target.value)} style={inputStyle} /></div>
          <div><span style={labelStyle}>Expected Return %</span>
            <input type="number" inputMode="decimal" placeholder="7" value={ret} onChange={e => setRet(e.target.value)} style={inputStyle} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={() => {
            const sh = parseFloat(shares);
            if (!sh) return;
            onUpdate({ ...inv, shares: sh, expected_return: ret ? parseFloat(ret) : undefined });
            setEditing(false);
          }} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: C.teal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Check size={15} /> Save
          </button>
          <button onClick={() => { setShares(String(inv.shares)); setRet(inv.expected_return != null ? String(inv.expected_return) : ""); setEditing(false); }}
            style={{ flex: 1, padding: "10px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.bgCard, color: C.inkMid, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <X size={15} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: C.bgCard, border: `1px solid ${C.borderSoft}`, marginBottom: 8 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{inv.symbol}</div>
        <div style={{ fontSize: 11, color: C.inkSoft }}>
          {inv.shares.toLocaleString(undefined, { maximumFractionDigits: 3 })} sh{inv.expected_return != null ? ` · ${inv.expected_return}% return` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => setEditing(true)} aria-label={`Edit ${inv.symbol}`} style={{ background: "none", border: "none", cursor: "pointer", color: C.teal, padding: 6 }}><Pencil size={16} /></button>
        <button onClick={onRemove} aria-label={`Remove ${inv.symbol}`} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 6 }}><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

// The shared "Your finances" picture — cash flow (income & spending) plus the
// balance sheet (assets/liabilities, holdings, 529s). Income & spending edit the
// shared **baseline** (they flow to every scenario unless overridden); the
// balance sheet edits the global snapshot (identical across scenarios). Touch-
// friendly twin of LeftPanel's `variant="finances"`.
export default function MobileFinancesSections() {
  const { snapshot, config, profile, baseline, updateNestedSnapshot, updateBaseline, setEquityComp } = useFinancialStore();
  const kids = profile.children;
  const ip = baseline.income_profile;
  const sp = baseline.spending;
  const ma = baseline.market_assumptions;
  const events = baseline.life_events ?? [];
  const setEvents = (next: typeof events) => updateBaseline("life_events", next);
  const thisYear = new Date().getFullYear();
  const [openId, setOpenId] = useState<string | null>("income");
  const [newInv, setNewInv] = useState({ symbol: "", name: "", shares: "", ret: "7", retLinked: true });
  const [newEvent, setNewEvent] = useState({ name: "", year: thisYear + 3, cost: 50_000 });
  const sec = (id: string) => ({ openId, setOpenId, id });

  return (
    <>
      {/* Plan history — monthly net-worth + FI-date trail. */}
      <PlanHistory />

      {/* ── Income (baseline cash flow) ── */}
      <Section title="Income" accent="#4aab92" {...sec("income")}>
        <Field label="Gross Annual Salary"><Num prefix="$" step={1000} value={ip.gross_annual_salary} onChange={v => updateBaseline("income_profile", { gross_annual_salary: v })} /></Field>
        <Two>
          <Field label="Annual Raise (%)"><Num step={0.1} value={ip.income_growth_rate ?? 0} onChange={v => updateBaseline("income_profile", { income_growth_rate: v })} /></Field>
          <Field label="Target Bonus (%)"><Num value={ip.target_bonus_rate ?? 0} onChange={v => updateBaseline("income_profile", { target_bonus_rate: v })} /></Field>
        </Two>
        <Field label="Monthly Rental Income"><Num prefix="$" step={100} value={ip.monthly_rental_income ?? 0} onChange={v => updateBaseline("income_profile", { monthly_rental_income: v })} /></Field>

        {/* Pre-tax savings — your own contributions, not income (equity is in its own section). */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint, marginTop: 2 }}>Pre-tax retirement savings</div>
        <Two>
          <Field label="Your 401(k) / yr"><Num prefix="$" step={500} value={ip.annual_401k_contribution ?? 0} onChange={v => updateBaseline("income_profile", { annual_401k_contribution: v })} /></Field>
          <Field label="Your Backdoor Roth / yr"><Num prefix="$" step={500} value={ip.annual_backdoor_roth ?? 0} onChange={v => updateBaseline("income_profile", { annual_backdoor_roth: v })} /></Field>
        </Two>
        <Two>
          <Field label="Employer Match Rate (%)"><Num suffix="%" step={5} value={ip.employer_match_rate_pct ?? 0} onChange={v => updateBaseline("income_profile", { employer_match_rate_pct: v })} /></Field>
          <Field label="…of first % of salary (0 = all)"><Num suffix="%" step={1} value={ip.employer_match_limit_pct ?? 0} onChange={v => updateBaseline("income_profile", { employer_match_limit_pct: v })} /></Field>
        </Two>
        <div style={{ fontSize: 11, color: C.inkFaint, lineHeight: 1.5 }}>
          {(ip.employer_match_rate_pct ?? 0) > 0
            ? `Your employer adds ${ip.employer_match_rate_pct}% of ${(ip.employer_match_limit_pct ?? 0) > 0 ? `the first ${ip.employer_match_limit_pct}% of salary you contribute` : "all your contributions"} (e.g. Google is 50% of all). `
            : "Set a rate to model an employer match. "}
          These are contributions you (and your employer) save — not income. IRS {IRS_401K.year} deferral cap ${IRS_401K.employeeLimit.toLocaleString()}/yr (+${IRS_401K.catchup.toLocaleString()} at {IRS_401K.catchupAge}+); the match adds on top to a ${IRS_401K.totalAdditions.toLocaleString()} combined limit.
        </div>
        <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 2, lineHeight: 1.5 }}>Your baseline cash flow — flows to every scenario unless a scenario overrides it.</div>
      </Section>

      {/* ── Company Equity / RSUs (shared fact) ── */}
      <Section title="Company Equity / RSUs" accent="#2a7a68" {...sec("equity")}>
        <Toggle label="I receive company equity (RSUs)" on={config.use_equity_comp === true} onChange={v => setEquityComp({ use_equity_comp: v })} />
        {config.use_equity_comp === true && (
          <>
            <Field label="Company Ticker"><TickerAutocomplete placeholder="e.g. AAPL" inputStyle={inputStyle} value={config.concentrated_symbol ?? ""} onChange={v => setEquityComp({ concentrated_symbol: v })} onSelect={r => setEquityComp({ concentrated_symbol: r.symbol })} /></Field>
            <Two>
              <Field label="Expected Return (%)"><Num step={0.5} value={ma.goog_growth_rate} onChange={v => updateBaseline("market_assumptions", { goog_growth_rate: v })} /></Field>
              <Field label="Annual Equity Refresher"><Num prefix="$" step={1000} value={ip.annual_equity_grant ?? 0} onChange={v => updateBaseline("income_profile", { annual_equity_grant: v })} /></Field>
            </Two>
            <Two>
              <Field label="Unvested Shares"><Num value={ip.initial_unvested_shares ?? 0} onChange={v => updateBaseline("income_profile", { initial_unvested_shares: v })} /></Field>
              <Field label="Vesting (yrs)"><Num value={ip.vesting_years ?? 4} onChange={v => updateBaseline("income_profile", { vesting_years: v })} /></Field>
            </Two>
            <div style={{ fontSize: 11, color: C.inkFaint, lineHeight: 1.5 }}>Shared across every scenario. How you sell this position down is a per-scenario lever, in each scenario’s plan.</div>
          </>
        )}
      </Section>

      {/* ── Spending (baseline cash flow) ── */}
      <Section title="Spending" accent={C.warm} {...sec("spending")}>
        <Field label="Monthly Lifestyle (excl. housing & healthcare)"><Num prefix="$" step={250} value={sp.monthly_lifestyle} onChange={v => updateBaseline("spending", { monthly_lifestyle: v })} /></Field>
        <div>
          <span style={labelStyle}>Housing</span>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {(["mortgage", "rent"] as const).map(t => {
              const on = (sp.housing_type ?? "mortgage") === t;
              return (
                <button key={t} onClick={() => updateBaseline("spending", { housing_type: t })}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", textTransform: "capitalize",
                    border: `1px solid ${on ? C.teal : C.border}`, background: on ? C.tealWash : C.bgCard,
                    color: on ? C.tealDark : C.inkMid, fontSize: 13, fontWeight: 700 }}>{t}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: C.inkFaint, lineHeight: 1.5, marginTop: 6 }}>
            {(sp.housing_type ?? "mortgage") === "rent"
              ? "Rent is permanent — included in your FI number (×25) and never ends."
              : "A mortgage ends at payoff; your remaining balance is added to your FI number."}
          </div>
        </div>
        <Two>
          <Field label={(sp.housing_type ?? "mortgage") === "rent" ? "Rent ($/mo)" : "Mortgage ($/mo)"}><Num prefix="$" step={100} value={sp.mortgage_payment} onChange={v => updateBaseline("spending", { mortgage_payment: v })} /></Field>
          <Field label="Healthcare ($/mo, pre-65)"><Num prefix="$" step={100} value={sp.healthcare_premium} onChange={v => updateBaseline("spending", { healthcare_premium: v })} /></Field>
        </Two>
        <Field label="Long-Term Care ($/yr, today's $; 0 = off)"><Num prefix="$" step={5000} value={sp.ltc_annual_cost ?? 0} onChange={v => updateBaseline("spending", { ltc_annual_cost: v })} /></Field>
      </Section>

      {/* ── Life events (baseline) ── */}
      <Section title="Life events" accent="#c4784e" {...sec("events")}>
        <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 10, lineHeight: 1.5 }}>
          One-off future costs (a home purchase, a big trip) — shared across every scenario. College costs auto-update from Profile → Family.
        </div>
        {events.map((evt, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: C.bgCard, border: `1px solid ${C.borderSoft}`, marginBottom: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evt.name}</span>
                {evt.auto && <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.inkFaint, background: C.bgHeader, borderRadius: 4, padding: "1px 5px" }}>auto</span>}
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft }}>{evt.year} · {money(evt.cost)}</div>
            </div>
            {!evt.auto && (
              <button onClick={() => setEvents(events.filter((_, i) => i !== idx))} aria-label="Remove event"
                style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, flexShrink: 0 }}><Trash2 size={16} /></button>
            )}
          </div>
        ))}
        <div style={{ marginTop: 4 }}>
          <TextInput placeholder="Event name" value={newEvent.name} onChange={v => setNewEvent({ ...newEvent, name: v })} />
          <div style={{ height: 8 }} />
          <Two>
            <Num value={newEvent.year} onChange={v => setNewEvent({ ...newEvent, year: v })} />
            <Num prefix="$" step={1000} value={newEvent.cost} onChange={v => setNewEvent({ ...newEvent, cost: v })} />
          </Two>
          <button onClick={() => { if (newEvent.name.trim()) { setEvents([...events, { name: newEvent.name.trim(), year: newEvent.year, cost: newEvent.cost, auto: false }]); setNewEvent({ name: "", year: thisYear + 3, cost: 50_000 }); } }}
            style={{ marginTop: 10, width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgCard, color: C.teal, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={15} /> Add event
          </button>
        </div>
      </Section>

      {/* ── Assets & Liabilities ── */}
      <Section title="Assets & Liabilities" accent={C.teal} {...sec("assets")}>
        <Field label="Cash Savings"><Num prefix="$" step={1000} value={snapshot.liquid_assets.cash_savings} onChange={v => updateNestedSnapshot("liquid_assets", { cash_savings: v })} /></Field>
        <Two>
          <Field label="401(k)"><Num prefix="$" step={1000} value={snapshot.retirement_assets.k401} onChange={v => updateNestedSnapshot("retirement_assets", { k401: v })} /></Field>
          <Field label="Roth IRA"><Num prefix="$" step={1000} value={snapshot.retirement_assets.roth_ira} onChange={v => updateNestedSnapshot("retirement_assets", { roth_ira: v })} /></Field>
        </Two>
        <Field label="Traditional IRA"><Num prefix="$" step={1000} value={snapshot.retirement_assets.traditional_ira} onChange={v => updateNestedSnapshot("retirement_assets", { traditional_ira: v })} /></Field>
        {(sp.housing_type ?? "mortgage") !== "rent" ? (
          <>
            <Two>
              <Field label="Mortgage Balance"><Num prefix="$" step={1000} value={snapshot.liabilities.mortgage_balance} onChange={v => updateNestedSnapshot("liabilities", { mortgage_balance: v })} /></Field>
              <Field label="Home / Building Value"><Num prefix="$" step={5000} value={snapshot.liabilities.property_value ?? 0} onChange={v => updateNestedSnapshot("liabilities", { property_value: v })} /></Field>
            </Two>
            {(snapshot.liabilities.property_value ?? 0) > 0 && (
              <p className="-mt-1 text-xs text-neutral-500">Equity today: ${Math.max(0, (snapshot.liabilities.property_value ?? 0) - snapshot.liabilities.mortgage_balance).toLocaleString()} — counted in net worth, not in spendable FI assets.</p>
            )}
            {(snapshot.liabilities.property_value ?? 0) > 0 && (
              <>
                <Toggle label="Plan to sell / downsize this home" on={(sp.sell_home_year ?? 0) > 0}
                  onChange={v => updateBaseline("spending", { sell_home_year: v ? (config.career_path.exit_year || new Date().getFullYear() + 1) : 0 })} />
                {(sp.sell_home_year ?? 0) > 0 && (
                  <>
                    <Two>
                      <Field label="Sell in Year"><Num step={1} value={sp.sell_home_year ?? 0} onChange={v => updateBaseline("spending", { sell_home_year: v })} /></Field>
                      <Field label="Rent After ($/mo)"><Num prefix="$" step={100} value={sp.rent_after_sale ?? 0} onChange={v => updateBaseline("spending", { rent_after_sale: v })} /></Field>
                    </Two>
                    <Field label="Home Cost Basis (capital gains)"><Num prefix="$" step={5000} value={snapshot.liabilities.property_cost_basis ?? 0} onChange={v => updateNestedSnapshot("liabilities", { property_cost_basis: v })} /></Field>
                    <p className="-mt-1 text-xs text-neutral-500">Net proceeds (value − mortgage − ~6% costs − gains tax over the $500k/$250k exclusion) become spendable; rental income stops and you rent from then on.</p>
                  </>
                )}
              </>
            )}
            <Field label="Consumer Debt"><Num prefix="$" step={500} value={snapshot.liabilities.consumer_debt} onChange={v => updateNestedSnapshot("liabilities", { consumer_debt: v })} /></Field>
          </>
        ) : (
          <Field label="Consumer Debt"><Num prefix="$" step={500} value={snapshot.liabilities.consumer_debt} onChange={v => updateNestedSnapshot("liabilities", { consumer_debt: v })} /></Field>
        )}
      </Section>

      {/* ── Portfolio Holdings ── */}
      <Section title="Portfolio Holdings" accent="#c4784e" {...sec("holdings")}>
        {(snapshot.other_investments || []).map((inv, idx) => (
          <HoldingRow key={inv.id || idx} inv={inv as Holding}
            onUpdate={updated => { const a = [...(snapshot.other_investments || [])]; a[idx] = updated as any; updateNestedSnapshot("other_investments", a as any); }}
            onRemove={() => { const a = [...(snapshot.other_investments || [])]; a.splice(idx, 1); updateNestedSnapshot("other_investments", a as any); }} />
        ))}
        <div style={{ marginTop: 4 }}>
          <TickerAutocomplete placeholder="Search ticker or company" value={newInv.symbol} inputStyle={inputStyle}
            onChange={v => setNewInv(prev => ({ ...prev, symbol: v }))}
            onSelect={r => setNewInv(prev => ({ ...prev, symbol: r.symbol, name: r.name }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div><span style={labelStyle}>Shares</span>
            <input type="number" inputMode="decimal" placeholder="0" value={newInv.shares} onChange={e => setNewInv({ ...newInv, shares: e.target.value })} style={inputStyle} /></div>
          <div><span style={labelStyle}>Expected Return %</span>
            <LinkedNumberField variant="mobile" step={0.5}
              linked={newInv.retLinked}
              displayValue={newInv.retLinked ? 7 : (parseFloat(newInv.ret) || 0)}
              onOverride={() => setNewInv(p => ({ ...p, retLinked: false, ret: "7" }))}
              onChange={v => setNewInv(p => ({ ...p, ret: String(v), retLinked: false }))}
              onRelink={() => setNewInv(p => ({ ...p, retLinked: true, ret: "7" }))} /></div>
        </div>
        <button onClick={() => {
          const sh = parseFloat(newInv.shares);
          if (newInv.symbol && sh) {
            const ret = newInv.retLinked ? 7 : (newInv.ret ? parseFloat(newInv.ret) : 7);
            const inv = { id: Date.now().toString(), name: newInv.name || newInv.symbol, symbol: newInv.symbol, shares: sh, cost_basis: 0, current_price: 0, expected_return: ret };
            updateNestedSnapshot("other_investments", [...(snapshot.other_investments || []), inv] as any);
            setNewInv({ symbol: "", name: "", shares: "", ret: "7", retLinked: true });
          }
        }} style={{ marginTop: 10, width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${C.warmLight}`, background: C.warmWash, color: C.warm, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={15} /> Add Holding
        </button>
      </Section>

      {/* ── Education (529) — only relevant with kids ── */}
      {kids.length > 0 && (
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
      )}
    </>
  );
}

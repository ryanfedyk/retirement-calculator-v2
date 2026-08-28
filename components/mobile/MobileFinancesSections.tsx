"use client";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { IRS_401K } from "@/engine/calculator";
import TickerAutocomplete from "@/components/finance/TickerAutocomplete";
import PlanHistory from "@/components/finance/PlanHistory";
import BalanceSheetEditor from "@/components/finance/BalanceSheetEditor";
import RsuGrantsEditor from "@/components/finance/RsuGrantsEditor";
import type { LivePrices } from "@/components/finance/FinancialDashboard";
import { Field, Num, Two, Section, Toggle, TextInput, money, inputStyle, labelStyle } from "./sheetUI";

// The shared "Your finances" picture — cash-flow assumptions (income, company
// equity, spending, life events, editing the shared **baseline**) plus the full
// balance sheet via the shared BalanceSheetEditor (the same component the
// Portfolio hub uses, so the two can't drift). Touch-friendly twin of LeftPanel's
// `variant="finances"`.
export default function MobileFinancesSections({ livePrices = {} }: { livePrices?: LivePrices }) {
  const { config, baseline, updateBaseline, setEquityComp } = useFinancialStore();
  const ip = baseline.income_profile;
  const sp = baseline.spending;
  const ma = baseline.market_assumptions;
  const events = baseline.life_events ?? [];
  const setEvents = (next: typeof events) => updateBaseline("life_events", next);
  const thisYear = new Date().getFullYear();
  const [openId, setOpenId] = useState<string | null>("income");
  const [newEvent, setNewEvent] = useState({ name: "", year: thisYear + 3, cost: 50_000 });
  const sec = (id: string) => ({ openId, setOpenId, id });

  return (
    <>
      {/* Plan history — monthly net-worth + FI-date trail. */}
      <PlanHistory livePrices={livePrices} />

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
            <Field label="Unvested RSU grants (vest monthly from grant date)"><RsuGrantsEditor /></Field>
            {(ip.rsu_grants?.length ?? 0) === 0 && (
              <>
                <Two>
                  <Field label="Or unvested shares"><Num value={ip.initial_unvested_shares ?? 0} onChange={v => updateBaseline("income_profile", { initial_unvested_shares: v })} /></Field>
                  <Field label="Vesting (yrs)"><Num value={ip.vesting_years ?? 4} onChange={v => updateBaseline("income_profile", { vesting_years: v })} /></Field>
                </Two>
                <div style={{ fontSize: 11, color: C.inkFaint, lineHeight: 1.5, marginTop: -2 }}>A single lump vesting evenly over N years from today. Add dated grants above for an accurate calendar — they take over when present.</div>
              </>
            )}
            <Toggle label="Auto-sell shares as they vest" on={config.auto_sell_rsus === true} onChange={v => setEquityComp({ auto_sell_rsus: v })} />
            <div style={{ fontSize: 11, color: C.inkFaint, lineHeight: 1.5, marginTop: -2 }}>
              {config.auto_sell_rsus
                ? "Each vest is sold immediately; after-tax proceeds diversify into your brokerage (market growth) — no build-up in this stock."
                : "Vested shares are held (sell-to-cover). Turn on if your grants auto-sell at vest."}
            </div>
            <div style={{ fontSize: 11, color: C.inkFaint, lineHeight: 1.5 }}>Shared across every scenario. Your holdings of this stock (and how you sell it down) live in Portfolio and the per-scenario plan.</div>
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

      {/* ── Balance sheet — the shared editor (also in the Portfolio hub) ── */}
      <BalanceSheetEditor livePrices={livePrices} scope="full" defaultOpen={null} />
    </>
  );
}

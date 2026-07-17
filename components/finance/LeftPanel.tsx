"use client";
import { useState, useEffect } from "react";
import { Sliders, Wallet, Trash2, PlusCircle, ChevronDown, Pencil, ChevronLeft } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { C } from "@/config/colors";
import { DEFAULT_SNAPSHOT, DEFAULT_SIM_CONFIG } from "@/config/sharedConfig";
import { IRS_401K } from "@/engine/calculator";
import TickerAutocomplete from "./TickerAutocomplete";
import LinkedNumberField from "./LinkedNumberField";
import BaselineLinkBadge from "./BaselineLinkBadge";
import PlanHistory from "./PlanHistory";
import type { LivePrices } from "./FinancialDashboard";

// ── Styled primitives ─────────────────────────────────────────────────────────

const SectionHead = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <h3 style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ width: 3, height: 16, borderRadius: 2, background: color, flexShrink: 0 }} />
    {children}
  </h3>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
    {children}
  </div>
);

// Collapsible config section — progressive disclosure so the long config list
// is scannable. Independently toggles; essentials open by default.
const AccCard = ({ id, title, color, openIds, toggle, children, hidden }: {
  id: string; title: string; color: string;
  openIds: Set<string>; toggle: (id: string) => void; children: React.ReactNode; hidden?: boolean;
}) => {
  if (hidden) return null;
  const open = openIds.has(id);
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
      <button onClick={() => toggle(id)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 14px", background: "transparent", border: "none", cursor: "pointer",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{title}</span>
        </span>
        <ChevronDown size={15} color={C.inkSoft} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint, display: "block", marginBottom: 4 }}>
    {children}
  </label>
);

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`,
  borderRadius: 5, padding: "5px 8px", fontSize: 12, color: C.ink,
  background: C.bg, outline: "none",
};

// For number fields, hold a local string buffer while focused so the user can
// fully clear the field (otherwise a controlled `value={0}` immediately snaps
// back to "0" and you can never delete the leading zero). Text inputs keep the
// plain controlled behavior.
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  const { value, onChange, type, style, ...rest } = props;
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState<string>(value == null ? "" : String(value));
  useEffect(() => { if (!focused) setText(value == null ? "" : String(value)); }, [value, focused]);

  if (type !== "number") {
    return <input {...props} style={{ ...INPUT_STYLE, ...style }} />;
  }
  return (
    <input
      {...rest}
      type="number"
      value={focused ? text : (value == null ? "" : String(value))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => { setText(e.target.value); onChange?.(e); }}
      style={{ ...INPUT_STYLE, ...style }}
    />
  );
};

const Checkbox = ({
  checked, onChange, label, id,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) => (
  <label htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: C.inkMid, userSelect: "none" }}>
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      style={{ accentColor: C.teal, width: 14, height: 14 }}
    />
    {label}
  </label>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 10px" }}>
    {children}
  </div>
);

const Indent = ({ children }: { children: React.ReactNode }) => (
  <div style={{ paddingLeft: 12, borderLeft: `2px solid ${C.tealLight}`, marginTop: 8 }}>
    {children}
  </div>
);

const SectionDivider = () => (
  <div style={{ borderTop: `1px solid ${C.borderSoft}`, margin: "12px 0" }} />
);

// ── InvestmentItem ────────────────────────────────────────────────────────────

function InvestmentItem({
  inv, onRemove, onUpdate, liveInfo,
}: {
  inv: any;
  onRemove: () => void;
  onUpdate: (v: any) => void;
  liveInfo?: { price: number; source: "yahoo" | "fallback" };
}) {
  const [editing, setEditing] = useState(false);
  const [sym, setSym] = useState(inv.symbol);
  const [name, setName] = useState(inv.name);
  const [shares, setShares] = useState(String(inv.shares));
  const [ret, setRet] = useState(String(inv.expected_return ?? ""));

  if (editing) return (
    <div style={{ background: C.warmWash, border: `1px solid ${C.warmLight}`, borderRadius: 7, padding: 10, marginBottom: 6 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <TickerAutocomplete placeholder="Ticker" value={sym}
          onChange={setSym}
          onSelect={r => { setSym(r.symbol); setName(r.name); }} />
        <Input type="number" placeholder="Shares" value={shares} onChange={e => setShares(e.target.value)} />
        <Input type="number" placeholder="Expected return %" value={ret} onChange={e => setRet(e.target.value)} />
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button onClick={() => { onUpdate({ ...inv, symbol: sym, name: name || sym, shares: parseFloat(shares), expected_return: ret ? parseFloat(ret) : undefined }); setEditing(false); }}
            style={{ flex: 1, padding: "5px 0", background: C.teal, color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Save
          </button>
          <button onClick={() => setEditing(false)}
            style={{ flex: 1, padding: "5px 0", background: C.bgCard, border: `1px solid ${C.border}`, color: C.inkMid, borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const displayPrice = liveInfo?.price ?? inv.current_price ?? 0;
  const totalValue   = inv.shares * displayPrice;
  const isLive       = liveInfo?.source === "yahoo";
  const hasLive      = !!liveInfo;

  return (
    <div className="group" style={{ background: C.warmWash, border: `1px solid ${C.warmLight}`, borderRadius: 7, padding: "8px 10px", marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{inv.symbol}</span>
            {hasLive && (
              <span style={{
                fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 99,
                background: isLive ? C.tealWash : C.warmWash,
                color: isLive ? C.tealDark : C.warm,
                border: `1px solid ${isLive ? C.tealLight : C.warmLight}`,
              }}>
                {isLive ? "LIVE" : "DELAYED"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
            {inv.shares.toLocaleString(undefined, { maximumFractionDigits: 3 })} sh
            {inv.expected_return != null ? ` · ${inv.expected_return}% return` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 10, color: C.inkFaint, fontVariantNumeric: "tabular-nums" }}>
            @${displayPrice.toFixed(2)}/sh
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={() => setEditing(true)} aria-label="Edit holding" title="Edit"
          style={{ display: "flex", alignItems: "center", color: C.teal, background: "none", border: "none", cursor: "pointer", padding: 2 }}>
          <Pencil size={13} />
        </button>
        <button onClick={onRemove} aria-label="Remove holding" title="Remove"
          style={{ display: "flex", alignItems: "center", color: C.warm, background: "none", border: "none", cursor: "pointer", padding: 2 }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LeftPanel({ livePrices = {}, variant = "sidebar", onClose }: { livePrices?: LivePrices; variant?: "sidebar" | "finances"; onClose?: () => void }) {
  // "sidebar" = the per-scenario deep-dive (plan levers); "finances" = the
  // shared, scenario-independent balance sheet ("Your finances"). The factual
  // sections (assets, holdings, 529s) edit the global snapshot, so they're the
  // same across every scenario — they live in the finances variant only.
  const showFacts  = variant === "finances";
  const showLevers = variant === "sidebar";
  const { config, snapshot, profile, baseline, updateNestedConfig, updateNestedSnapshot, updateConfig, updateBaseline, setEquityComp, setChildren } = useFinancialStore();
  const kids = profile.children;
  const thisYear = new Date().getFullYear();
  const age = thisYear - (config.birth_year || 1985);
  const [newEvent, setNewEvent] = useState({ name: "", year: 2030, cost: 50_000 });
  const [newInvSym,  setNewInvSym]  = useState("");
  const [newInvName, setNewInvName] = useState("");
  const [newInvSh,   setNewInvSh]   = useState("");
  const [newInvRet,  setNewInvRet]  = useState("7");
  const [newInvRetLinked, setNewInvRetLinked] = useState(true); // default 7% until overridden

  const cp = config.career_path;
  const ip = config.income_profile;
  const ma = config.market_assumptions;
  const sp = config.spending;
  // Finances variant edits the shared baseline cash flow (income & spending) and
  // the shared equity-comp assumptions.
  const bip = baseline.income_profile;
  const bsp = baseline.spending;
  const bma = baseline.market_assumptions;

  // Accordion: essentials open by default; everything else collapsed.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(variant === "finances" ? ["fin_income", "assets"] : ["career", "market"]));
  const toggle = (id: string) => setOpenIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const acc = (id: string) => ({ id, openIds, toggle });

  return (
    <aside style={{
      width: showFacts ? "100%" : 300, flexShrink: 0, background: C.bgCard,
      borderRight: showFacts ? "none" : `1px solid ${C.border}`,
      flex: showFacts ? 1 : undefined, minHeight: showFacts ? 0 : undefined,
      overflowY: "auto", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Wallet size={14} color={C.teal} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.ink }}>
            {showFacts ? "Your finances" : "Scenario plan"}
          </span>
          {showFacts && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.teal, background: C.tealWash, borderRadius: 5, padding: "2px 7px" }}>
              shared across scenarios
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Collapse panel" title="Collapse"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg, color: C.inkSoft, cursor: "pointer", flexShrink: 0 }}>
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      <div style={{ padding: "14px 16px", flex: 1 }}>

        {/* Plan history — monthly net-worth + FI-date trail (finances view only). */}
        {showFacts && <PlanHistory />}

        {/* ── Income (baseline cash flow) ── */}
        <AccCard {...acc("fin_income")} hidden={!showFacts} title="Income" color="#4aab92">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <FieldLabel>Gross Annual Salary</FieldLabel>
              <Input type="number" step={1000} value={bip.gross_annual_salary || 0}
                onChange={e => updateBaseline("income_profile", { gross_annual_salary: +e.target.value || 0 })} />
            </div>
            <Row>
              <div><FieldLabel>Annual Raise (%)</FieldLabel>
                <Input type="number" step={0.1} value={bip.income_growth_rate ?? 0}
                  onChange={e => updateBaseline("income_profile", { income_growth_rate: +e.target.value || 0 })} /></div>
              <div><FieldLabel>Target Bonus (%)</FieldLabel>
                <Input type="number" step={1} value={bip.target_bonus_rate ?? 0}
                  onChange={e => updateBaseline("income_profile", { target_bonus_rate: +e.target.value || 0 })} /></div>
            </Row>
            <div><FieldLabel>Monthly Rental Income ($)</FieldLabel>
              <Input type="number" step={100} value={bip.monthly_rental_income ?? 0}
                onChange={e => updateBaseline("income_profile", { monthly_rental_income: +e.target.value || 0 })} /></div>

            {/* Pre-tax savings — your own contributions, not income. */}
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint, marginTop: 4 }}>Pre-tax retirement savings</div>
            <Row>
              <div><FieldLabel>Your 401(k) / yr ($)</FieldLabel>
                <Input type="number" step={500} value={bip.annual_401k_contribution ?? 0}
                  onChange={e => updateBaseline("income_profile", { annual_401k_contribution: +e.target.value || 0 })} /></div>
              <div><FieldLabel>Your Backdoor Roth / yr ($)</FieldLabel>
                <Input type="number" step={500} value={bip.annual_backdoor_roth ?? 0}
                  onChange={e => updateBaseline("income_profile", { annual_backdoor_roth: +e.target.value || 0 })} /></div>
            </Row>
            <Row>
              <div><FieldLabel>Employer Match Rate (%)</FieldLabel>
                <Input type="number" step={5} value={bip.employer_match_rate_pct ?? 0}
                  onChange={e => updateBaseline("income_profile", { employer_match_rate_pct: +e.target.value || 0 })} /></div>
              <div><FieldLabel>…of first % of salary (0 = all)</FieldLabel>
                <Input type="number" step={1} value={bip.employer_match_limit_pct ?? 0}
                  onChange={e => updateBaseline("income_profile", { employer_match_limit_pct: +e.target.value || 0 })} /></div>
            </Row>
            <div style={{ fontSize: 9, color: C.inkFaint, lineHeight: 1.5 }}>
              {(bip.employer_match_rate_pct ?? 0) > 0
                ? <>Your employer adds <strong>{bip.employer_match_rate_pct}%</strong> of {(bip.employer_match_limit_pct ?? 0) > 0 ? <>the first <strong>{bip.employer_match_limit_pct}%</strong> of salary you contribute</> : <>all your contributions</>} (e.g. Google is 50% of all). </>
                : <>Set a rate to model an employer match. </>}
              These are contributions you (and your employer) save — not income. IRS {IRS_401K.year} deferral cap ${IRS_401K.employeeLimit.toLocaleString()}/yr (+${IRS_401K.catchup.toLocaleString()} at {IRS_401K.catchupAge}+); the match adds on top, to a ${IRS_401K.totalAdditions.toLocaleString()} combined limit.
            </div>
            <div style={{ fontSize: 9, color: C.inkFaint, lineHeight: 1.5 }}>Your baseline cash flow — flows to every scenario unless a scenario overrides it.</div>
          </div>
        </AccCard>

        {/* ── Company Equity / RSUs (shared fact) ── */}
        <AccCard {...acc("fin_equity")} hidden={!showFacts} title="Company Equity / RSUs" color="#2a7a68">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: C.inkMid }}>I receive company equity (RSUs)</span>
              <input type="checkbox" checked={config.use_equity_comp === true}
                onChange={e => setEquityComp({ use_equity_comp: e.target.checked })}
                style={{ accentColor: C.teal }} />
            </div>
            {config.use_equity_comp === true && (
              <>
                <Row>
                  <div><FieldLabel>Company Ticker</FieldLabel>
                    <TickerAutocomplete placeholder="e.g. AAPL" value={config.concentrated_symbol ?? ""}
                      onChange={v => setEquityComp({ concentrated_symbol: v })}
                      onSelect={r => setEquityComp({ concentrated_symbol: r.symbol })} /></div>
                  <div><FieldLabel>Expected Return (%)</FieldLabel>
                    <Input type="number" step={0.5} value={bma.goog_growth_rate}
                      onChange={e => updateBaseline("market_assumptions", { goog_growth_rate: +e.target.value || 0 })} /></div>
                </Row>
                <div>
                  <FieldLabel>Unvested Shares (count · vesting yrs)</FieldLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 6 }}>
                    <Input type="number" placeholder="Total shares" value={bip.initial_unvested_shares ?? 0}
                      onChange={e => updateBaseline("income_profile", { initial_unvested_shares: +e.target.value || 0 })} />
                    <Input type="number" placeholder="Yrs" value={bip.vesting_years ?? 4}
                      onChange={e => updateBaseline("income_profile", { vesting_years: +e.target.value || 0 })} />
                  </div>
                </div>
                <div><FieldLabel>Annual Equity Refresher ($)</FieldLabel>
                  <Input type="number" step={1000} value={bip.annual_equity_grant ?? 0}
                    onChange={e => updateBaseline("income_profile", { annual_equity_grant: +e.target.value || 0 })} /></div>
                <div style={{ fontSize: 9, color: C.inkFaint, lineHeight: 1.5 }}>
                  Shared across every scenario. How you sell this position down over time is a per-scenario lever, in each scenario’s plan.
                </div>
              </>
            )}
          </div>
        </AccCard>

        {/* ── Spending (baseline cash flow) ── */}
        <AccCard {...acc("fin_spending")} hidden={!showFacts} title="Spending" color={C.warm}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><FieldLabel>Monthly Lifestyle (excl. housing &amp; healthcare)</FieldLabel>
              <Input type="number" step={250} value={bsp.monthly_lifestyle}
                onChange={e => updateBaseline("spending", { monthly_lifestyle: +e.target.value || 0 })} /></div>
            <div>
              <FieldLabel>Housing</FieldLabel>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                {(["mortgage", "rent"] as const).map(t => {
                  const on = (bsp.housing_type ?? "mortgage") === t;
                  return (
                    <button key={t} onClick={() => updateBaseline("spending", { housing_type: t })}
                      style={{ flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", textTransform: "capitalize",
                        border: `1px solid ${on ? C.teal : C.border}`, background: on ? C.tealWash : C.bgCard,
                        color: on ? C.tealDark : C.inkMid, fontSize: 12, fontWeight: 700 }}>{t}</button>
                  );
                })}
              </div>
            </div>
            <Row>
              <div><FieldLabel>{(bsp.housing_type ?? "mortgage") === "rent" ? "Rent ($/mo)" : "Mortgage ($/mo)"}</FieldLabel>
                <Input type="number" step={100} value={bsp.mortgage_payment}
                  onChange={e => updateBaseline("spending", { mortgage_payment: +e.target.value || 0 })} /></div>
              <div><FieldLabel>Healthcare ($/mo, pre-65)</FieldLabel>
                <Input type="number" step={100} value={bsp.healthcare_premium}
                  onChange={e => updateBaseline("spending", { healthcare_premium: +e.target.value || 0 })} /></div>
            </Row>
            <div style={{ fontSize: 9, color: C.inkFaint, lineHeight: 1.5 }}>
              {(bsp.housing_type ?? "mortgage") === "rent"
                ? "Rent is treated as a permanent expense — it’s included in your FI number (×25) and never ends."
                : "A mortgage is finite: the payment ends at payoff, and your remaining balance (in Assets & Liabilities) is added to your FI number."}
            </div>
            <div><FieldLabel>Long-Term Care ($/yr, today&apos;s $; 0 = off)</FieldLabel>
              <Input type="number" step={5000} value={bsp.ltc_annual_cost ?? 0}
                onChange={e => updateBaseline("spending", { ltc_annual_cost: +e.target.value || 0 })} /></div>
          </div>
        </AccCard>

        {/* ── Life Events (baseline) ── */}
        <AccCard {...acc("fin_events")} hidden={!showFacts} title="Life Events" color="#c4784e">
          <div style={{ fontSize: 10, color: C.inkFaint, marginBottom: 10, lineHeight: 1.5 }}>
            One-off future costs (a home purchase, a big trip) — shared across every scenario. College costs auto-update from Profile → Family.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {(baseline.life_events ?? []).map((evt, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg, borderRadius: 7, padding: "8px 10px", border: `1px solid ${C.borderSoft}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evt.name}</span>
                    {evt.auto && <span style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.inkFaint, background: C.bgHeader, borderRadius: 4, padding: "1px 5px" }}>auto</span>}
                  </div>
                  <div style={{ fontSize: 10, color: C.inkSoft }}>{evt.year} · ${evt.cost.toLocaleString()}</div>
                </div>
                {!evt.auto && (
                  <button onClick={() => updateBaseline("life_events", (baseline.life_events ?? []).filter((_, i) => i !== idx))}
                    aria-label="Remove event" style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 12, flexShrink: 0 }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ background: C.bg, borderRadius: 7, padding: "10px 12px", border: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint, marginBottom: 8 }}>Add New Event</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input placeholder="Event Name" value={newEvent.name} onChange={e => setNewEvent({ ...newEvent, name: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <Input type="number" placeholder="Year" value={newEvent.year} onChange={e => setNewEvent({ ...newEvent, year: +e.target.value })} />
                <Input type="number" placeholder="Cost $" value={newEvent.cost} onChange={e => setNewEvent({ ...newEvent, cost: +e.target.value })} />
              </div>
              <button onClick={() => {
                if (newEvent.name && newEvent.year && newEvent.cost) {
                  updateBaseline("life_events", [...(baseline.life_events ?? []), { name: newEvent.name, year: newEvent.year, cost: newEvent.cost, auto: false }]);
                  setNewEvent({ name: "", year: 2030, cost: 50_000 });
                }
              }} style={{ padding: "6px 0", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.inkMid, cursor: "pointer", fontWeight: 600 }}>
                + Add Event
              </button>
            </div>
          </div>
        </AccCard>

        {/* ── Assets & Liabilities ── */}
        <AccCard {...acc("assets")} hidden={!showFacts} title="Assets & Liabilities" color={C.teal}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <FieldLabel>Cash Savings</FieldLabel>
              <Input type="number" value={snapshot.liquid_assets.cash_savings}
                onChange={e => updateNestedSnapshot("liquid_assets", { cash_savings: +e.target.value || 0 })} />
            </div>
            <div>
              <FieldLabel>401(k) Balance</FieldLabel>
              <Input type="number" value={snapshot.retirement_assets.k401}
                onChange={e => updateNestedSnapshot("retirement_assets", { k401: +e.target.value || 0 })} />
            </div>
            <div>
              <FieldLabel>Roth IRA</FieldLabel>
              <Input type="number" value={snapshot.retirement_assets.roth_ira}
                onChange={e => updateNestedSnapshot("retirement_assets", { roth_ira: +e.target.value || 0 })} />
            </div>
            {(bsp.housing_type ?? "mortgage") !== "rent" && (
              <>
                <div>
                  <FieldLabel>Mortgage Balance</FieldLabel>
                  <Input type="number" value={snapshot.liabilities.mortgage_balance}
                    onChange={e => updateNestedSnapshot("liabilities", { mortgage_balance: +e.target.value || 0 })} />
                </div>
                <div>
                  <FieldLabel>Home / Building Value</FieldLabel>
                  <Input type="number" value={snapshot.liabilities.property_value ?? 0}
                    onChange={e => updateNestedSnapshot("liabilities", { property_value: +e.target.value || 0 })} />
                  {(snapshot.liabilities.property_value ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Equity today: ${Math.max(0, (snapshot.liabilities.property_value ?? 0) - snapshot.liabilities.mortgage_balance).toLocaleString()} — counted in net worth (not in your spendable FI assets).
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </AccCard>

        {/* ── Career Trajectory ── */}
        <AccCard {...acc("career")} hidden={!showLevers} title="Career Trajectory" color={C.teal}>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.inkMid }}>Career Exit Year</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: C.teal, background: C.tealWash, padding: "1px 8px", borderRadius: 99 }}>
                {cp.exit_year}
              </span>
            </div>
            <input type="range" min={2024} max={Math.max(2040, (config.birth_year || (thisYear - age)) + 75, cp.exit_year)} step={1} value={cp.exit_year}
              style={{ width: "100%", accentColor: C.teal }}
              onChange={e => {
                const yr = parseInt(e.target.value);
                updateNestedConfig("career_path", { exit_year: yr });
                if (config.divestment_strategy.type === "progressive") {
                  const w = config.divestment_strategy.end_year - config.divestment_strategy.start_year;
                  updateNestedConfig("divestment_strategy", { start_year: yr, end_year: yr + w });
                }
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Exit Month (time it to a bonus/vest)</FieldLabel>
            <select value={cp.exit_month ?? 0}
              onChange={e => updateNestedConfig("career_path", { exit_month: +e.target.value })}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.bgCard, color: C.ink, fontSize: 13, cursor: "pointer" }}>
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>

          <SectionDivider />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Checkbox label="Take a Sabbatical?" checked={cp.use_sabbatical}
              onChange={v => {
                updateNestedConfig("career_path", { use_sabbatical: v });
                // A sabbatical returns to work, not straight to retirement — ease back in with a bridge role.
                if (v && !cp.use_jump && !cp.use_bridge) {
                  updateNestedConfig("career_path", { use_bridge: true });
                  if (!ip.bridge_gross_annual) updateNestedConfig("income_profile", { bridge_gross_annual: Math.round((ip.gross_annual_salary || 0) * 0.4) });
                }
              }} />
            {cp.use_sabbatical && (
              <Indent>
                <FieldLabel>Duration (years)</FieldLabel>
                <Input type="number" value={cp.sabbatical_duration}
                  onChange={e => updateNestedConfig("career_path", { sabbatical_duration: +e.target.value })} />
              </Indent>
            )}

            <Checkbox label="Model Career Jump?" checked={cp.use_jump}
              onChange={v => updateNestedConfig("career_path", { use_jump: v })} />
            {cp.use_jump && (
              <Indent>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div><FieldLabel>Duration (years)</FieldLabel>
                    <Input type="number" value={cp.jump_duration}
                      onChange={e => updateNestedConfig("career_path", { jump_duration: +e.target.value })} /></div>
                  <div><FieldLabel>Annual Base Salary</FieldLabel>
                    <Input type="number" value={ip.jump_gross_annual}
                      onChange={e => updateNestedConfig("income_profile", { jump_gross_annual: +e.target.value })} /></div>
                  <div><FieldLabel>Bonus Target (%)</FieldLabel>
                    <Input type="number" value={ip.jump_bonus_rate || 0}
                      onChange={e => updateNestedConfig("income_profile", { jump_bonus_rate: +e.target.value })} /></div>
                  <div><FieldLabel>Annual Equity ($)</FieldLabel>
                    <Input type="number" value={(ip.jump_grant_monthly || 0) * 12}
                      onChange={e => updateNestedConfig("income_profile", { jump_grant_monthly: +e.target.value / 12 })} /></div>
                  <Checkbox label="Supplies Health Insurance" id="jump_health"
                    checked={ip.jump_has_health_insurance ?? true}
                    onChange={v => updateNestedConfig("income_profile", { jump_has_health_insurance: v })} />
                </div>
              </Indent>
            )}

            <Checkbox label="Model Bridge Role?" checked={cp.use_bridge}
              onChange={v => updateNestedConfig("career_path", { use_bridge: v })} />
            {cp.use_bridge && (
              <Indent>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div><FieldLabel>Duration (years)</FieldLabel>
                    <Input type="number" value={cp.bridge_duration}
                      onChange={e => updateNestedConfig("career_path", { bridge_duration: +e.target.value })} /></div>
                  <div><FieldLabel>Annual Gross Salary</FieldLabel>
                    <Input type="number" value={ip.bridge_gross_annual || 0}
                      onChange={e => updateNestedConfig("income_profile", { bridge_gross_annual: +e.target.value })} /></div>
                  <Checkbox label="Supplies Health Insurance" id="bridge_health"
                    checked={ip.bridge_has_health_insurance || false}
                    onChange={v => updateNestedConfig("income_profile", { bridge_has_health_insurance: v })} />
                </div>
              </Indent>
            )}
          </div>
        </AccCard>

        {/* ── Income Modeling ── */}
        <AccCard {...acc("income")} hidden={!showLevers} title="Income Modeling" color="#4aab92">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BaselineLinkBadge section="income_profile" />
            <div>
              <FieldLabel>Gross Annual Salary</FieldLabel>
              <Input type="number" step={1000} value={ip.gross_annual_salary || 0}
                onChange={e => {
                  const gross = +e.target.value || 0;
                  updateNestedConfig("income_profile", { gross_annual_salary: gross, google_net_monthly: Math.round(gross * 0.65 / 12) });
                }} />
              <div style={{ fontSize: 9, color: C.inkFaint, marginTop: 3, textAlign: "right" }}>
                Est. net monthly: ${ip.google_net_monthly.toLocaleString()}
              </div>
            </div>
            <Row>
              <div><FieldLabel>Annual Raise (%)</FieldLabel>
                <Input type="number" step={0.1} value={ip.income_growth_rate ?? 0}
                  onChange={e => updateNestedConfig("income_profile", { income_growth_rate: +e.target.value })} /></div>
              <div><FieldLabel>Target Bonus (%)</FieldLabel>
                <Input type="number" step={1} value={ip.target_bonus_rate ?? 0}
                  onChange={e => updateNestedConfig("income_profile", { target_bonus_rate: +e.target.value })} /></div>
            </Row>
            <div style={{ fontSize: 9, color: C.inkFaint, lineHeight: 1.5 }}>
              Company equity / RSUs now live in <strong>Your finances</strong> (they’re shared across every scenario). The sell-down plan stays here, below.
            </div>
          </div>
        </AccCard>

        {/* ── Additional Income ── */}
        <AccCard {...acc("supplemental")} hidden={!showLevers} title="Additional Income" color="#4aab92">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><FieldLabel>Monthly Rental Income ($)</FieldLabel>
              <Input type="number" step={100} value={ip.monthly_rental_income ?? 0}
                onChange={e => updateNestedConfig("income_profile", { monthly_rental_income: +e.target.value })} /></div>
            <div><FieldLabel>Monthly Part-Time Work Income ($)</FieldLabel>
              <Input type="number" step={100} value={ip.monthly_parttime_income ?? 0}
                onChange={e => updateNestedConfig("income_profile", { monthly_parttime_income: +e.target.value })} /></div>

            {ip.use_partner_income ? (
              <>
                <SectionDivider />
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint }}>Partner Income</div>
                <div><FieldLabel>Gross Annual Salary</FieldLabel>
                  <Input type="number" step={1000} value={ip.partner_gross_annual_salary || 0}
                    onChange={e => updateNestedConfig("income_profile", { partner_gross_annual_salary: +e.target.value || 0 })} /></div>
                <Row>
                  <div><FieldLabel>Start Year</FieldLabel>
                    <Input type="number" value={ip.partner_employment_start_year || 2025}
                      onChange={e => updateNestedConfig("income_profile", { partner_employment_start_year: +e.target.value })} /></div>
                  <div><FieldLabel>Retirement Year</FieldLabel>
                    <Input type="number" value={ip.partner_retirement_year || 2030}
                      onChange={e => updateNestedConfig("income_profile", { partner_retirement_year: +e.target.value || 2030 })} /></div>
                </Row>
                <Checkbox label="Supplies Health Insurance" id="partner_health"
                  checked={ip.partner_has_health_insurance || false}
                  onChange={v => updateNestedConfig("income_profile", { partner_has_health_insurance: v })} />
              </>
            ) : (
              <div style={{ fontSize: 9, color: C.inkFaint }}>Add a partner in Profile → Family to model their income.</div>
            )}
          </div>
        </AccCard>

        {/* ── Market & Lifestyle ── */}
        <AccCard {...acc("market")} hidden={!showLevers} title="Market & Lifestyle" color={C.warm}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BaselineLinkBadge section="market_assumptions" />
            <Row>
              <div><FieldLabel>Market Return (%)</FieldLabel>
                <Input type="number" step={0.1} value={ma.market_return_rate}
                  onChange={e => updateNestedConfig("market_assumptions", { market_return_rate: +e.target.value })} /></div>
              <div><FieldLabel>Volatility Drag (%)</FieldLabel>
                <Input type="number" step={0.1} value={ma.volatility_drag}
                  onChange={e => updateNestedConfig("market_assumptions", { volatility_drag: +e.target.value })} /></div>
            </Row>
            <Row>
              <div><FieldLabel>Inflation (%)</FieldLabel>
                <Input type="number" step={0.25} value={ma.inflation_rate}
                  onChange={e => updateNestedConfig("market_assumptions", { inflation_rate: +e.target.value })} /></div>
              <div />
            </Row>

            <SectionDivider />
            <BaselineLinkBadge section="spending" />

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.inkMid }}>Monthly Spend</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>${sp.monthly_lifestyle.toLocaleString()}</span>
              </div>
              <input type="range" min={3000} max={35000} step={250} value={sp.monthly_lifestyle}
                style={{ width: "100%", accentColor: C.warm, marginBottom: 6 }}
                onChange={e => updateNestedConfig("spending", { monthly_lifestyle: +e.target.value })} />
              <Input type="number" value={sp.monthly_lifestyle}
                onChange={e => updateNestedConfig("spending", { monthly_lifestyle: +e.target.value })} />
              <div style={{ fontSize: 9, color: C.inkFaint, marginTop: 3 }}>Everyday living costs — excludes rent/mortgage &amp; healthcare (set separately).</div>
            </div>

            <SectionDivider />

            <div><FieldLabel>Monthly Mortgage / Rent Payment ($)</FieldLabel>
              <Input type="number" value={sp.mortgage_payment}
                onChange={e => updateNestedConfig("spending", { mortgage_payment: +e.target.value || 0 })} />
              <div style={{ fontSize: 9, color: C.inkFaint, marginTop: 3 }}>Automatically ends Jun 2051</div>
            </div>
            <div><FieldLabel>Healthcare Premium ($/mo)</FieldLabel>
              <Input type="number" step={100} value={sp.healthcare_premium}
                onChange={e => updateNestedConfig("spending", { healthcare_premium: +e.target.value })} /></div>

            {kids.length > 0 && (
              <>
                <SectionDivider />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint }}>Empty Nest Phase</span>
                  <input type="checkbox" checked={sp.use_empty_nest !== false}
                    onChange={e => updateNestedConfig("spending", { use_empty_nest: e.target.checked })}
                    style={{ accentColor: C.teal }} />
                </div>
                {sp.use_empty_nest !== false && (
                  <Row>
                    <div><FieldLabel>Start Year</FieldLabel>
                      <Input type="number" value={sp.empty_nest_year || 2038}
                        onChange={e => updateNestedConfig("spending", { empty_nest_year: +e.target.value })} /></div>
                    <div>
                      <FieldLabel>Monthly Spend</FieldLabel>
                      <LinkedNumberField
                        linked={sp.empty_nest_linked !== false}
                        step={250}
                        displayValue={sp.empty_nest_linked !== false ? Math.round(sp.monthly_lifestyle * 0.85) : (sp.empty_nest_monthly_spend ?? 0)}
                        onOverride={() => updateNestedConfig("spending", { empty_nest_linked: false, empty_nest_monthly_spend: Math.round(sp.monthly_lifestyle * 0.85) })}
                        onChange={v => updateNestedConfig("spending", { empty_nest_monthly_spend: v, empty_nest_linked: false })}
                        onRelink={() => updateNestedConfig("spending", { empty_nest_linked: true })} />
                      {sp.empty_nest_linked !== false && (
                        <div style={{ fontSize: 9, color: C.inkFaint, marginTop: 3 }}>−15% of monthly spend · ✎ to override</div>
                      )}
                    </div>
                  </Row>
                )}
              </>
            )}
          </div>
        </AccCard>

        {/* ── Divestment Strategy (only relevant with company stock) ── */}
        {config.use_equity_comp === true && (
        <AccCard {...acc("divest")} hidden={!showLevers} title="Company Stock Divestment" color="#2a7a68">
          <div style={{ fontSize: 10, color: C.inkFaint, marginBottom: 10, lineHeight: 1.5 }}>
            How you sell down your concentrated company stock ({config.concentrated_symbol || "your ticker"}) over time to diversify.
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {(["none", "progressive", "immediate"] as const).map(t => (
              <button key={t} onClick={() => updateNestedConfig("divestment_strategy", { type: t })}
                style={{
                  flex: 1, padding: "5px 0", borderRadius: 5, border: `1px solid ${config.divestment_strategy.type === t ? C.teal : C.border}`,
                  background: config.divestment_strategy.type === t ? C.tealWash : C.bgCard,
                  color: config.divestment_strategy.type === t ? C.teal : C.inkMid,
                  fontSize: 10, fontWeight: 600, cursor: "pointer",
                }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {config.divestment_strategy.type === "progressive" && (
            <div style={{ background: C.bg, borderRadius: 7, padding: "10px 12px", border: `1px solid ${C.borderSoft}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.inkFaint, marginBottom: 4 }}>
                <span>Start: {config.divestment_strategy.start_year}</span>
                <span>End: {config.divestment_strategy.end_year}</span>
              </div>
              <input type="range" min={2024} max={2040} value={config.divestment_strategy.start_year}
                style={{ width: "100%", accentColor: C.teal, marginBottom: 6 }}
                onChange={e => { const v = +e.target.value; if (v < config.divestment_strategy.end_year) updateNestedConfig("divestment_strategy", { start_year: v }); }} />
              <input type="range" min={2024} max={2045} value={config.divestment_strategy.end_year}
                style={{ width: "100%", accentColor: C.teal }}
                onChange={e => { const v = +e.target.value; if (v > config.divestment_strategy.start_year) updateNestedConfig("divestment_strategy", { end_year: v }); }} />
            </div>
          )}
        </AccCard>
        )}

        {/* Tax, Social Security & Medicare now live in Settings (profile menu). */}

        {/* ── Life Events ── */}
        <AccCard {...acc("events")} hidden={!showLevers} title="Life Events" color="#c4784e">
          <BaselineLinkBadge section="life_events" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {(config.life_events || []).map((evt, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg, borderRadius: 7, padding: "8px 10px", border: `1px solid ${C.borderSoft}` }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.ink }}>{evt.name}</div>
                  <div style={{ fontSize: 10, color: C.inkSoft }}>{evt.year} · ${evt.cost.toLocaleString()}</div>
                </div>
                <button onClick={() => {
                  const evts = [...(config.life_events || [])];
                  evts.splice(idx, 1);
                  updateNestedConfig("life_events", evts as any);
                }} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 12 }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ background: C.bg, borderRadius: 7, padding: "10px 12px", border: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint, marginBottom: 8 }}>Add New Event</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input placeholder="Event Name" value={newEvent.name} onChange={e => setNewEvent({ ...newEvent, name: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <Input type="number" placeholder="Year" value={newEvent.year} onChange={e => setNewEvent({ ...newEvent, year: +e.target.value })} />
                <Input type="number" placeholder="Cost $" value={newEvent.cost} onChange={e => setNewEvent({ ...newEvent, cost: +e.target.value })} />
              </div>
              <button onClick={() => {
                if (newEvent.name && newEvent.year && newEvent.cost) {
                  const evts = [...(config.life_events || []), newEvent];
                  updateNestedConfig("life_events", evts as any);
                  setNewEvent({ name: "", year: 2030, cost: 50_000 });
                }
              }} style={{ padding: "6px 0", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.inkMid, cursor: "pointer", fontWeight: 600 }}>
                + Add Event
              </button>
            </div>
          </div>
        </AccCard>

        {/* Family (kids & partner) now lives in Settings (profile menu). */}

        {/* ── Portfolio Holdings ── */}
        <AccCard {...acc("holdings")} hidden={!showFacts} title="Portfolio Holdings" color="#c4784e">
          <div style={{ marginBottom: 8 }}>
            {(snapshot.other_investments || []).map((inv, idx) => (
              <InvestmentItem key={inv.id || idx} inv={inv} liveInfo={livePrices[inv.symbol.toUpperCase()]}
                onRemove={() => {
                  const arr = [...(snapshot.other_investments || [])];
                  arr.splice(idx, 1);
                  updateNestedSnapshot("other_investments", arr as any);
                }}
                onUpdate={updated => {
                  const arr = [...(snapshot.other_investments || [])];
                  arr[idx] = updated;
                  updateNestedSnapshot("other_investments", arr as any);
                }}
              />
            ))}
          </div>
          <div style={{ background: C.bg, borderRadius: 7, padding: "10px 12px", border: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint, marginBottom: 8 }}>Add Holding</div>
            <div style={{ marginBottom: 6 }}>
              <TickerAutocomplete placeholder="Search ticker or company" value={newInvSym}
                onChange={setNewInvSym}
                onSelect={r => { setNewInvSym(r.symbol); setNewInvName(r.name); }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
              <div><FieldLabel>Shares</FieldLabel>
                <Input type="number" placeholder="0" value={newInvSh} onChange={e => setNewInvSh(e.target.value)} /></div>
              <div><FieldLabel>Expected Return %</FieldLabel>
                <LinkedNumberField
                  linked={newInvRetLinked} step={0.5}
                  displayValue={newInvRetLinked ? 7 : (parseFloat(newInvRet) || 0)}
                  onOverride={() => { setNewInvRetLinked(false); setNewInvRet("7"); }}
                  onChange={v => { setNewInvRet(String(v)); setNewInvRetLinked(false); }}
                  onRelink={() => { setNewInvRetLinked(true); setNewInvRet("7"); }} /></div>
            </div>
            <button onClick={() => {
              const sh = parseFloat(newInvSh);
              if (newInvSym && sh) {
                const ret = newInvRetLinked ? 7 : (newInvRet ? parseFloat(newInvRet) : 7);
                const inv = { id: Date.now().toString(), name: newInvName || newInvSym, symbol: newInvSym, shares: sh, cost_basis: 0, current_price: 0, expected_return: ret };
                const arr = [...(snapshot.other_investments || []), inv];
                updateNestedSnapshot("other_investments", arr as any);
                setNewInvSym(""); setNewInvName(""); setNewInvSh(""); setNewInvRet("7"); setNewInvRetLinked(true);
              }
            }} style={{ width: "100%", padding: "6px 0", background: C.warmWash, border: `1px solid ${C.warmLight}`, color: C.warm, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              + Add Investment
            </button>
          </div>
        </AccCard>

        {/* ── Education (529) — only relevant with kids ── */}
        {kids.length > 0 && (
        <AccCard {...acc("edu")} hidden={!showFacts} title="Education Assets (529)" color={C.teal}>
          <div style={{ marginBottom: 8 }}>
            {(snapshot.education_assets?.accounts || []).map((acc, idx) => (
              <div key={acc.id || idx} className="group" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: C.bg, borderRadius: 6, border: `1px solid ${C.borderSoft}`, marginBottom: 6 }}>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input value={acc.name} onChange={e => {
                    const accs = [...(snapshot.education_assets.accounts || [])];
                    accs[idx] = { ...acc, name: e.target.value };
                    updateNestedSnapshot("education_assets", { accounts: accs });
                  }} style={{ fontSize: 11, background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, outline: "none", color: C.ink, width: "100%" }} placeholder="Name" />
                  <input type="number" value={acc.balance} onChange={e => {
                    const accs = [...(snapshot.education_assets.accounts || [])];
                    accs[idx] = { ...acc, balance: parseFloat(e.target.value) };
                    updateNestedSnapshot("education_assets", { accounts: accs });
                  }} style={{ fontSize: 11, background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, outline: "none", color: C.ink, width: "100%", textAlign: "right", fontVariantNumeric: "tabular-nums" }} />
                </div>
                <button onClick={() => {
                  const accs = (snapshot.education_assets.accounts || []).filter((_, i) => i !== idx);
                  updateNestedSnapshot("education_assets", { accounts: accs });
                }} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => {
            const accs = [...(snapshot.education_assets.accounts || []), { id: crypto.randomUUID(), name: "New 529", balance: 0 }];
            updateNestedSnapshot("education_assets", { accounts: accs });
          }} style={{ width: "100%", padding: "7px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, fontWeight: 600, color: C.inkSoft, background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 6, cursor: "pointer" }}>
            <PlusCircle size={12} /> Add 529 Account
          </button>
        </AccCard>
        )}

      </div>
    </aside>
  );
}

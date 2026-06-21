"use client";
import { useState, useEffect } from "react";
import { Sliders, RotateCcw, Wallet, Trash2, PlusCircle, ChevronDown, Pencil } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { C } from "@/config/colors";
import { DEFAULT_SNAPSHOT, DEFAULT_SIM_CONFIG } from "@/config/sharedConfig";
import TickerAutocomplete from "./TickerAutocomplete";
import LinkedNumberField from "./LinkedNumberField";
import { STATE_OPTIONS } from "@/engine/state_tax";
import { estimateMonthlySocialSecurity } from "@/engine/social_security";
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
const AccCard = ({ id, title, color, openIds, toggle, children }: {
  id: string; title: string; color: string;
  openIds: Set<string>; toggle: (id: string) => void; children: React.ReactNode;
}) => {
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

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    style={{
      width: "100%", border: `1px solid ${C.border}`, borderRadius: 5,
      padding: "5px 8px", fontSize: 12, color: C.ink, background: C.bg,
      outline: "none", cursor: "pointer",
    }}
  />
);

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

export default function LeftPanel({ livePrices = {} }: { livePrices?: LivePrices }) {
  const { config, snapshot, profile, updateProfile, updateNestedConfig, updateNestedSnapshot, updateConfig, setChildren, resetToDefaults } = useFinancialStore();
  const kids = profile.children;
  const thisYear = new Date().getFullYear();
  const age = thisYear - (config.birth_year || profile.birthYear || 1985);
  const setAge = (a: number) => {
    const birthYear = thisYear - Math.max(0, a);
    updateProfile({ birthYear });
    updateConfig({ birth_year: birthYear });
  };
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

  // Accordion: essentials open by default; everything else collapsed.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(["career", "market"]));
  const toggle = (id: string) => setOpenIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const acc = (id: string) => ({ id, openIds, toggle });

  return (
    <aside style={{
      width: 300, flexShrink: 0, background: C.bgCard,
      borderRight: `1px solid ${C.border}`,
      overflowY: "auto", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Wallet size={14} color={C.teal} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.ink }}>Configuration</span>
        </div>
        <button
          onClick={() => {
            if (window.confirm("Reset everything to defaults?\n\nThis permanently erases your current configuration and can't be undone."))
              resetToDefaults();
          }}
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.inkFaint, background: "none", border: "none", cursor: "pointer" }}>
          <RotateCcw size={11} /> Reset
        </button>
      </div>

      <div style={{ padding: "14px 16px", flex: 1 }}>

        {/* ── Assets & Liabilities ── */}
        <AccCard {...acc("assets")} title="Assets & Liabilities" color={C.teal}>
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
            <div>
              <FieldLabel>Mortgage Balance</FieldLabel>
              <Input type="number" value={snapshot.liabilities.mortgage_balance}
                onChange={e => updateNestedSnapshot("liabilities", { mortgage_balance: +e.target.value || 0 })} />
            </div>
          </div>
        </AccCard>

        {/* ── Career Trajectory ── */}
        <AccCard {...acc("career")} title="Career Trajectory" color={C.teal}>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel>Your Age</FieldLabel>
            <Input type="number" min={18} max={100} value={age}
              onChange={e => setAge(+e.target.value || 0)} />
            <div style={{ fontSize: 9, color: C.inkFaint, marginTop: 3 }}>Sets your birth year ({thisYear - age}) and the projection horizon.</div>
          </div>

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

          <SectionDivider />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Checkbox label="Take a Sabbatical?" checked={cp.use_sabbatical}
              onChange={v => updateNestedConfig("career_path", { use_sabbatical: v })} />
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
        <AccCard {...acc("income")} title="Income Modeling" color="#4aab92">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            <SectionDivider />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint }}>Company Equity / RSUs</span>
              <input type="checkbox" checked={config.use_equity_comp === true}
                onChange={e => updateConfig({ use_equity_comp: e.target.checked })}
                style={{ accentColor: C.teal }} />
            </div>
            {config.use_equity_comp === true && (
              <>
                <Row>
                  <div><FieldLabel>Company Ticker</FieldLabel>
                    <TickerAutocomplete placeholder="e.g. AAPL" value={config.concentrated_symbol ?? ""}
                      onChange={v => updateConfig({ concentrated_symbol: v })}
                      onSelect={r => updateConfig({ concentrated_symbol: r.symbol })} /></div>
                  <div><FieldLabel>Expected Return (%)</FieldLabel>
                    <Input type="number" step={0.5} value={ma.goog_growth_rate}
                      onChange={e => updateNestedConfig("market_assumptions", { goog_growth_rate: +e.target.value })} /></div>
                </Row>
                <div>
                  <FieldLabel>Unvested Shares (count · vesting yrs)</FieldLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 6 }}>
                    <Input type="number" placeholder="Total shares" value={ip.initial_unvested_shares ?? 0}
                      onChange={e => updateNestedConfig("income_profile", { initial_unvested_shares: +e.target.value })} />
                    <Input type="number" placeholder="Yrs" value={ip.vesting_years ?? 4}
                      onChange={e => updateNestedConfig("income_profile", { vesting_years: +e.target.value })} />
                  </div>
                </div>
                <div><FieldLabel>Annual Equity Refresher ($)</FieldLabel>
                  <Input type="number" step={1000} value={ip.annual_equity_grant ?? 0}
                    onChange={e => updateNestedConfig("income_profile", { annual_equity_grant: +e.target.value })} /></div>
              </>
            )}
          </div>
        </AccCard>

        {/* ── Additional Income ── */}
        <AccCard {...acc("supplemental")} title="Additional Income" color="#4aab92">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><FieldLabel>Monthly Rental Income ($)</FieldLabel>
              <Input type="number" step={100} value={ip.monthly_rental_income ?? 0}
                onChange={e => updateNestedConfig("income_profile", { monthly_rental_income: +e.target.value })} /></div>
            <div><FieldLabel>Monthly Part-Time Work Income ($)</FieldLabel>
              <Input type="number" step={100} value={ip.monthly_parttime_income ?? 0}
                onChange={e => updateNestedConfig("income_profile", { monthly_parttime_income: +e.target.value })} /></div>

            <SectionDivider />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint }}>Partner Income</span>
              <input type="checkbox" checked={ip.use_partner_income || false}
                onChange={e => updateNestedConfig("income_profile", { use_partner_income: e.target.checked })}
                style={{ accentColor: C.teal }} />
            </div>
            {ip.use_partner_income && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
              </div>
            )}
          </div>
        </AccCard>

        {/* ── Market & Lifestyle ── */}
        <AccCard {...acc("market")} title="Market & Lifestyle" color={C.warm}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
        <AccCard {...acc("divest")} title="Company Stock Divestment" color="#2a7a68">
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

        {/* ── Tax Profiling ── */}
        <AccCard {...acc("tax")} title="Tax Profiling" color={C.inkMid}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><FieldLabel>Filing Status</FieldLabel>
              <Select value={config.tax_assumptions?.filing_status ?? "single"}
                onChange={e => updateNestedConfig("tax_assumptions", { filing_status: e.target.value as any })}>
                <option value="single">Single</option>
                <option value="married_joint">Married Filing Jointly</option>
                <option value="married_separate">Married Filing Separately</option>
                <option value="head_household">Head of Household</option>
              </Select>
            </div>
            <div><FieldLabel>State of Residence</FieldLabel>
              <Select value={config.tax_assumptions?.state_of_residence ?? "NONE"}
                onChange={e => updateNestedConfig("tax_assumptions", { state_of_residence: e.target.value as any })}>
                {STATE_OPTIONS.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </Select>
            </div>
          </div>
        </AccCard>

        {/* ── Social Security & Medicare ── */}
        <AccCard {...acc("ssmed")} title="Social Security & Medicare" color={C.inkSoft}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Row>
              <div><FieldLabel>SS Start Age</FieldLabel>
                <Input type="number" value={config.social_security?.start_age ?? 67}
                  onChange={e => updateNestedConfig("social_security", { start_age: +e.target.value } as any)} /></div>
              <div><FieldLabel>SS Monthly ($)</FieldLabel>
                <LinkedNumberField
                  linked={config.social_security?.social_security_linked !== false}
                  displayValue={config.social_security?.social_security_linked !== false
                    ? estimateMonthlySocialSecurity(ip.gross_annual_salary, config.social_security?.start_age ?? 67)
                    : (config.social_security?.monthly_amount ?? 0)}
                  onOverride={() => updateNestedConfig("social_security", { social_security_linked: false, monthly_amount: estimateMonthlySocialSecurity(ip.gross_annual_salary, config.social_security?.start_age ?? 67) } as any)}
                  onChange={v => updateNestedConfig("social_security", { monthly_amount: v, social_security_linked: false } as any)}
                  onRelink={() => updateNestedConfig("social_security", { social_security_linked: true } as any)} />
                <div style={{ fontSize: 9, color: C.inkFaint, marginTop: 3 }}>
                  {config.social_security?.social_security_linked !== false ? "Estimated from your income · ✎ to override" : "Manual · ↺ to re-estimate"}
                </div>
              </div>
            </Row>
            <Row>
              <div><FieldLabel>Medicare Age</FieldLabel>
                <Input type="number" value={config.medicare?.start_age ?? 65}
                  onChange={e => updateNestedConfig("medicare", { start_age: +e.target.value } as any)} /></div>
              <div><FieldLabel>Medicare Premium</FieldLabel>
                <Input type="number" value={config.medicare?.monthly_premium ?? 174.70}
                  onChange={e => updateNestedConfig("medicare", { monthly_premium: +e.target.value } as any)} /></div>
            </Row>
          </div>
        </AccCard>

        {/* ── Life Events ── */}
        <AccCard {...acc("events")} title="Life Events" color="#c4784e">
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

        {/* ── Family ── */}
        <AccCard {...acc("family")} title="Family" color="#7a6da8">
          <div style={{ fontSize: 10, color: C.inkFaint, marginBottom: 10, lineHeight: 1.5 }}>
            Adding kids plots their milestones, plans college costs, and sets the empty-nest phase to when your youngest turns 18.
          </div>
          {kids.map((child, idx) => (
            <div key={idx} style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 6 }}>
              <div style={{ flex: 1.5 }}>
                <FieldLabel>Name</FieldLabel>
                <Input type="text" placeholder="Child's name" value={child.name}
                  onChange={e => setChildren(kids.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))} />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>Birth Year</FieldLabel>
                <Input type="number" placeholder="2015" value={child.birthYear}
                  onChange={e => setChildren(kids.map((c, i) => i === idx ? { ...c, birthYear: +e.target.value || c.birthYear } : c))} />
              </div>
              <button onClick={() => setChildren(kids.filter((_, i) => i !== idx))} aria-label="Remove child"
                style={{ flexShrink: 0, height: 30, width: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, color: C.warm, cursor: "pointer" }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={() => setChildren([...kids, { name: "", birthYear: new Date().getFullYear() - 5, birthMonth: 0 }])}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 0", background: C.tealWash, border: `1px solid ${C.tealLight}`, color: C.tealDark, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
            <PlusCircle size={12} /> Add Child
          </button>
        </AccCard>

        {/* ── Portfolio Holdings ── */}
        <AccCard {...acc("holdings")} title="Portfolio Holdings" color="#c4784e">
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

        {/* ── Education (529) ── */}
        <AccCard {...acc("edu")} title="Education Assets (529)" color={C.teal}>
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

      </div>
    </aside>
  );
}

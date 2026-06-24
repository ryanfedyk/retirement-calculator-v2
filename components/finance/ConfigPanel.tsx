"use client";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useConfirm } from "@/components/ui/DialogProvider";

// ── Helpers ──────────────────────────────────────────────────────────────────

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 4 }}>
    {children}
  </div>
);

const NumField = ({
  label, value, onChange, prefix = "", suffix = "", step = 1, min, max,
}: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number; min?: number; max?: number;
}) => (
  <div>
    <Label>{label}</Label>
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px" }}>
      {prefix && <span style={{ color: C.inkFaint, fontSize: 11 }}>{prefix}</span>}
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: C.ink, fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 0,
        }}
      />
      {suffix && <span style={{ color: C.inkFaint, fontSize: 11 }}>{suffix}</span>}
    </div>
  </div>
);

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 32, height: 18, borderRadius: 99, position: "relative", flexShrink: 0,
        background: checked ? C.teal : C.border, transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: checked ? 16 : 2, width: 14, height: 14,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s",
      }} />
    </div>
    <span style={{ fontSize: 11, color: C.inkMid }}>{label}</span>
  </label>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.teal, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}` }}>
      {title}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
      {children}
    </div>
  </div>
);

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ConfigPanel() {
  const { config, snapshot, updateCareerPath, updateIncomeProfile, updateMarketAssumptions, updateSpending, resetToDefaults } = useFinancialStore();
  const confirm = useConfirm();
  const cp = config.career_path;
  const ip = config.income_profile;
  const ma = config.market_assumptions;
  const sp = config.spending;

  return (
    <div style={{ fontSize: 12, color: C.ink }}>
      {/* Career Path */}
      <Section title="Career Path">
        <NumField label="Exit Year" value={cp.exit_year} min={2025} max={2040}
          onChange={v => updateCareerPath({ exit_year: v })} />
        <div style={{ gridColumn: "1 / -1" }}>
          <Toggle label="Include Jump (e.g. startup)" checked={cp.use_jump}
            onChange={v => updateCareerPath({ use_jump: v })} />
        </div>
        {cp.use_jump && (
          <NumField label="Jump Duration (yrs)" value={cp.jump_duration} step={0.5} min={0.5} max={5}
            onChange={v => updateCareerPath({ jump_duration: v })} />
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <Toggle label="Include Bridge Role" checked={cp.use_bridge}
            onChange={v => updateCareerPath({ use_bridge: v })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Toggle label="Include Sabbatical" checked={cp.use_sabbatical}
            onChange={v => updateCareerPath({ use_sabbatical: v })} />
        </div>
      </Section>

      {/* Income */}
      <Section title="Income">
        <NumField label="Gross Salary" value={ip.gross_annual_salary} step={1000} prefix="$"
          onChange={v => updateIncomeProfile({ gross_annual_salary: v })} />
        <NumField label="Bonus Rate" value={ip.target_bonus_rate * 100} step={1} suffix="%"
          onChange={v => updateIncomeProfile({ target_bonus_rate: v / 100 })} />
        <NumField label="Annual Equity Grant" value={ip.annual_equity_grant} step={5000} prefix="$"
          onChange={v => updateIncomeProfile({ annual_equity_grant: v })} />
        <NumField label="Income Growth Rate" value={ip.income_growth_rate} step={0.5} suffix="%"
          onChange={v => updateIncomeProfile({ income_growth_rate: v })} />
        <NumField label="Net Monthly (Google)" value={ip.google_net_monthly} step={500} prefix="$"
          onChange={v => updateIncomeProfile({ google_net_monthly: v })} />
        <NumField label="Rental Income" value={ip.monthly_rental_income} step={100} prefix="$"
          onChange={v => updateIncomeProfile({ monthly_rental_income: v })} />
        <NumField label="Rental Growth Rate" value={ip.rental_income_growth_rate ?? 3} step={0.25} suffix="%"
          onChange={v => updateIncomeProfile({ rental_income_growth_rate: v })} />
      </Section>

      {/* Market Assumptions */}
      <Section title="Market Assumptions">
        <NumField label="Employer Stock Growth" value={ma.goog_growth_rate} step={0.5} suffix="%"
          onChange={v => updateMarketAssumptions({ goog_growth_rate: v })} />
        <NumField label="Market Return" value={ma.market_return_rate} step={0.5} suffix="%"
          onChange={v => updateMarketAssumptions({ market_return_rate: v })} />
        <NumField label="Inflation" value={ma.inflation_rate} step={0.25} suffix="%"
          onChange={v => updateMarketAssumptions({ inflation_rate: v })} />
        <NumField label="Volatility Drag" value={ma.volatility_drag} step={0.25} suffix="%"
          onChange={v => updateMarketAssumptions({ volatility_drag: v })} />
        <NumField label="Healthcare Inflation (over CPI)" value={ma.healthcare_inflation_premium ?? 2} step={0.25} suffix="%"
          onChange={v => updateMarketAssumptions({ healthcare_inflation_premium: v })} />
      </Section>

      {/* Spending */}
      <Section title="Spending">
        <NumField label="Monthly Lifestyle" value={sp.monthly_lifestyle} step={250} prefix="$"
          onChange={v => updateSpending({ monthly_lifestyle: v })} />
        <NumField label="Mortgage Payment" value={sp.mortgage_payment} step={100} prefix="$"
          onChange={v => updateSpending({ mortgage_payment: v })} />
        <NumField label="Healthcare Premium" value={sp.healthcare_premium} step={100} prefix="$"
          onChange={v => updateSpending({ healthcare_premium: v })} />
        <NumField label="Empty Nest Spend" value={sp.empty_nest_monthly_spend ?? 0} step={250} prefix="$"
          onChange={v => updateSpending({ empty_nest_monthly_spend: v })} />
        <NumField label="Long-Term Care (annual, today's $)" value={sp.ltc_annual_cost ?? 0} step={5000} prefix="$"
          onChange={v => updateSpending({ ltc_annual_cost: v })} />
        <NumField label="LTC Start Age" value={sp.ltc_start_age ?? 80} step={1}
          onChange={v => updateSpending({ ltc_start_age: v })} />
        <NumField label="LTC Duration (years)" value={sp.ltc_years ?? 3} step={1}
          onChange={v => updateSpending({ ltc_years: v })} />
      </Section>

      {/* Reset */}
      <button
        onClick={async () => { if (await confirm({ title: "Start over?", message: "This clears your plan and balance sheet and walks you back through the quick setup. It can't be undone.", confirmLabel: "Start over", danger: true })) resetToDefaults(); }}
        style={{
          width: "100%", padding: "7px 0", background: "transparent",
          border: `1px solid ${C.border}`, borderRadius: 6,
          color: C.inkSoft, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", cursor: "pointer",
        }}
      >
        Start Over
      </button>
    </div>
  );
}

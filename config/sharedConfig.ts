/**
 * sharedConfig.ts
 * Single source of truth for all personal data.
 * Both the Horizon forecasting view and the financial modelling view
 * derive their defaults from this file.
 */

import type { SimulationConfiguration, FinancialSnapshot } from "@/engine/calculator";

// ── Personal ────────────────────────────────────────────────────────────────
export const PERSONAL = {
  name:           "Ryan",
  birthYear:      1980,
  retirementYear: 2030,
  retirementMonth: 2,          // 0-indexed (March)
  corporateStartYear: 2000,
  children: [
    { name: "Oona", birthYear: 2015, birthMonth: 8 }, // 0-indexed (Sept)
    { name: "Veda", birthYear: 2017, birthMonth: 6 }, // 0-indexed (July)
  ],
  /** Approximate college start ages and cost per year */
  collegeAgeStart:   18,
  collegeYearlyCost: 50_000, // per child, per year
} as const;

// ── Default Financial Snapshot ───────────────────────────────────────────────
export const DEFAULT_SNAPSHOT: FinancialSnapshot = {
  snapshot_date: new Date().toISOString(),
  last_updated:  Date.now(),
  share_counts: {
    google_shares:   0,
    cost_basis:      0,
    live_stock_price: 0,
  },
  liquid_assets: {
    vanguard_bridge:    0,
    cash_savings:       33_000,
    google_equity_value: 0,
  },
  retirement_assets: {
    k401:         617_361.90,
    roth_ira:     0,
    traditional_ira: 0,
  },
  education_assets: {
    total_529: 91_362.42,
    accounts: [
      { id: "529-1", name: "529 — Oona", balance: 43_920.42 },
      { id: "529-2", name: "529 — Veda", balance: 47_442 },
    ],
  },
  liabilities: {
    mortgage_balance:      1_430_301.40,
    mortgage_interest_rate: 3.5,
    consumer_debt:         0,
    upcoming_capital_calls: 0,
  },
  other_investments: [
    { id: "vti",     name: "VTI",     symbol: "VTI",   shares: 70.302,   cost_basis: 0, current_price: 270, expected_return: 7   },
    { id: "vfiax-1", name: "VFIAX",   symbol: "VFIAX", shares: 105.997,  cost_basis: 0, current_price: 520, expected_return: 7   },
    { id: "vfiax-2", name: "VFIAX",   symbol: "VFIAX", shares: 18.289,   cost_basis: 0, current_price: 520, expected_return: 7   },
    { id: "vfiax-3", name: "VFIAX",   symbol: "VFIAX", shares: 19.084,   cost_basis: 0, current_price: 520, expected_return: 7   },
    { id: "vghcx",   name: "VGHCX",   symbol: "VGHCX", shares: 188.384,  cost_basis: 0, current_price: 95,  expected_return: 7   },
    { id: "vseqx",   name: "VSEQX",   symbol: "VSEQX", shares: 524.753,  cost_basis: 0, current_price: 48,  expected_return: 7   },
    { id: "vtivx",   name: "VTIVX",   symbol: "VTIVX", shares: 418.306,  cost_basis: 0, current_price: 38,  expected_return: 7   },
    { id: "goog",    name: "GOOG",    symbol: "GOOG",  shares: 1_149.52, cost_basis: 0, current_price: 180, expected_return: 11.5 },
  ],
};

// ── Life Events auto-derived from PERSONAL ───────────────────────────────────
function buildLifeEvents(): SimulationConfiguration["life_events"] {
  const events: SimulationConfiguration["life_events"] = [];
  for (const child of PERSONAL.children) {
    const collegeStart = child.birthYear + PERSONAL.collegeAgeStart;
    for (let yr = collegeStart; yr < collegeStart + 4; yr++) {
      events.push({
        name: `${child.name} — College Year ${yr - collegeStart + 1}`,
        year: yr,
        cost: PERSONAL.collegeYearlyCost,
      });
    }
  }
  // One-time renovation in year 1
  events.push({ name: "Home renovation", year: 2026, cost: 100_000 });
  return events;
}

// ── Default Simulation Config ─────────────────────────────────────────────────
export const DEFAULT_SIM_CONFIG: SimulationConfiguration = {
  career_path: {
    exit_year:          PERSONAL.retirementYear,
    use_jump:           false,
    jump_duration:      2,
    use_sabbatical:     false,
    sabbatical_duration: 6,
    use_bridge:         false,
    bridge_duration:    2,
  },
  income_profile: {
    gross_annual_salary:    303_524,
    google_net_monthly:     14_000,
    initial_unvested_shares: 4_137,
    vesting_years:          4,
    jump_gross_annual:      200_000,
    jump_bonus_rate:        15,
    jump_grant_monthly:     5_000,
    bridge_gross_annual:    150_000,
    bridge_has_health_insurance: false,
    income_growth_rate:     3,
    target_bonus_rate:      25,
    annual_equity_grant:    300_000,
    monthly_rental_income:  5_000,
    annual_401k_contribution: 23_500,   // IRS 2025 max; auto-bumped to $31k at age 50+
    annual_backdoor_roth:     7_000,    // Backdoor Roth IRA (non-deductible → immediate conversion)
    use_partner_income:     false,
    partner_gross_annual_salary: 0,
    partner_employment_start_year: 2025,
    partner_has_health_insurance: false,
    partner_retirement_year: PERSONAL.retirementYear,
  },
  market_assumptions: {
    goog_growth_rate:   11.5,
    market_return_rate: 7,
    inflation_rate:     3,
    volatility_drag:    1.5,
  },
  tax_assumptions: {
    filing_status:      "married_joint",
    state_of_residence: "NY",
  },
  divestment_strategy: {
    type:       "progressive",
    start_year: 2027,
    end_year:   2030,
  },
  spending: {
    monthly_lifestyle:         9_500,
    empty_nest_year:           2039,
    empty_nest_monthly_spend:  8_000,
    healthcare_premium:        2_500,
    mortgage_payment:          7_435.67,
  },
  birth_year: PERSONAL.birthYear,
  social_security: {
    start_age:     67,
    monthly_amount: 3_500,
  },
  medicare: {
    start_age:      65,
    monthly_premium: 250,   // per-person all-in (Part B + Part D + modest Medigap); ×2 adults ≈ $500/mo
  },
  tax_optimization: {
    enable_aca_optimization:       true,
    aca_family_size:               4,       // Ryan + spouse + 2 kids
    aca_benchmark_monthly_premium: 2_500,   // Silver benchmark in NYC area
    enable_roth_conversion:        true,    // Convert trad 401k during sabbatical
    roth_conversion_target_bracket: 206_700, // Top of 22% bracket for MFJ 2025
  },
  life_events: buildLifeEvents(),
};

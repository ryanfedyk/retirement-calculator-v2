/**
 * sharedConfig.ts
 * Generic defaults for a brand-new Horizon user.
 *
 * Personal data is no longer hardcoded here — it lives per-user in the Zustand
 * store (see store/useFinancialStore.ts) and round-trips to Firestore. These
 * exports are only the blank-slate starting point a new account is seeded with;
 * onboarding and the config panels fill in the real numbers.
 */

import type { SimulationConfiguration, FinancialSnapshot } from "@/engine/calculator";

const CURRENT_YEAR = new Date().getFullYear();

// ── User Profile ─────────────────────────────────────────────────────────────
export interface UserProfile {
  name: string;
  birthYear: number;
  retirementYear: number;
  retirementMonth: number; // 0-indexed (0 = January)
  children: { name: string; birthYear: number; birthMonth: number }[];
  corporateStartYear: number;
  onboarded: boolean;
}

export const DEFAULT_PROFILE: UserProfile = {
  name: "",
  birthYear: CURRENT_YEAR - 40,
  retirementYear: CURRENT_YEAR + 10,
  retirementMonth: 0,
  children: [],
  corporateStartYear: CURRENT_YEAR - 15,
  onboarded: false,
};

// ── Default Financial Snapshot (blank slate) ─────────────────────────────────
export const DEFAULT_SNAPSHOT: FinancialSnapshot = {
  snapshot_date: new Date().toISOString(),
  last_updated:  Date.now(),
  share_counts: {
    google_shares:    0,
    cost_basis:       0,
    live_stock_price: 0,
  },
  liquid_assets: {
    vanguard_bridge:     0,
    cash_savings:        0,
    google_equity_value: 0,
  },
  retirement_assets: {
    k401:            0,
    roth_ira:        0,
    traditional_ira: 0,
  },
  education_assets: {
    total_529: 0,
    accounts:  [],
  },
  liabilities: {
    mortgage_balance:       0,
    mortgage_interest_rate: 0,
    consumer_debt:          0,
    upcoming_capital_calls: 0,
  },
  other_investments: [],
};

// ── Life Events derived from a profile's children ────────────────────────────
/** Builds college-cost life events for a set of children. Returns [] for none. */
export function buildLifeEvents(
  children: UserProfile["children"],
  collegeAgeStart = 18,
  collegeYearlyCost = 50_000,
): SimulationConfiguration["life_events"] {
  const events: SimulationConfiguration["life_events"] = [];
  for (const child of children) {
    const collegeStart = child.birthYear + collegeAgeStart;
    for (let yr = collegeStart; yr < collegeStart + 4; yr++) {
      events.push({
        name: `${child.name} — College Year ${yr - collegeStart + 1}`,
        year: yr,
        cost: collegeYearlyCost,
        auto: true,
      });
    }
  }
  return events;
}

// ── Default Simulation Config (generic assumptions) ──────────────────────────
export const DEFAULT_SIM_CONFIG: SimulationConfiguration = {
  career_path: {
    exit_year:           DEFAULT_PROFILE.retirementYear,
    use_jump:            false,
    jump_duration:       2,
    use_sabbatical:      false,
    sabbatical_duration: 6,
    use_bridge:          false,
    bridge_duration:     2,
  },
  income_profile: {
    gross_annual_salary:     120_000,
    google_net_monthly:      0,
    initial_unvested_shares: 0,
    vesting_years:           4,
    jump_gross_annual:       0,
    jump_bonus_rate:         15,
    jump_grant_monthly:      0,
    bridge_gross_annual:     0,
    bridge_has_health_insurance: false,
    income_growth_rate:      3,
    target_bonus_rate:       10,
    annual_equity_grant:     0,
    monthly_rental_income:   0,
    monthly_parttime_income: 0,
    annual_401k_contribution: 23_500,   // IRS 2025 max; auto-bumped at age 50+
    annual_backdoor_roth:     7_000,
    use_partner_income:      false,
    partner_gross_annual_salary:   0,
    partner_employment_start_year: CURRENT_YEAR,
    partner_has_health_insurance:  false,
    partner_retirement_year:       DEFAULT_PROFILE.retirementYear,
  },
  market_assumptions: {
    goog_growth_rate:   11.5,
    market_return_rate: 7,
    inflation_rate:     3,
    volatility_drag:    1.5,
  },
  tax_assumptions: {
    filing_status:      "single",
    state_of_residence: "NONE",
  },
  divestment_strategy: {
    type:       "progressive",
    start_year: CURRENT_YEAR,
    end_year:   DEFAULT_PROFILE.retirementYear,
  },
  spending: {
    monthly_lifestyle:        5_000,
    use_empty_nest:           true,
    empty_nest_year:          DEFAULT_PROFILE.retirementYear + 9,
    empty_nest_monthly_spend: 4_500,
    healthcare_premium:       1_000,
    mortgage_payment:         0,
  },
  birth_year: DEFAULT_PROFILE.birthYear,
  social_security: {
    start_age:      67,
    monthly_amount: 2_000,
  },
  medicare: {
    start_age:       65,
    monthly_premium: 250,
  },
  tax_optimization: {
    enable_aca_optimization:       true,
    aca_family_size:               1,
    aca_benchmark_monthly_premium: 800,
    enable_roth_conversion:        false,
    roth_conversion_target_bracket: 100_525, // Top of 22% bracket, single 2025
  },
  concentrated_symbol: "",
  children:    [],
  life_events: [],
};

export interface FinancialSnapshot {
  snapshot_date: string;
  share_counts: {
    google_shares: number;
    cost_basis?: number;
    live_stock_price?: number;
  };
  liquid_assets: {
    vanguard_bridge: number;
    cash_savings: number;
    google_equity_value: number;
  };
  retirement_assets: {
    k401: number;
    roth_ira: number;
    traditional_ira: number;
  };
  education_assets: {
    total_529: number;
    accounts: { id: string; name: string; balance: number }[];
  };
  liabilities: {
    mortgage_balance: number;
    mortgage_interest_rate?: number;
    mortgage_payoff_date?: string;
    consumer_debt: number;
    consumer_debt_payoff_date?: string;
    upcoming_capital_calls: number;
    capital_calls_due_date?: string;
  };
  other_investments: Array<{
    id: string;
    name: string;
    symbol: string;
    shares: number;
    cost_basis: number;
    current_price: number;
    expected_return?: number;
  }>;
  last_updated?: number;
}

export interface SimulationConfiguration {
  career_path: {
    exit_year: number;
    exit_month?: number; // 0-indexed month of exit within exit_year (0 = January; default 0)
    use_jump: boolean;
    jump_duration: number;
    use_sabbatical: boolean;
    sabbatical_duration: number;
    use_bridge: boolean;
    bridge_duration: number;
  };
  income_profile: {
    gross_annual_salary: number;
    google_net_monthly: number;
    initial_unvested_shares: number;
    vesting_years: number;
    jump_gross_annual: number;
    jump_bonus_rate: number;
    jump_grant_monthly: number;
    jump_has_health_insurance?: boolean; // Does the encore/jump career supply coverage? Default true.
    bridge_gross_annual: number;
    bridge_has_health_insurance?: boolean;
    income_growth_rate: number;    // Nominal annual raise % (not stacked on inflation)
    target_bonus_rate: number;
    annual_equity_grant: number;
    monthly_rental_income: number;
    rental_income_growth_rate?: number; // Annual rental growth % (market-specific; default 3%)
    monthly_parttime_income?: number;   // Supplemental earned income (part-time work)
    annual_401k_contribution?: number;  // Your pre-tax 401k deferral (default IRS max)
    annual_backdoor_roth?: number;      // Your backdoor Roth IRA per year (default $7k)
    // Employer 401k match, expressed the way employers describe it: "match
    // {rate}% of {the first {limit}% of salary you contribute}". A 0 rate = no
    // match; a 0 limit = match ALL your contributions (e.g. Google's 50%-of-all).
    employer_match_rate_pct?: number;
    employer_match_limit_pct?: number;
    use_partner_income?: boolean;
    partner_gross_annual_salary?: number;
    partner_employment_start_year?: number;
    partner_birth_year?: number;          // Partner's birth year — informs their Medicare/SS timing (derived from partner_birth_date)
    partner_birth_date?: string;          // Partner's full birthday, ISO "YYYY-MM-DD" (source of truth; year projected for the sim)
    partner_has_health_insurance?: boolean;
    partner_retirement_year?: number;
  };
  market_assumptions: {
    goog_growth_rate: number;
    market_return_rate: number;
    inflation_rate: number;
    volatility_drag: number;
    return_volatility?: number; // Annual std-dev of market returns (%), for Monte Carlo; default 15
    healthcare_inflation_premium?: number; // Real healthcare growth above CPI (%/yr); default 2
    taxable_dividend_drag?: number; // Annual tax drag on taxable accounts (%/yr); default 0.4
  };
  tax_assumptions: {
    filing_status: 'single' | 'married_joint' | 'married_separate' | 'head_household';
    state_of_residence: StateCode;
    itemized_deductions?: number; // Extra annual itemized deductions (charitable, etc.) beyond auto mortgage/SALT
    w4_allowances?: number;       // Number of deductions/allowances claimed on the W-4
  };
  tax_optimization: {
    enable_aca_optimization: boolean;      // Model ACA subsidies during low-income phases
    enable_roth_conversion: boolean;       // Convert trad 401k to Roth during sabbatical
    roth_conversion_target_bracket: number;// Convert up to this $ taxable income (MFJ)
  };
  divestment_strategy: {
    type: 'none' | 'immediate' | 'progressive';
    start_year: number;
    end_year: number;
  };
  spending: {
    monthly_lifestyle: number;
    use_empty_nest?: boolean;          // Whether to model a distinct empty-nest spending phase
    empty_nest_linked?: boolean;       // When true (default), empty-nest spend tracks monthly_lifestyle (−15%)
    empty_nest_year?: number;
    empty_nest_monthly_spend?: number;
    healthcare_premium: number;
    mortgage_payment: number;
    // How the monthly housing payment behaves. 'mortgage' (default): a finite,
    // nominal-fixed debt that amortizes and ends at payoff; its remaining balance
    // is added to the FI number. 'rent': a perpetual real expense — it never ends,
    // so it's part of recurring expenses and capitalized into the FI number (×25),
    // with no balance to amortize or pay off.
    housing_type?: 'mortgage' | 'rent';
    ltc_annual_cost?: number;  // Long-term care: annual cost in today's $ (0 = not modeled)
    ltc_start_age?: number;    // Age the LTC episode begins (default 80)
    ltc_years?: number;        // Duration of the LTC episode in years (default 3)
  };
  birth_year: number;
  // Whether the user receives company equity (RSUs). Gates the equity-income
  // inputs and the divestment strategy. Default off.
  use_equity_comp?: boolean;
  social_security: {
    start_age: number;
    monthly_amount: number;
    social_security_linked?: boolean; // When true (default), estimate from income
    partner_monthly_amount?: number;
    partner_ss_linked?: boolean;      // When true (default), estimate partner SS from their income
  };
  medicare: {
    start_age: number;
    monthly_premium: number;
  };
  // Survivor transition for couples: when one spouse dies, the household drops to
  // one Social Security benefit (the larger survives), files as single, and spends
  // less. Only applies to married_joint; first_death_age = 0 disables it.
  mortality?: {
    first_death_age?: number;           // primary's age at the first death (0 = off)
    survivor_spending_factor?: number;  // survivor spend as a fraction of the couple's (default 0.75)
  };
  life_events: Array<{
    name: string;
    year: number;
    cost: number;
    auto?: boolean;   // Auto-generated (e.g. college costs derived from children) vs user-added
  }>;
  // Children, projected from the user profile — used to count kids still on the
  // family health plan. Optional so existing configs without it still type-check.
  children?: Array<{ birthYear: number }>;
  // Ticker of the user's concentrated/employer-equity position. When set, this
  // holding gets its own growth rate (goog_growth_rate) and divestment strategy.
  // Empty/undefined = no concentrated position (all holdings grow at their own
  // expected return).
  concentrated_symbol?: string;
}

export interface TrajectoryPoint {
  date: string;
  monthIndex: number;
  liquidCash: number;
  retirement: number;
  rothBalance: number;      // Roth portion of retirement (tax-free in retirement)
  googValue: number;
  totalNetWorth: number;
  totalLiabilities: number;
  isIndependent: boolean;
  swrTarget: number;              // the FI Number (Rule of 25)
  investableAssets: number;      // assets that fund retirement, GROSS (excl. 529)
  investableAfterTax: number;    // spendable value of those assets, net of the
                                 // tax owed on pre-tax balances + embedded gains
                                 // (this is what the FI test compares against)
  annualExpenseNeed: number;     // retirement annual expenses (incl self-paid healthcare)
  annualPassiveIncome: number;   // rental + Social Security, net of tax
  currentPhase: 'GOOGLE' | 'SABBATICAL' | 'JUMP' | 'BRIDGE' | 'RETIRED';
  // Income — all NET of tax, annualised
  salaryAndEquityNet: number;
  rentalIncomeNet: number;
  socialSecurityNet: number;
  totalCompensation: number;
  // Expenses — annualised gross
  rentalIncome: number;
  healthcareCost: number;
  accumulatedReturns: number;
  mortgagePayment: number;
  lifestyleExpense: number;
  socialSecurityIncome: number;
  educationAssets: number;
}

/**
 * Whether dollar figures are shown in today's purchasing power ("today") or in
 * the inflated, face-value dollars of each future month ("future" / nominal).
 */
export type DollarMode = 'today' | 'future';

// Fields on a TrajectoryPoint that are NOT dollar amounts and must be left alone
// when re-expressing a trajectory in nominal dollars.
const NON_MONETARY_FIELDS = new Set<string>([
  'date', 'monthIndex', 'isIndependent', 'currentPhase',
]);

/**
 * Re-express a real (today's-dollar) trajectory in the chosen display basis.
 *
 * The engine runs entirely in today's dollars, so "today" mode is a no-op. For
 * "future" mode we re-inflate every dollar field of each month by CPI compounded
 * over the months elapsed since today — turning purchasing power back into the
 * face-value dollars a statement would actually show in that month. Month 0
 * (today) is unchanged, so headline "now" figures never move.
 */
export function toDisplayDollars(
  trajectory: TrajectoryPoint[],
  mode: DollarMode,
  inflationRatePct: number,
): TrajectoryPoint[] {
  if (mode === 'today' || !inflationRatePct) return trajectory;
  const annual = 1 + inflationRatePct / 100;
  return trajectory.map((pt) => {
    const mult = Math.pow(annual, pt.monthIndex / 12);
    const out = { ...pt } as Record<string, unknown>;
    for (const key in out) {
      if (typeof out[key] === 'number' && !NON_MONETARY_FIELDS.has(key)) {
        out[key] = (out[key] as number) * mult;
      }
    }
    return out as unknown as TrajectoryPoint;
  });
}

import { calculateTaxRaw } from './tax_engine';
import type { StateCode } from './state_tax';
import { estimateMonthlySocialSecurity, estimatePIA, claimingFactor, estimateSpousalBenefit } from './social_security';

// Age at which a child is assumed to leave the family health plan (post-college).
const CHILD_OFF_PLAN_AGE = 22;

// ── ACA Federal Poverty Line (2025) ──────────────────────────────────────────
// 48 contiguous states + DC
function getFPL(familySize: number): number {
  const base = 15_060;
  const perPerson = 5_380;
  return base + perPerson * Math.max(0, familySize - 1);
}

// ACA premium tax credit — the "applicable percentage" of income you're expected
// to pay toward the benchmark plan, by income as a multiple of the Federal
// Poverty Line. Returns null when there is NO subsidy.
//
// The ARPA/IRA *enhanced* subsidies (8.5%-of-income cap at every income level,
// no upper limit) EXPIRED at the end of 2025. From 2026 on, absent new
// legislation, the law reverts to the original sliding scale — including the
// **400% FPL subsidy cliff**: a household even $1 over 400% FPL gets nothing and
// pays the full unsubsidized premium. This matters a lot for an early retiree
// with rental + investment income, whose MAGI commonly clears 400% FPL. Values
// approximate the pre-ARPA schedule (indexed ~2021).
function acaApplicablePct(fplRatio: number): number | null {
  if (fplRatio < 1.38) return 0;       // ≤138% FPL → Medicaid (expansion states) ≈ free
  if (fplRatio <= 1.50) return 0.0314;
  if (fplRatio <= 2.00) return 0.0529;
  if (fplRatio <= 2.50) return 0.0743;
  if (fplRatio <= 3.00) return 0.0908;
  if (fplRatio <= 4.00) return 0.0983;
  return null;                         // > 400% FPL → subsidy cliff: no premium tax credit
}

// Taxable brokerage/cash throws off dividends & interest every year — ordinary
// MAGI even in years with no asset sales. A diversified taxable portfolio yields
// ~2%/yr (qualified dividends + interest); count it toward MAGI so ACA/IRMAA see
// it. (The *tax* on it is already modeled via market_assumptions.dividend drag;
// this only adds it to the MAGI tally for subsidy/surcharge tests.)
const TAXABLE_DIVIDEND_YIELD = 0.02;

// Even with a generous ACA premium subsidy, real pre-65 health spending doesn't
// hit $0 — premium share + deductibles/copays/dental persist. Floor the modeled
// self-paid cost at this fraction of the full unsubsidized premium.
const ACA_OUT_OF_POCKET_FLOOR = 0.5;

// IRS 401(k) limits (2026). Exported so the UI shows the same numbers it enforces.
//  • employeeLimit — your elective deferral cap (402(g))
//  • catchup       — extra deferral allowed at 50+
//  • totalAdditions — combined employee + employer cap (415(c))
export const IRS_401K = {
  year: 2026,
  employeeLimit: 24_500,
  catchup: 8_000,
  catchupAge: 50,
  totalAdditions: 72_000,
} as const;

// ── IRS Uniform Lifetime Table (2022+) ───────────────────────────────────────
// RMD divisor by age: the required minimum distribution is the prior year-end
// pre-tax balance divided by this factor. Table covers the RMD ages through the
// projection horizon (100); below 72 there is no RMD (Infinity → zero draw).
const RMD_DIVISORS: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
  88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
};
function rmdDivisor(age: number): number {
  if (age < 72) return Infinity;
  return RMD_DIVISORS[age] ?? 6.4; // hold the oldest factor past 100
}

// ── Taxable portion of Social Security (IRS provisional-income worksheet) ─────
// Only 0–85% of benefits are federally taxable, graduated by "provisional income"
// (other income + ½ of benefits). The old model assumed a flat 85% inclusion,
// which over-taxed modest-income retirees. `otherOrdinary` is the household's
// other ordinary income (rental, withdrawals, wages, etc.).
function taxableSocialSecurity(
  ssGross: number,
  otherOrdinary: number,
  filing: 'single' | 'married_joint' | 'married_separate' | 'head_household',
): number {
  if (ssGross <= 0) return 0;
  const [base1, base2] = filing === 'married_joint' ? [32_000, 44_000] : [25_000, 34_000];
  const provisional = otherOrdinary + 0.5 * ssGross;
  if (provisional <= base1) return 0;
  if (provisional <= base2) return Math.min(0.5 * ssGross, 0.5 * (provisional - base1));
  const tier50 = Math.min(0.5 * ssGross, 0.5 * (base2 - base1));
  return Math.min(0.85 * ssGross, 0.85 * (provisional - base2) + tier50);
}

// ── Medicare IRMAA surcharge (2025 Part B + D, by MAGI from 2 years prior) ────
// High-income Medicare beneficiaries pay an income-related surcharge on top of
// the standard Part B premium. Tiers are (single MAGI, MFJ MAGI) → total monthly
// Part B + D IRMAA add-on above the ~$185 standard premium. Returns the monthly
// SURCHARGE per beneficiary (0 below the first threshold).
const IRMAA_TIERS: { single: number; joint: number; surcharge: number }[] = [
  { single: 106_000, joint: 212_000, surcharge: 0 },
  { single: 133_000, joint: 266_000, surcharge: 74 + 13 },
  { single: 167_000, joint: 334_000, surcharge: 185 + 34 },
  { single: 200_000, joint: 400_000, surcharge: 296 + 54 },
  { single: 500_000, joint: 750_000, surcharge: 407 + 74 },
  { single: Infinity, joint: Infinity, surcharge: 444 + 81 },
];
function irmaaMonthlySurcharge(
  magi: number,
  filing: 'single' | 'married_joint' | 'married_separate' | 'head_household',
): number {
  const joint = filing === 'married_joint';
  for (const t of IRMAA_TIERS) {
    if (magi <= (joint ? t.joint : t.single)) return t.surcharge;
  }
  return IRMAA_TIERS[IRMAA_TIERS.length - 1].surcharge;
}

// ── Main simulation ───────────────────────────────────────────────────────────

export const runSimulation = (
  snapshot: FinancialSnapshot,
  config: SimulationConfiguration,
  live_price_input: number,
  // Optional per-month REAL market return path (annual %), one entry per month.
  // When supplied (Monte Carlo), it overrides the deterministic real market
  // return for the diversified portfolio — liquid, 401k/IRA, Roth, 529, and the
  // broad-market brokerage holdings — modeling sequence-of-returns risk. The
  // concentrated employer position keeps its own growth assumption. Omit it for
  // the normal deterministic projection (behavior is then identical to before).
  marketReturnPath?: number[]
): TrajectoryPoint[] => {
  const points: TrajectoryPoint[] = [];

  // Concentrated-position price: the live quote if we have one, else the
  // last-known cached price on the snapshot, else a neutral default. Never 0 —
  // a $0 concentrated position would understate net worth and the FI date.
  const live_price = live_price_input > 0
    ? live_price_input
    : (snapshot.share_counts?.live_stock_price || 175.00);

  const ip = config.income_profile;
  const jumpGrossAnnual   = ip.jump_gross_annual   || 275_000;
  const bridgeGrossAnnual = ip.bridge_gross_annual || 220_000;
  const opt               = config.tax_optimization;

  const JUMP_EQUITY_GROWTH = 0.08;
  // Rental growth is market-specific, so it's user-configurable. Default 3%
  // (≈ long-run inflation) rather than a hard-coded high number, since rents
  // vary widely by metro. Stored as a NOMINAL percent; converted to a real
  // rate at the use site (the whole model runs in today's dollars).
  const RENTAL_GROWTH_PCT = ip.rental_income_growth_rate ?? 3;

  const startYear  = new Date().getFullYear();
  const startMonth = new Date().getMonth();

  // The wealth trajectory runs from today through age 100 so the chart's
  // "to 75 / to 100" horizon toggle has real data to show (and post-retirement
  // drawdown is visible). Independence (the FI target = 25× expenses) is a
  // point-in-time check that resolves at the same month regardless of how far
  // the horizon runs. A small floor keeps a usable window near/over 100.
  const END_AGE          = 100;
  const startAge         = startYear - (config.birth_year || 1980);
  const monthsToSimulate = Math.min(1000, Math.max(36, (END_AGE - startAge) * 12));

  // ── Initial balances ───────────────────────────────────────────────────────
  let liquidCash  = snapshot.liquid_assets.vanguard_bridge + snapshot.liquid_assets.cash_savings;
  // Split retirement into Roth (tax-free) vs traditional (taxable on withdrawal)
  let rothBalance  = snapshot.retirement_assets.roth_ira;
  let tradBalance  = snapshot.retirement_assets.k401 + snapshot.retirement_assets.traditional_ira;

  // The "concentrated position" (employer stock / RSUs) that gets its own growth
  // rate, vesting, and divestment treatment. Configurable per user; defaults to
  // none. Legacy data may carry GOOG holdings + share_counts.google_shares.
  // Equity comp is opt-in; when off, ignore the employer ticker so there's no
  // concentrated position, divestment, or RSU income.
  const equityEnabled = config.use_equity_comp === true;
  const concSym = equityEnabled ? (config.concentrated_symbol ?? '').toUpperCase() : '';
  const isConcentrated = (sym: string) => concSym !== '' && sym?.toUpperCase() === concSym;
  const googInvs          = (snapshot.other_investments ?? []).filter(i => isConcentrated(i.symbol));
  const googFromPortfolio = googInvs.reduce((s, i) => s + i.shares, 0);
  let currentGoogShares   = googFromPortfolio + (snapshot.share_counts.google_shares || 0);
  const currentGoogByBasis: { shares: number; basis: number }[] = [
    { shares: currentGoogShares, basis: snapshot.share_counts.cost_basis || 0 },
  ];

  let currentGoogPrice      = live_price;
  let currentJumpStockValue = 0;
  let current529 = (snapshot.education_assets.accounts || []).reduce((s, a) => s + a.balance, 0);
  let currentMortgage     = snapshot.liabilities.mortgage_balance;
  let currentConsumerDebt = snapshot.liabilities.consumer_debt;

  const mortgageRate       = snapshot.liabilities.mortgage_interest_rate || 3.5;
  const mortgagePayoffDate = snapshot.liabilities.mortgage_payoff_date
    ? new Date(snapshot.liabilities.mortgage_payoff_date)
    : new Date(2051, 5, 1);

  // Phase boundaries as calendar-month indices (year*12 + month0), so the exit —
  // and every downstream phase — is precise to the month, not just the year. This
  // lets you time your exit to, e.g., just after a March bonus/vest. exit_month
  // defaults to 0 (January), preserving the old start-of-year behavior.
  const exitMonth0 = Math.min(11, Math.max(0, Math.round(config.career_path.exit_month ?? 0)));
  const exitCal          = config.career_path.exit_year * 12 + exitMonth0;
  const sabbaticalEndCal = exitCal          + (config.career_path.use_sabbatical ? config.career_path.sabbatical_duration * 12 : 0);
  const jumpEndCal       = sabbaticalEndCal + (config.career_path.use_jump       ? config.career_path.jump_duration       * 12 : 0);
  const bridgeEndCal     = jumpEndCal       + (config.career_path.use_bridge     ? config.career_path.bridge_duration     * 12 : 0);

  const currentOtherInvestments = (snapshot.other_investments ?? [])
    .filter(i => !isConcentrated(i.symbol))
    .map(i => ({
      ...i,
      currentValue:   (i.shares * i.current_price) || 0,
      expectedReturn: i.expected_return ?? config.market_assumptions.market_return_rate,
    }));

  // IRS 401k limits (single source — see IRS_401K)
  const K401_LIMIT      = IRS_401K.employeeLimit;
  const CATCHUP_LIMIT   = IRS_401K.catchup;  // Age 50+
  const CATCHUP_AGE     = IRS_401K.catchupAge;
  // Federal mortgage acquisition debt deductibility cap (post-12/16/2017 loans)
  const FED_MORTGAGE_CAP = 750_000;
  // RMD start age (SECURE 2.0): 73 for those born 1951–1959, 75 for 1960+.
  const RMD_START_AGE = (config.birth_year ?? 1980) >= 1960 ? 75 : 73;

  // Convert an annual percentage rate (e.g. 7) to its TRUE monthly compounding
  // factor: (1 + r)^(1/12) − 1. Dividing the annual rate by 12 overstates the
  // effective annual yield (7%/12 monthly compounds to ~7.23%/yr).
  const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;

  // ── Everything below runs in REAL (today's-dollar) terms ──────────────────
  // The whole projection is expressed in today's purchasing power, so the
  // displayed figures are interpretable ("what would that be worth now?") and —
  // crucially — the fixed 2025 tax brackets/limits stay correct year over year
  // instead of causing phantom bracket-creep against nominally-inflating income.
  // `toReal` strips inflation out of a nominal growth rate via the Fisher
  // relation: (1 + nominal) / (1 + inflation) − 1.
  const inflationPct = config.market_assumptions.inflation_rate || 0;
  const toReal = (nominalPct: number) => ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;

  // Short month names for the "MMM YYYY" trajectory labels. Hand-rolled instead
  // of Date#toLocaleString, whose Intl formatting is ~an order of magnitude
  // slower and dominated the per-month cost (hundreds of runs under Monte Carlo).
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Running tally of realized taxable income (≈ MAGI) per calendar year. Used for
  // IRMAA, whose surcharge is set by MAGI from two years prior. Each January we
  // bank the year just completed and reset the accumulator.
  const magiByYear = new Map<number, number>();
  let magiThisYear = 0;

  const baseFiling = config.tax_assumptions.filing_status;
  const firstDeathAge = config.mortality?.first_death_age ?? 0;
  const survivorSpendFactor = config.mortality?.survivor_spending_factor ?? 0.75;

  // ── Main simulation loop (runs through age 100; see monthsToSimulate) ──────
  for (let month = 0; month < monthsToSimulate; month++) {

    const totalMonths = startMonth + month;
    const currentYear = startYear + Math.floor(totalMonths / 12);
    const monthOfYear = totalMonths % 12;

    // Bank the completed year's MAGI at each year boundary.
    if (monthOfYear === 0 && month > 0) {
      magiByYear.set(currentYear - 1, magiThisYear);
      magiThisYear = 0;
    }
    const currentDate = new Date(currentYear, monthOfYear, 1);
    const yearsPassed = month / 12;
    const currentAge  = currentYear - (config.birth_year || 1980);

    // Survivor transition: once a couple passes the modeled first-death age, the
    // household files single, keeps the larger SS benefit, and spends less.
    const survivorMode = baseFiling === 'married_joint' && firstDeathAge > 0 && currentAge >= firstDeathAge;
    const effectiveFiling = survivorMode ? 'single' : baseFiling;

    const effectiveMarketReturn = toReal(Math.max(0, config.market_assumptions.market_return_rate - config.market_assumptions.volatility_drag));
    // Kept for nominal contracts (the mortgage) and for deflating any nominal
    // future obligations back into today's dollars.
    const inflationMultiplier   = Math.pow(1 + config.market_assumptions.inflation_rate / 100, yearsPassed);

    // ── Asset growth — REAL geometric monthly compounding ─────────────────────
    // In Monte Carlo mode the sampled real return drives the whole diversified
    // portfolio (so a bad run is bad across all market assets at once); otherwise
    // each bucket grows at its own deterministic real rate.
    const sampledRealPct = marketReturnPath ? marketReturnPath[month] : undefined;
    const marketMo = monthlyRate(sampledRealPct ?? effectiveMarketReturn);
    // Taxable accounts lose ~a few tenths of a point a year to tax on dividends /
    // distributions (qualified divs + fund payouts), unlike sheltered 401k/IRA/
    // Roth/529. Apply that drag to the taxable buckets only.
    const taxableDrag = config.market_assumptions.taxable_dividend_drag ?? 0.4;
    const taxableMo = monthlyRate((sampledRealPct ?? effectiveMarketReturn) - taxableDrag);
    currentGoogPrice      *= (1 + monthlyRate(toReal(config.market_assumptions.goog_growth_rate)));
    currentJumpStockValue *= (1 + monthlyRate(toReal(JUMP_EQUITY_GROWTH * 100)));
    liquidCash   *= (1 + taxableMo);  // taxable brokerage / cash
    tradBalance  *= (1 + marketMo);
    rothBalance  *= (1 + marketMo);
    current529   *= (1 + monthlyRate(sampledRealPct ?? toReal(config.market_assumptions.market_return_rate)));

    let totalOtherInvestmentsValue = 0;
    for (const inv of currentOtherInvestments) {
      const invReal = (sampledRealPct ?? toReal(Math.max(0, inv.expectedReturn - config.market_assumptions.volatility_drag))) - taxableDrag;
      inv.currentValue *= (1 + monthlyRate(invReal));
      totalOtherInvestmentsValue += inv.currentValue;
    }

    // ── Phase determination ────────────────────────────────────────────────
    let phase: 'GOOGLE' | 'SABBATICAL' | 'JUMP' | 'BRIDGE' | 'RETIRED' = 'GOOGLE';
    // Real raise = nominal raise net of inflation, so a salary that just keeps
    // pace with inflation is flat in today's dollars.
    const realIncomeGrowth       = toReal(ip.income_growth_rate || 0) / 100;
    const salaryGrowthMultiplier = Math.pow(1 + realIncomeGrowth, yearsPassed);

    let annualBaseSalary  = 0;
    let annualTargetBonus = 0;

    const cal = currentYear * 12 + monthOfYear; // this month's calendar index
    if (cal < exitCal) {
      phase = 'GOOGLE';
      annualBaseSalary  = (ip.gross_annual_salary || 0) * salaryGrowthMultiplier;
      annualTargetBonus = annualBaseSalary * ((ip.target_bonus_rate || 0) / 100);
    } else if (cal < sabbaticalEndCal) {
      phase = 'SABBATICAL';
    } else if (cal < jumpEndCal) {
      phase = 'JUMP';
      annualBaseSalary  = jumpGrossAnnual * salaryGrowthMultiplier;
      annualTargetBonus = annualBaseSalary * ((ip.jump_bonus_rate || 0) / 100);
    } else if (cal < bridgeEndCal) {
      phase = 'BRIDGE';
      annualBaseSalary = bridgeGrossAnnual; // flat in real terms
    } else {
      phase = 'RETIRED';
    }

    // ── Partner income ─────────────────────────────────────────────────────
    const partnerStarts  = ip.partner_employment_start_year ?? currentYear;
    const partnerRetires = ip.partner_retirement_year ?? 2030;
    let annualPartnerGross = 0;
    if (ip.use_partner_income && ip.partner_gross_annual_salary &&
        currentYear >= partnerStarts && currentYear < partnerRetires) {
      annualPartnerGross = ip.partner_gross_annual_salary * salaryGrowthMultiplier;
    }

    // ── Rental income (FICA-exempt, ordinary income tax) ──────────────────
    const rentalIncome     = (ip.monthly_rental_income || 0)
      * Math.pow(1 + toReal(RENTAL_GROWTH_PCT) / 100, Math.floor(yearsPassed));
    const annualRentalGross = rentalIncome * 12;

    // ── Part-time work income (earned → W2/FICA, ordinary income tax) ──────
    // Supplemental earned income the user expects to keep regardless of phase
    // (e.g. consulting or part-time work in early retirement). Tracks raises.
    const annualParttimeGross = (ip.monthly_parttime_income || 0) * 12 * salaryGrowthMultiplier;

    // ── RSU vesting ────────────────────────────────────────────────────────
    let monthlyEquityVestUnits = 0;
    if (phase === 'GOOGLE' && equityEnabled) {
      const vy = ip.vesting_years || 4;
      // Initial (already-held) unvested grant — vests linearly from today.
      if (yearsPassed < vy) {
        monthlyEquityVestUnits += (ip.initial_unvested_shares || 0) / (vy * 12);
      }
      // Refresher grants land each MARCH and vest linearly over `vy` years. Sum
      // every March cohort still inside its vesting window; because vesting is
      // gated on the working phase, the accrued total is accurate right up to the
      // month you leave (no further vesting after exit).
      const grantValue = ip.annual_equity_grant || 0;
      if (grantValue > 0) {
        const MARCH = 2; // 0-indexed (monthOfYear === 2)
        for (let gy = currentYear; gy >= currentYear - vy; gy--) {
          const monthsSinceGrant = (currentYear - gy) * 12 + (monthOfYear - MARCH);
          if (monthsSinceGrant < 0 || monthsSinceGrant >= vy * 12) continue; // outside its vest window
          // Years from the sim start to this March grant (negative = granted before
          // the projection began — those cohorts are still mid-vest).
          const grantTimeYears   = yearsPassed - monthsSinceGrant / 12;
          const priceAtGrant     = Math.max(0.1, live_price * Math.pow(1 + toReal(config.market_assumptions.goog_growth_rate) / 100, grantTimeYears));
          const grantValueAtTime = grantValue * Math.pow(1 + realIncomeGrowth, grantTimeYears);
          monthlyEquityVestUnits += (grantValueAtTime / priceAtGrant) / (vy * 12);
        }
      }
    }
    const annualRSUValue = monthlyEquityVestUnits * 12 * currentGoogPrice;

    // Jump grant
    const jumpGrantMonthlyGross = (phase === 'JUMP')
      ? ip.jump_grant_monthly * salaryGrowthMultiplier : 0;
    const annualJumpGrantValue  = jumpGrantMonthlyGross * 12;

    // ── OPT #1: 401k pre-tax contributions ────────────────────────────────
    // Reduces income tax; does NOT reduce FICA base.
    // Catch-up contribution available at age 50.
    const working = phase === 'GOOGLE' || phase === 'JUMP' || phase === 'BRIDGE';
    const k401MaxAllowed = currentAge >= CATCHUP_AGE ? K401_LIMIT + CATCHUP_LIMIT : K401_LIMIT;
    const annualK401 = working
      ? Math.min(ip.annual_401k_contribution ?? K401_LIMIT, k401MaxAllowed, annualBaseSalary * 0.9)
      : 0;
    // Employer match — "{rate}% of {the first {limit}% of salary you contribute}",
    // added to the 401k on TOP of your deferral. A 0 limit means match ALL your
    // contributions (e.g. Google's 50%-of-everything). It isn't your money pre-tax,
    // so it never reduces taxable income; it's capped by the IRS combined (415(c))
    // limit: deferral + employer ≤ cap.
    const matchRate = Math.max(0, ip.employer_match_rate_pct ?? 0) / 100;
    const matchLimitPct = Math.max(0, ip.employer_match_limit_pct ?? 0);
    // The slice of your own deferral the match applies to (capped to `limit`% of
    // salary, or all of it when limit is 0).
    const matchedContribution = matchLimitPct > 0
      ? Math.min(annualK401, annualBaseSalary * matchLimitPct / 100)
      : annualK401;
    const totalAdditionsCap = (currentAge >= CATCHUP_AGE ? IRS_401K.totalAdditions + CATCHUP_LIMIT : IRS_401K.totalAdditions);
    const annualEmployerMatch = working
      ? Math.min(matchedContribution * matchRate, Math.max(0, totalAdditionsCap - annualK401))
      : 0;

    // ── OPT #2: Itemized deductions for mortgage interest ─────────────────
    // Federal: mortgage interest capped at $750k acquisition debt (post-2017 loans).
    // NY state: follows federal mortgage interest deduction.
    // SALT: capped at $10k federally (NY state: no cap for state deduction itself).
    const isRent = config.spending.housing_type === 'rent';
    const hasMortgageNow = !isRent && currentDate < mortgagePayoffDate && currentMortgage > 0;
    const deductibleMortgagePct = hasMortgageNow
      ? Math.min(1, FED_MORTGAGE_CAP / Math.max(1, currentMortgage))
      : 0;
    const annualMortgageInterest    = hasMortgageNow ? currentMortgage * (mortgageRate / 100) : 0;
    // The mortgage is a nominal contract; its interest is deflated into today's
    // dollars so it stacks correctly against the (real) income the tax engine sees.
    const deductibleInterestFed     = (annualMortgageInterest * deductibleMortgagePct) / inflationMultiplier;
    const saltCapFed                = 10_000;
    const userItemized              = config.tax_assumptions.itemized_deductions ?? 0;
    const totalItemizedFed          = deductibleInterestFed + saltCapFed + userItemized;
    // NY: same mortgage interest deduction; SALT adds back since state deduction is for state
    const totalItemizedNY           = deductibleInterestFed + userItemized;

    // W-4 deductions/allowances — each reduces taxable income (income tax only,
    // not FICA), modeled at the legacy per-allowance value.
    const W4_ALLOWANCE_VALUE = 4_300;
    const allowanceDeduction = (config.tax_assumptions.w4_allowances ?? 0) * W4_ALLOWANCE_VALUE;

    // ── Tax calculation ────────────────────────────────────────────────────
    // grossIncome = W2 (FICA base — full salary before 401k)
    // preTaxDeductions = 401k + W-4 allowances (reduce income tax but not FICA)
    const annualW2Gross = annualBaseSalary + annualTargetBonus + annualPartnerGross + annualParttimeGross + annualRSUValue + annualJumpGrantValue;

    const taxInput = {
      filingStatus:          effectiveFiling,
      state:                 config.tax_assumptions.state_of_residence,
      grossIncome:           annualW2Gross,
      preTaxDeductions:      annualK401 + allowanceDeduction,
      ficaExemptIncome:      annualRentalGross,
      itemizedDeductions:    totalItemizedFed,
      nyItemizedDeductions:  totalItemizedNY,
      longTermCapitalGains:  0,
      shortTermCapitalGains: 0,
    };
    const taxResult = calculateTaxRaw(taxInput);
    const ordinaryEffRate = taxResult.ordinaryEffectiveRate;

    // The marginal rate requires a second full tax pass, so only pay for it when
    // it actually drives a number — equity vesting / jump grants taxed at the
    // margin. Elsewhere it only feeds the deficit emergency rate, where the
    // effective rate is a fine proxy. (This halves the per-month tax cost in the
    // common case and matters under Monte Carlo's hundreds of runs.)
    // Also need the true marginal rate in the bonus month: a bonus is income on
    // TOP of salary, so it's taxed at the margin, not the household effective rate.
    const isBonusMonth     = (monthOfYear === 2); // paid in March (calendar), like RSU refreshers
    const needMarginal = monthlyEquityVestUnits > 0 || jumpGrantMonthlyGross > 0 || (isBonusMonth && annualTargetBonus > 0);
    const marginalRate = needMarginal
      ? (calculateTaxRaw({ ...taxInput, grossIncome: annualW2Gross + 100 }).totalTax - taxResult.totalTax) / 100
      : ordinaryEffRate;

    // ── Net cash flows ─────────────────────────────────────────────────────
    // Salary net = (salary minus 401k contribution) after tax; 401k goes to tradBalance
    const taxableSalary    = Math.max(0, annualBaseSalary - annualK401);
    const monthlySalaryNet = (taxableSalary / 12) * (1 - ordinaryEffRate);
    const monthlyBonusNet  = isBonusMonth ? annualTargetBonus * (1 - marginalRate) : 0;
    const monthlyPartnerNet = (annualPartnerGross / 12) * (1 - ordinaryEffRate);
    const monthlyRentalNet  = (annualRentalGross  / 12) * (1 - ordinaryEffRate);
    const monthlyParttimeNet = (annualParttimeGross / 12) * (1 - ordinaryEffRate);

    // Your deferral + the employer match both land in the traditional 401k each
    // month (only the deferral reduced taxable income, in the tax pass above).
    tradBalance += (annualK401 + annualEmployerMatch) / 12;

    // OPT #1 (Backdoor Roth IRA) — $7k/yr ($8k if 50+), funded from liquid cash in April
    // Non-deductible contribution → immediate conversion → no current-year tax
    const rothIRALimit    = currentAge >= CATCHUP_AGE ? 8_600 : 7_500; // IRA limit 2026 ($7.5k + $1.1k catch-up)
    const backdoorRothAmt = ip.annual_backdoor_roth ?? rothIRALimit;
    if (monthOfYear === 3 && (phase === 'GOOGLE' || phase === 'JUMP' || phase === 'BRIDGE')
        && liquidCash > backdoorRothAmt + 10_000) {
      liquidCash  -= backdoorRothAmt;
      rothBalance += backdoorRothAmt; // Now in Roth — grows tax-free
    }

    // RSU shares — added at marginal (not effective) rate, sell-to-cover approximation
    if (monthlyEquityVestUnits > 0) {
      const netNewShares = monthlyEquityVestUnits * (1 - marginalRate);
      currentGoogShares += netNewShares;
      currentGoogByBasis.push({ shares: netNewShares, basis: currentGoogPrice });
    }

    if (jumpGrantMonthlyGross > 0) {
      currentJumpStockValue += jumpGrantMonthlyGross * (1 - marginalRate);
    }

    const monthlyOrdinaryNet = monthlySalaryNet + monthlyBonusNet + monthlyPartnerNet + monthlyRentalNet + monthlyParttimeNet;

    // ── OPT #3: Roth conversion during sabbatical ─────────────────────────
    // Strategy: during sabbatical (low income), convert from traditional 401k to Roth
    // up to the target bracket. Paying ~22-32% combined now vs ~50% at full Google income later.
    let rothConversionTaxPaid = 0;
    if (phase === 'SABBATICAL' && (opt?.enable_roth_conversion ?? true) && tradBalance > 1_000) {
      // Current ordinary taxable income (rental after std deduction)
      const currentTaxableOrdinary = Math.max(0, annualRentalGross - 30_000);
      const targetBracketCeiling   = opt?.roth_conversion_target_bracket ?? 206_700; // 22% bracket top for MFJ
      const annualConversionRoom   = Math.max(0, targetBracketCeiling - currentTaxableOrdinary);

      if (annualConversionRoom > 1_000) {
        // Convert up to 80% of available room (leave some buffer for income fluctuations)
        const monthlyConversion = Math.min(annualConversionRoom * 0.8 / 12, tradBalance * 0.02);

        if (monthlyConversion > 100) {
          // Tax: treat conversion as additional ordinary income stacked on rental
          const baseConvTax = calculateTaxRaw({
            filingStatus: effectiveFiling,
            state: config.tax_assumptions.state_of_residence,
            grossIncome: 0,
            ficaExemptIncome: annualRentalGross,
            itemizedDeductions: totalItemizedFed,
            nyItemizedDeductions: totalItemizedNY,
            longTermCapitalGains: 0, shortTermCapitalGains: 0,
          });
          const withConvTax = calculateTaxRaw({
            filingStatus: effectiveFiling,
            state: config.tax_assumptions.state_of_residence,
            grossIncome: 0,
            ficaExemptIncome: annualRentalGross + monthlyConversion * 12,
            itemizedDeductions: totalItemizedFed,
            nyItemizedDeductions: totalItemizedNY,
            longTermCapitalGains: 0, shortTermCapitalGains: 0,
          });
          const monthlyTaxOnConversion = (withConvTax.totalTax - baseConvTax.totalTax) / 12;

          if (liquidCash > monthlyTaxOnConversion + 5_000) {
            tradBalance -= monthlyConversion;
            rothBalance += monthlyConversion; // Moved from traditional → Roth
            liquidCash  -= monthlyTaxOnConversion; // Tax paid from cash NOW
            rothConversionTaxPaid = monthlyTaxOnConversion;
          }
        }
      }
    }

    // ── Expenses ───────────────────────────────────────────────────────────
    // Empty-nest phase only applies when there are children (it models the spend
    // drop after kids leave home) and the user hasn't turned it off.
    const hasChildren   = (config.children?.length ?? 0) > 0;
    const useEmptyNest  = hasChildren && config.spending.use_empty_nest !== false;
    const emptyNestYear = config.spending.empty_nest_year ?? 3_000;
    // When linked (default), empty-nest spend is 15% below the monthly lifestyle
    // spend; otherwise it uses the user's unlinked custom amount.
    const emptyNestSpend = config.spending.empty_nest_linked !== false
      ? config.spending.monthly_lifestyle * 0.85
      : (config.spending.empty_nest_monthly_spend ?? config.spending.monthly_lifestyle * 0.85);
    const baseMonthlySpend = ((useEmptyNest && currentYear >= emptyNestYear && emptyNestSpend)
      ? emptyNestSpend
      : config.spending.monthly_lifestyle)
      * (survivorMode ? survivorSpendFactor : 1); // a survivor household spends less

    let expense = baseMonthlySpend; // already in today's dollars (real model)

    // Social Security — up to 85% of benefits are federally taxable; NY exempts
    // SS entirely (so we compute federal-only by passing state 'NONE'). The
    // taxable portion stacks on top of other ordinary income (rental).
    let socialSecurityIncome = 0;
    let taxableSSForMagi = 0;
    if (config.social_security) {
      const claimAge = config.social_security.start_age;

      // Primary: linked (default) → estimate from income; else manual amount.
      // Years worked (assuming a career start at ~22) scales the benefit down for
      // early retirees, whose 35-year earnings average includes zero years.
      const primaryYearsWorked = config.career_path.exit_year - ((config.birth_year ?? 1980) + 22);
      // The primary's PIA (100%-of-FRA benefit) — also the basis for the partner's
      // spousal benefit, so compute it whether or not the primary has claimed yet.
      const primaryPIA = config.social_security.social_security_linked !== false
        ? estimatePIA(ip.gross_annual_salary, primaryYearsWorked)
        : config.social_security.monthly_amount / claimingFactor(claimAge);
      let primaryBenefit = 0;
      if (currentAge >= claimAge) {
        primaryBenefit = config.social_security.social_security_linked !== false
          ? estimateMonthlySocialSecurity(ip.gross_annual_salary, claimAge, primaryYearsWorked)
          : config.social_security.monthly_amount;
      }

      // Partner: claims at the SS start age. A spouse always receives the GREATER
      // of their own benefit or a spousal benefit (up to 50% of the primary's
      // PIA) — so a partner with little or no earnings record still draws Social
      // Security on the primary's record. If no partner birth year is set, assume
      // the partner is the same age as the primary (matches the healthcare model).
      let partnerBenefit = 0;
      if (ip.use_partner_income) {
        const partnerAge = ip.partner_birth_year ? currentYear - ip.partner_birth_year : currentAge;
        if (partnerAge >= claimAge) {
          if (config.social_security.partner_ss_linked !== false) {
            const partnerOwn = estimateMonthlySocialSecurity(ip.partner_gross_annual_salary || 0, claimAge);
            const spousal = estimateSpousalBenefit(primaryPIA, claimAge);
            partnerBenefit = Math.max(partnerOwn, spousal);
          } else {
            partnerBenefit = config.social_security.partner_monthly_amount || 0;
          }
        }
      }

      // After a death the survivor keeps the LARGER of the two benefits; while
      // both are alive the household collects both.
      const ssMonthly = survivorMode
        ? Math.max(primaryBenefit, partnerBenefit)
        : primaryBenefit + partnerBenefit;

      if (ssMonthly > 0) {
      const grossSSAnnual = ssMonthly * 12; // SS is inflation-indexed → flat in real terms
      // Graduated taxable portion (0–85%) by provisional income, not a flat 85%.
      const taxableSSAnnual = taxableSocialSecurity(grossSSAnnual, annualRentalGross + annualW2Gross, effectiveFiling);
      taxableSSForMagi = taxableSSAnnual;

      const ssBaseTax = calculateTaxRaw({
        filingStatus: effectiveFiling, state: "NONE",
        grossIncome: 0, ficaExemptIncome: annualRentalGross,
        longTermCapitalGains: 0, shortTermCapitalGains: 0,
      });
      const ssWithTax = calculateTaxRaw({
        filingStatus: effectiveFiling, state: "NONE",
        grossIncome: 0, ficaExemptIncome: annualRentalGross + taxableSSAnnual,
        longTermCapitalGains: 0, shortTermCapitalGains: 0,
      });
      const ssFedTaxAnnual = Math.max(0, ssWithTax.federalIncomeTax - ssBaseTax.federalIncomeTax);

      socialSecurityIncome = (grossSSAnnual - ssFedTaxAnnual) / 12; // net monthly
      liquidCash += socialSecurityIncome;
      }
    }

    // Dividends & interest on taxable balances — recurring investment income that
    // counts toward MAGI every year, even when no assets are sold. Taxable buckets
    // only (401k/IRA/Roth/529 are sheltered): brokerage/cash, other holdings, and
    // any concentrated employer/jump stock.
    const taxableInvestBalance = Math.max(0, liquidCash) + totalOtherInvestmentsValue
      + Math.max(0, currentGoogShares * currentGoogPrice) + currentJumpStockValue;
    const taxableDivMonthly = (taxableInvestBalance * TAXABLE_DIVIDEND_YIELD) / 12;

    // Accumulate this month's recurring taxable income toward the year's MAGI
    // (wages net of 401k, rental, the taxable portion of Social Security, and
    // dividends/interest on taxable accounts). Lumpy items — RMDs, realized
    // capital gains — are added at their own sites.
    magiThisYear += Math.max(0, annualW2Gross - annualK401) / 12 + annualRentalGross / 12
      + taxableSSForMagi / 12 + taxableDivMonthly;

    // Healthcare
    const partnerIsWorking = ip.use_partner_income && ip.partner_has_health_insurance &&
      currentYear >= partnerStarts && currentYear < partnerRetires;
    const bridgeCovered = (phase === 'BRIDGE') && !!ip.bridge_has_health_insurance;
    // A jump (encore career) supplies coverage by default; users can flag a gig
    // or self-employment that doesn't, so self-paid/ACA healthcare kicks in.
    const jumpCovered = (phase === 'JUMP') && (ip.jump_has_health_insurance ?? true);
    const hasEmployerCoverage = phase === 'GOOGLE' || jumpCovered || partnerIsWorking || bridgeCovered;

    const adults = effectiveFiling === 'married_joint' ? 2 : 1;

    // Self-paid healthcare cost — what the household WOULD pay without employer
    // coverage. Computed every year (even while employed) because the FI target
    // must reflect the retirement reality of buying your own coverage.
    // Per-adult Medicare: each adult moves to Medicare pricing at their own 65,
    // so a younger partner stays on private/ACA coverage until they're eligible.
    // (If no partner birth year is set, the partner is assumed the same age.)
    const medAge        = config.medicare?.start_age ?? 65;
    const hasPartner    = adults === 2;
    const partnerAge    = hasPartner ? (ip.partner_birth_year ? currentYear - ip.partner_birth_year : currentAge) : null;
    const primaryOnMed  = !!config.medicare && currentAge >= medAge;
    const partnerOnMed  = !!config.medicare && partnerAge != null && partnerAge >= medAge;
    const adultsOnMed   = (primaryOnMed ? 1 : 0) + (partnerOnMed ? 1 : 0);

    // Household size for healthcare premiums AND the ACA Federal-Poverty-Line
    // subsidy test — derived from the ACTUAL household (each adult + each child
    // still on the family plan). This tapers automatically as kids age out, and
    // avoids relying on a static `aca_family_size` config value (which defaulted
    // to 1, understating FPL thresholds and over-counting per-capita premiums).
    const coveredKids   = (config.children ?? []).filter(
      c => currentYear - c.birthYear < CHILD_OFF_PLAN_AGE
    ).length;
    const householdSize = Math.max(1, adults + coveredKids);

    // Healthcare (and long-term care) historically rise faster than general
    // inflation. The model runs in real dollars, so apply this REAL premium on
    // top: a ~2%/yr real escalation compounded over a long retirement.
    const medInflMult = Math.pow(1 + (config.market_assumptions.healthcare_inflation_premium ?? 2) / 100, yearsPassed);

    // IRMAA: Medicare beneficiaries with high income pay a surcharge set by their
    // MAGI from two years prior. Fall back to a current-year estimate before two
    // years of history exist (e.g. someone already 65+ at the start of the plan).
    const irmaaMagi = magiByYear.get(currentYear - 2)
      ?? (Math.max(0, annualW2Gross - annualK401) + annualRentalGross + taxableSSForMagi + taxableDivMonthly * 12);
    const irmaaSurcharge = adultsOnMed > 0
      ? irmaaMonthlySurcharge(irmaaMagi, effectiveFiling)
      : 0;

    let selfPaidHealthcare: number;
    {
      const medCost        = ((config.medicare?.monthly_premium ?? 0) + irmaaSurcharge) * adultsOnMed;
      const perCapita      = config.spending.healthcare_premium / householdSize;
      const preMedAdults   = adults - adultsOnMed;
      selfPaidHealthcare = (medCost + perCapita * (preMedAdults + coveredKids)) * medInflMult;
    }

    // Actual out-of-pocket healthcare expense this month (0 while employer-covered).
    let currentHealthcareCost = 0;
    if (!hasEmployerCoverage) {
      currentHealthcareCost = selfPaidHealthcare;

      // ACA premium subsidy. Applies during any pre-Medicare window where the
      // household buys its own coverage — the sabbatical AND early retirement —
      // capping the premium at the applicable % of MAGI. Driven by the household's
      // actual MAGI (prior completed year), so a retiree who keeps income low
      // (living off cash/Roth/basis) qualifies for large subsidies, while one
      // with rental + investment income that clears 400% FPL gets NOTHING (the
      // post-2025 subsidy cliff) and pays the full unsubsidized premium.
      const acaWindow = (phase === 'SABBATICAL' || phase === 'RETIRED') && !primaryOnMed;
      if (acaWindow && (opt?.enable_aca_optimization ?? true)) {
        const fpl            = getFPL(householdSize);
        const magiForACA     = magiByYear.get(currentYear - 1)
          ?? (annualRentalGross + taxableSSForMagi + Math.max(0, annualW2Gross - annualK401) + taxableDivMonthly * 12);
        const pct            = acaApplicablePct(magiForACA / fpl);
        // pct === null → above 400% FPL → no premium tax credit → full premium.
        if (pct !== null) {
          const maxMonthly = (magiForACA * pct) / 12;
          currentHealthcareCost = Math.min(currentHealthcareCost, maxMonthly);
        }
        // Realistic out-of-pocket floor. A big premium subsidy can drive the
        // *premium* toward zero in low-MAGI years, but real health spending never
        // vanishes — you still pay deductibles, copays, dental/vision, and your
        // share of the premium. Floor the pre-65 cost at a fraction of the full
        // unsubsidized premium so the band doesn't collapse to ~$0.
        currentHealthcareCost = Math.max(currentHealthcareCost, selfPaidHealthcare * ACA_OUT_OF_POCKET_FLOOR);
      }

      expense += currentHealthcareCost;
    }

    // Long-term care — an optional, finite late-life cost (nursing/assisted care),
    // one of the largest retirement tail risks. Off unless a cost is set. Like
    // healthcare it escalates with the real medical premium. Folded into the
    // healthcare figure so it shows in that band, and added to spending.
    const ltcAnnual = config.spending.ltc_annual_cost ?? 0;
    if (ltcAnnual > 0) {
      const ltcStart = config.spending.ltc_start_age ?? 80;
      const ltcYears = config.spending.ltc_years ?? 3;
      if (currentAge >= ltcStart && currentAge < ltcStart + ltcYears) {
        const ltcMonthly = (ltcAnnual / 12) * medInflMult;
        expense += ltcMonthly;
        currentHealthcareCost += ltcMonthly;
      }
    }

    // Housing — rent vs. mortgage behave very differently.
    //  • Rent is a PERPETUAL real expense (it rises with inflation), so it's added
    //    in today's-dollar terms every month, forever, with no balance to amortize.
    //  • A mortgage is a finite, nominal-fixed debt: the payment is due only while a
    //    balance remains (and before the payoff date), shrinks in real terms as
    //    inflation erodes it, and stops once amortization clears the loan.
    const hasMortgage = !isRent && currentDate < mortgagePayoffDate && currentMortgage > 0;
    if (isRent) {
      expense += config.spending.mortgage_payment; // real, never ends
    } else if (hasMortgage) {
      expense += config.spending.mortgage_payment / inflationMultiplier;
      if (currentMortgage > 0) {
        const mRate = (mortgageRate / 100) / 12;
        const interest  = currentMortgage * mRate;
        const principal = config.spending.mortgage_payment - interest;
        if (principal > 0) currentMortgage -= principal;
        if (currentMortgage < 0) currentMortgage = 0;
      }
    }

    // Life events — each event pays in January of its year
    if (config.life_events) {
      for (const event of config.life_events) {
        if (event.year === currentYear && monthOfYear === 0) {
          // event.cost is entered in today's dollars → used as-is in the real model.
          const eventCost = event.cost;
          if (event.name.toLowerCase().includes('college')) {
            if (current529 >= eventCost) {
              current529 -= eventCost;
            } else {
              expense += eventCost - current529;
              current529 = 0;
            }
          } else {
            expense += eventCost;
          }
        }
      }
    }

    // Capital calls
    if (snapshot.liabilities.upcoming_capital_calls > 0 && snapshot.liabilities.capital_calls_due_date) {
      const due = new Date(snapshot.liabilities.capital_calls_due_date);
      if (currentDate.getFullYear() === due.getFullYear() && currentDate.getMonth() === due.getMonth()) {
        // A known future nominal obligation → deflate into today's dollars.
        expense += snapshot.liabilities.upcoming_capital_calls / inflationMultiplier;
      }
    }

    // ── Divestment ─────────────────────────────────────────────────────────
    let divestmentProceeds = 0;

    if (config.divestment_strategy.type === 'progressive') {
      const totalWindowMonths = (config.divestment_strategy.end_year - config.divestment_strategy.start_year) * 12;
      const monthsElapsed     = (currentYear - config.divestment_strategy.start_year) * 12 + monthOfYear;

      if (monthsElapsed >= 0 && monthsElapsed < totalWindowMonths && currentGoogShares > 0) {
        const remainingMonths = totalWindowMonths - monthsElapsed;
        const sharesToSell    = currentGoogShares / remainingMonths;
        const grossSale       = sharesToSell * currentGoogPrice;

        const totalBasis = currentGoogByBasis.reduce((a, b) => a + b.shares * b.basis, 0);
        const totalSh    = currentGoogByBasis.reduce((a, b) => a + b.shares, 0);
        const avgBasis   = totalSh > 0 ? totalBasis / totalSh : 0;
        const capGain    = Math.max(0, grossSale - sharesToSell * avgBasis);
        const annualLTCG = capGain * 12;

        const annualOrd  = annualW2Gross + annualRentalGross;
        const baseTax    = calculateTaxRaw({ filingStatus: effectiveFiling, state: config.tax_assumptions.state_of_residence, grossIncome: annualW2Gross, preTaxDeductions: annualK401, ficaExemptIncome: annualRentalGross, itemizedDeductions: totalItemizedFed, nyItemizedDeductions: totalItemizedNY, longTermCapitalGains: 0, shortTermCapitalGains: 0 });
        const withSaleTax = calculateTaxRaw({ filingStatus: effectiveFiling, state: config.tax_assumptions.state_of_residence, grossIncome: annualW2Gross, preTaxDeductions: annualK401, ficaExemptIncome: annualRentalGross, itemizedDeductions: totalItemizedFed, nyItemizedDeductions: totalItemizedNY, longTermCapitalGains: annualLTCG, shortTermCapitalGains: 0 });

        divestmentProceeds = grossSale - (withSaleTax.totalTax - baseTax.totalTax) / 12;
        magiThisYear += capGain; // realized LTCG counts toward MAGI
        currentGoogShares -= sharesToSell;
      }

    } else if (config.divestment_strategy.type === 'immediate') {
      if (currentYear === config.career_path.exit_year && monthOfYear === 0 && currentGoogShares > 0) {
        const grossProceeds = currentGoogShares * currentGoogPrice;
        const totalBasis    = currentGoogByBasis.reduce((a, b) => a + b.shares * b.basis, 0);
        const totalSh       = currentGoogByBasis.reduce((a, b) => a + b.shares, 0);
        const avgBasis      = totalSh > 0 ? totalBasis / totalSh : 0;
        const gain          = Math.max(0, grossProceeds - currentGoogShares * avgBasis);

        const baseTax     = calculateTaxRaw({ filingStatus: effectiveFiling, state: config.tax_assumptions.state_of_residence, grossIncome: annualW2Gross, preTaxDeductions: annualK401, ficaExemptIncome: annualRentalGross, itemizedDeductions: totalItemizedFed, nyItemizedDeductions: totalItemizedNY, longTermCapitalGains: 0,    shortTermCapitalGains: 0 });
        const withSaleTax = calculateTaxRaw({ filingStatus: effectiveFiling, state: config.tax_assumptions.state_of_residence, grossIncome: annualW2Gross, preTaxDeductions: annualK401, ficaExemptIncome: annualRentalGross, itemizedDeductions: totalItemizedFed, nyItemizedDeductions: totalItemizedNY, longTermCapitalGains: gain, shortTermCapitalGains: 0 });

        divestmentProceeds = grossProceeds - (withSaleTax.totalTax - baseTax.totalTax);
        magiThisYear += gain; // realized LTCG counts toward MAGI
        currentGoogShares  = 0;
      }
    }

    liquidCash += divestmentProceeds;

    // ── Required Minimum Distributions (SECURE 2.0) ──────────────────────────
    // Past the RMD age the IRS forces an annual withdrawal from pre-tax balances
    // (Uniform Lifetime Table), taxed as ordinary income. The after-tax proceeds
    // move to cash. This both realizes the deferred tax the FI haircut anticipates
    // and can push a late-retirement household's income up — the model previously
    // let traditional balances compound untouched forever.
    if (monthOfYear === 0 && currentAge >= RMD_START_AGE && tradBalance > 0) {
      const rmdGross = tradBalance / rmdDivisor(currentAge);
      const rmdTaxInput = {
        filingStatus:         effectiveFiling,
        state:                config.tax_assumptions.state_of_residence,
        grossIncome:          annualW2Gross,
        preTaxDeductions:     annualK401,
        ficaExemptIncome:     annualRentalGross,
        itemizedDeductions:   totalItemizedFed,
        nyItemizedDeductions: totalItemizedNY,
        longTermCapitalGains: 0,
        shortTermCapitalGains: 0,
      };
      const baseOrdTax = calculateTaxRaw(rmdTaxInput).totalTax;
      const withRmdTax = calculateTaxRaw({ ...rmdTaxInput, ficaExemptIncome: annualRentalGross + rmdGross }).totalTax;
      const rmdTax = Math.max(0, withRmdTax - baseOrdTax);
      tradBalance -= rmdGross;
      liquidCash  += rmdGross - rmdTax;
      magiThisYear += rmdGross; // RMDs are fully taxable ordinary income → MAGI
    }

    // ── Net flow ───────────────────────────────────────────────────────────
    liquidCash += monthlyOrdinaryNet - expense;

    // Consumer debt paydown when flush
    if (liquidCash > 50_000 && currentConsumerDebt > 0) {
      const paydown = Math.min(liquidCash - 50_000, currentConsumerDebt);
      currentConsumerDebt -= paydown;
      liquidCash -= paydown;
    }

    // ── Deficit handling — tax-aware withdrawal waterfall ───────────────────
    // When monthly cash flow goes negative, raise the shortfall by liquidating
    // assets in a tax-efficient order:
    //   1. Taxable accounts (concentrated stock, diversified brokerage, jump
    //      equity) — only the embedded gain is taxed.
    //   2. Traditional / pre-tax — fully taxed as ordinary income.
    //   3. Roth LAST — tax-free and RMD-free, so it's preserved to compound.
    // Each bucket is drained only as far as the remaining deficit requires, and
    // no bucket is allowed to go negative (the old code drove the 401k negative
    // to absorb shortfalls, and never tapped the diversified brokerage at all).
    if (liquidCash < 0) {
      let deficit = Math.abs(liquidCash);
      liquidCash = 0;
      const emergencyTaxRate = Math.min(0.55, marginalRate + 0.05);

      // 1a. Concentrated employer position (average-basis LTCG).
      if (deficit > 0 && currentGoogShares > 0) {
        const totalBasis = currentGoogByBasis.reduce((a, b) => a + b.shares * b.basis, 0);
        const totalSh    = currentGoogByBasis.reduce((a, b) => a + b.shares, 0);
        const avgBasis   = totalSh > 0 ? totalBasis / totalSh : 0;
        const netPerShare = currentGoogPrice - emergencyTaxRate * Math.max(0, currentGoogPrice - avgBasis);
        const proceeds = currentGoogShares * Math.max(0, netPerShare);
        const gainPerShare = Math.max(0, currentGoogPrice - avgBasis);
        if (proceeds >= deficit) {
          const sold = deficit / Math.max(0.01, netPerShare);
          currentGoogShares -= sold;
          magiThisYear += sold * gainPerShare;
          deficit = 0;
        } else {
          magiThisYear += currentGoogShares * gainPerShare;
          deficit -= proceeds;
          currentGoogShares = 0;
        }
      }

      // 1b. Diversified taxable holdings — tax only the proportional gain.
      for (const inv of currentOtherInvestments) {
        if (deficit <= 0) break;
        if (inv.currentValue <= 0) continue;
        const basisTotal   = (inv.shares * inv.cost_basis) || 0;
        const gainFraction = Math.max(0, (inv.currentValue - basisTotal) / inv.currentValue);
        const netPerDollar = Math.max(0.01, 1 - emergencyTaxRate * gainFraction);
        const grossNeeded  = deficit / netPerDollar;
        if (grossNeeded >= inv.currentValue) {
          deficit -= inv.currentValue * netPerDollar;
          magiThisYear += inv.currentValue * gainFraction;
          inv.shares = 0;
          inv.currentValue = 0;
        } else {
          const frac = grossNeeded / inv.currentValue;
          inv.shares *= (1 - frac);
          inv.currentValue -= grossNeeded;
          magiThisYear += grossNeeded * gainFraction;
          deficit = 0;
        }
      }

      // 1c. Jump-company equity (taxable; ~25% haircut on the draw).
      if (deficit > 0 && currentJumpStockValue > 0) {
        const proceeds = currentJumpStockValue * 0.75;
        if (proceeds >= deficit) {
          const drawn = deficit / 0.75;
          currentJumpStockValue -= drawn;
          magiThisYear += drawn; // basis untracked → treat the draw as gain
          deficit = 0;
        } else {
          magiThisYear += currentJumpStockValue;
          deficit -= proceeds;
          currentJumpStockValue = 0;
        }
      }

      // 2. Traditional / pre-tax (ordinary income; ~30% effective).
      if (deficit > 0 && tradBalance > 0) {
        const grossNeeded = deficit / 0.70;
        if (grossNeeded >= tradBalance) {
          deficit -= tradBalance * 0.70;
          magiThisYear += tradBalance; // pre-tax withdrawal is ordinary income
          tradBalance = 0;
        } else {
          tradBalance -= grossNeeded;
          magiThisYear += grossNeeded;
          deficit = 0;
        }
      }

      // 3. Roth LAST (tax-free).
      if (deficit > 0 && rothBalance > 0) {
        if (rothBalance >= deficit) {
          rothBalance -= deficit;
          deficit = 0;
        } else {
          deficit -= rothBalance;
          rothBalance = 0;
        }
      }
      // Any residual deficit means assets are exhausted — a true plan shortfall.
      // Leave liquidCash at 0 rather than fabricating negative balances.
    }

    // The brokerage may have been partially liquidated above; refresh its total
    // so net worth / investable assets reflect the withdrawals.
    totalOtherInvestmentsValue = currentOtherInvestments.reduce((s, i) => s + i.currentValue, 0);

    // ── Derived values ────────────────────────────────────────────────────
    const totalRetirement  = tradBalance + rothBalance;
    const currentGoogValue = Math.max(0, currentGoogShares * currentGoogPrice);
    // Deflate the (nominal) mortgage balance for display so liabilities read in
    // the same today's-dollar terms as the rest of the trajectory.
    const totalLiabilities = currentMortgage / inflationMultiplier + currentConsumerDebt;

    // Net worth excludes the mortgage: the offsetting primary-residence asset
    // isn't tracked in the model, so subtracting the mortgage alone would
    // understate net worth (drag it to ~$0). Consumer debt (no backing asset)
    // is still netted out.
    const totalNetWorth = liquidCash + totalRetirement + currentGoogValue
      + currentJumpStockValue + totalOtherInvestmentsValue + current529
      - currentConsumerDebt;

    const investableAssets = liquidCash + totalRetirement + currentGoogValue
      + currentJumpStockValue + totalOtherInvestmentsValue;

    // ── FI target — the classic "Rule of 25" (4% Safe Withdrawal Rate) ────────
    // FI Number = (Annual Expenses − Guaranteed/Passive Income) ÷ SWR + mortgage payoff.
    // Recurring expenses use normalized retirement spending (lifestyle + healthcare).
    // The mortgage is finite, so rather than capitalizing the payment at 25× we add
    // the *remaining balance* — the lump you'd need to clear the house — to the
    // target. As the balance amortizes to $0 the add-on shrinks to nothing, and the
    // monthly payment correctly drops out of expenses once it's paid off. Passive
    // income (rental + Social Security, net of tax) is subtracted because it
    // permanently offsets expenses, lowering the nest egg you need.
    const SWR = 0.04; // 4% safe withdrawal rate (Rule of 25 → ×25); inherently a
                      // REAL rule, so applying it to the real need below is exact.
    // Everything is already in today's dollars. Use SELF-PAID healthcare (not the
    // employer-covered $0) so the target reflects what retirement actually costs —
    // otherwise FI triggers years early.
    // Rent is perpetual, so it's a recurring expense (capitalized at 25× via the
    // SWR below). A mortgage is finite, so its payment stays OUT of recurring
    // expenses and instead its remaining balance is added as a lump to pay off.
    const monthlyRentExpense  = isRent ? config.spending.mortgage_payment : 0;
    const annualExpenses      = (baseMonthlySpend + selfPaidHealthcare + monthlyRentExpense) * 12;
    // Passive income is netted at a RETIREMENT tax rate for the target — rental
    // taxed as the household's own ordinary income (no salary stacked on top).
    // Using the current-year rate would tax rental at a high working marginal rate
    // while employed, inflating the FI number by hundreds of thousands and making
    // it impossible to register FI until the moment you actually quit (so the FI
    // date would just snap to your exit). The FI number should describe retirement.
    const retirementRentalTax = annualRentalGross > 0
      ? calculateTaxRaw({
          filingStatus: effectiveFiling, state: config.tax_assumptions.state_of_residence,
          grossIncome: 0, preTaxDeductions: 0, ficaExemptIncome: annualRentalGross,
          itemizedDeductions: 0, nyItemizedDeductions: 0, longTermCapitalGains: 0, shortTermCapitalGains: 0,
        }).totalTax
      : 0;
    const retirementRentalNet = (annualRentalGross - retirementRentalTax) / 12;
    const annualPassiveIncome = (retirementRentalNet + socialSecurityIncome) * 12; // rental (retirement-rate) + SS, net
    const netAnnualNeed       = Math.max(0, annualExpenses - annualPassiveIncome);
    const mortgagePayoff      = hasMortgage ? currentMortgage / inflationMultiplier : 0; // today's $
    const swrTargetValue      = netAnnualNeed / SWR + mortgagePayoff; // FI Number incl. rent (×25) or mortgage payoff

    // ── After-tax "spendable" assets ─────────────────────────────────────────
    // $1 in a pre-tax 401k/IRA, or sitting on a large unrealized capital gain,
    // is NOT $1 of spending power. Haircut tax-deferred balances by the ordinary
    // rate a retiree would pay drawing them, and taxable holdings by the LTCG
    // owed on their embedded gains. The FI test then compares spendable assets
    // against the (post-tax) spending need — apples to apples. The old test used
    // gross balances and triggered FI years early for pre-tax-heavy savers.
    const RETIRE_LTCG_RATE = 0.15; // federal long-term capital-gains midpoint
    const deferredTaxRate = calculateTaxRaw({
      filingStatus:     effectiveFiling,
      state:            config.tax_assumptions.state_of_residence,
      grossIncome:      0,
      ficaExemptIncome: netAnnualNeed, // ordinary withdrawal, no FICA
      longTermCapitalGains: 0, shortTermCapitalGains: 0,
    }).ordinaryEffectiveRate;

    const googBasisTot = currentGoogByBasis.reduce((a, b) => a + b.shares * b.basis, 0);
    const googShTot    = currentGoogByBasis.reduce((a, b) => a + b.shares, 0);
    const googAvgBasis = googShTot > 0 ? googBasisTot / googShTot : 0;
    const googGain     = Math.max(0, currentGoogValue - currentGoogShares * googAvgBasis);
    const otherGain    = currentOtherInvestments.reduce((s, i) => s + Math.max(0, i.currentValue - i.shares * i.cost_basis), 0);
    const jumpGain     = currentJumpStockValue; // basis untracked → treat as fully appreciated (conservative)
    const embeddedGainTax = (googGain + otherGain + jumpGain) * RETIRE_LTCG_RATE;

    const investableAfterTax = Math.max(0,
      liquidCash + rothBalance
      + tradBalance * (1 - deferredTaxRate)
      + currentGoogValue + currentJumpStockValue + totalOtherInvestmentsValue
      - embeddedGainTax);

    // Independent once SPENDABLE assets cover the FI Number (or passive income
    // alone already covers expenses → need is zero).
    const isIndependent = investableAfterTax >= swrTargetValue;

    // ── Chart fields ──────────────────────────────────────────────────────
    const equityPart    = monthlyEquityVestUnits > 0 ? monthlyEquityVestUnits * (1 - marginalRate) * currentGoogPrice : 0;
    const jumpStockPart = jumpGrantMonthlyGross  > 0 ? jumpGrantMonthlyGross  * (1 - marginalRate) : 0;

    const salaryAndEquityNet = (monthlySalaryNet + monthlyBonusNet + monthlyPartnerNet + monthlyParttimeNet + equityPart + jumpStockPart) * 12;
    const rentalIncomeNet    = monthlyRentalNet * 12;
    const socialSecurityNet  = socialSecurityIncome * 12;
    const annualizedComp     = salaryAndEquityNet + rentalIncomeNet + socialSecurityNet;

    points.push({
      date:       `${MONTHS[monthOfYear]} ${currentYear}`,
      monthIndex: month,
      liquidCash: Math.round(liquidCash),
      retirement: Math.round(totalRetirement),
      rothBalance: Math.round(rothBalance),
      googValue:  Math.round(currentGoogValue),
      totalNetWorth:    Math.round(totalNetWorth),
      totalLiabilities: Math.round(totalLiabilities),
      isIndependent,
      swrTarget:  Math.round(swrTargetValue),
      investableAssets:    Math.round(investableAssets),
      investableAfterTax:  Math.round(investableAfterTax),
      annualExpenseNeed:   Math.round(annualExpenses),
      annualPassiveIncome: Math.round(annualPassiveIncome),
      currentPhase: phase,
      salaryAndEquityNet: Math.round(salaryAndEquityNet),
      rentalIncomeNet:    Math.round(rentalIncomeNet),
      socialSecurityNet:  Math.round(socialSecurityNet),
      totalCompensation:  Math.round(annualizedComp),
      rentalIncome:       Math.round(rentalIncome * 12),
      healthcareCost:     Math.round(currentHealthcareCost * 12),
      accumulatedReturns: 0,
      mortgagePayment:    Math.round((isRent ? config.spending.mortgage_payment : (hasMortgage ? config.spending.mortgage_payment / inflationMultiplier : 0)) * 12),
      lifestyleExpense:   Math.round(baseMonthlySpend * 12),
      socialSecurityIncome: Math.round(socialSecurityIncome * 12),
      educationAssets:    Math.round(current529),
    });
  }

  return points;
};

/**
 * The TRUE financial-independence point: the start of the final, sustained run
 * where assets remain ≥ the SWR target for the rest of the horizon.
 *
 * Using a plain `.find(isIndependent)` is unstable — assets briefly cross the
 * threshold during the GOOG divestment windfall, then dip back below, so the
 * marker jumps around (or vanishes) as inputs change. This returns the durable
 * crossing instead: undefined if the plan never reaches lasting independence.
 */
export function findIndependencePoint(points: TrajectoryPoint[]): TrajectoryPoint | undefined {
  if (!points.length || !points[points.length - 1].isIndependent) return undefined;
  let fi: TrajectoryPoint | undefined;
  for (let i = points.length - 1; i >= 0; i--) {
    if (!points[i].isIndependent) break;
    fi = points[i];
  }
  return fi;
}

/**
 * Fractional month index at which assets cross the FI target, interpolated
 * within the crossing month. Gives day-level resolution so small input changes
 * (e.g. a daily GOOG move) shift the FI date by a meaningful amount.
 * Returns undefined if FI is never durably reached, 0 if already independent.
 */
export function continuousFiMonth(points: TrajectoryPoint[]): number | undefined {
  const fi = findIndependencePoint(points);
  if (!fi) return undefined;
  const i = fi.monthIndex;
  if (i <= 0) return 0;
  const prev = points[i - 1];
  // Interpolate on the SAME (after-tax) measure the independence flag uses, so
  // the continuous FI month lines up with the durable crossing.
  const gapPrev = prev.investableAfterTax - prev.swrTarget; // < 0
  const gapNow  = fi.investableAfterTax  - fi.swrTarget;     // ≥ 0
  const denom = gapNow - gapPrev;
  const frac = denom > 0 ? Math.min(1, Math.max(0, -gapPrev / denom)) : 0;
  return (i - 1) + frac;
}

export type PlanHealth = "on-track" | "tight" | "shortfall";
export interface PlanAssessment {
  health: PlanHealth;
  /** Durable FI crossing, when the plan reaches it. */
  fi?: TrajectoryPoint;
  /** First retired month whose investable assets run dry (shortfall only). */
  depletion?: TrajectoryPoint;
}

/**
 * Solvency check — does the money actually last? This is SEPARATE from the FI
 * flag: FI compares spendable assets to the 25× *target*, and when guaranteed
 * income (Social Security + rental) covers the normalized need that target falls
 * toward $0, so `isIndependent` can read "reached" even as a plan's investable
 * assets deplete in retirement. Here we check the real cash-flow path instead:
 *   • shortfall — a retired month where investable assets hit zero (runs out).
 *   • tight     — survives, but the leanest retired moment leaves under ~1.5
 *                 years of expenses (little margin for error).
 *   • on-track  — otherwise.
 */
export function assessPlan(points: TrajectoryPoint[]): PlanAssessment {
  if (!points.length) return { health: "on-track" };
  const retired = points.filter((p) => p.currentPhase === "RETIRED");
  const depletion = retired.find((p) => p.investableAssets <= 0);
  if (depletion) return { health: "shortfall", depletion };

  const fi = findIndependencePoint(points);
  if (retired.length) {
    let low = Infinity, needAtLow = 0;
    for (const p of retired) if (p.investableAssets < low) { low = p.investableAssets; needAtLow = p.annualExpenseNeed; }
    if (needAtLow > 0 && low < needAtLow * 1.5) return { health: "tight", fi };
  }
  return { health: "on-track", fi };
}

export interface RetirementWindow {
  /** Earliest exit year whose plan still funds retirement to age 100 and reaches FI. */
  earliest: number | null;
  /** Earliest exit year that's comfortably on-track (a real cushion). */
  recommended: number | null;
}

/**
 * Scan candidate exit years to find the soonest the user could retire and stay
 * funded (`earliest`) and the soonest with a comfortable cushion (`recommended`).
 * Later exits are healthier, so we scan ascending and stop once both are found.
 */
export function findRetirementWindow(
  snapshot: FinancialSnapshot,
  config: SimulationConfiguration,
  livePrice = 0,
): RetirementWindow {
  const currentYear = new Date().getFullYear();
  const maxYear = (config.birth_year || 1985) + 75;
  let earliest: number | null = null;
  let recommended: number | null = null;
  for (let yr = currentYear; yr <= maxYear; yr++) {
    const cfg: SimulationConfiguration = { ...structuredClone(config), career_path: { ...config.career_path, exit_year: yr } };
    const pts = runSimulation(snapshot, cfg, livePrice);
    const { health } = assessPlan(pts);
    const reachesFI = !!findIndependencePoint(pts);
    if (earliest == null && health !== "shortfall" && reachesFI) earliest = yr;
    if (recommended == null && health === "on-track") recommended = yr;
    if (earliest != null && recommended != null) break;
  }
  return { earliest, recommended };
}

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
    bridge_gross_annual: number;
    bridge_has_health_insurance?: boolean;
    income_growth_rate: number;    // Nominal annual raise % (not stacked on inflation)
    target_bonus_rate: number;
    annual_equity_grant: number;
    monthly_rental_income: number;
    monthly_parttime_income?: number;   // Supplemental earned income (part-time work)
    annual_401k_contribution?: number;  // Pre-tax 401k (default IRS max)
    annual_backdoor_roth?: number;      // Backdoor Roth IRA per year (default $7k)
    use_partner_income?: boolean;
    partner_gross_annual_salary?: number;
    partner_employment_start_year?: number;
    partner_has_health_insurance?: boolean;
    partner_retirement_year?: number;
  };
  market_assumptions: {
    goog_growth_rate: number;
    market_return_rate: number;
    inflation_rate: number;
    volatility_drag: number;
  };
  tax_assumptions: {
    filing_status: 'single' | 'married_joint' | 'married_separate' | 'head_household';
    state_of_residence: 'CA' | 'WA' | 'TX' | 'NY' | 'NONE';
  };
  tax_optimization: {
    enable_aca_optimization: boolean;      // Model ACA subsidies during low-income phases
    aca_family_size: number;               // Household size for FPL calculation
    aca_benchmark_monthly_premium: number; // Silver plan benchmark for subsidy calc
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
    empty_nest_year?: number;
    empty_nest_monthly_spend?: number;
    healthcare_premium: number;
    mortgage_payment: number;
  };
  birth_year: number;
  social_security: {
    start_age: number;
    monthly_amount: number;
  };
  medicare: {
    start_age: number;
    monthly_premium: number;
  };
  life_events: Array<{
    name: string;
    year: number;
    cost: number;
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
  investableAssets: number;      // assets that fund retirement (excl. 529)
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

import { calculateTax } from './tax_engine';

// Age at which a child is assumed to leave the family health plan (post-college).
const CHILD_OFF_PLAN_AGE = 22;

// ── ACA Federal Poverty Line (2025) ──────────────────────────────────────────
// 48 contiguous states + DC
function getFPL(familySize: number): number {
  const base = 15_060;
  const perPerson = 5_380;
  return base + perPerson * Math.max(0, familySize - 1);
}

// ACA maximum required premium contribution as % of MAGI (2025 ARP rules)
function acaMaxContributionPct(fplRatio: number): number {
  if (fplRatio <= 1.00) return 0.000;
  if (fplRatio <= 1.33) return 0.000;
  if (fplRatio <= 1.50) return 0.020;
  if (fplRatio <= 2.00) return 0.060;
  if (fplRatio <= 2.50) return 0.080;
  if (fplRatio <= 3.00) return 0.100;
  return 0.085; // ARP cap: max 8.5% of income for any income level
}

// ── Main simulation ───────────────────────────────────────────────────────────

export const runSimulation = (
  snapshot: FinancialSnapshot,
  config: SimulationConfiguration,
  live_price_input: number
): TrajectoryPoint[] => {
  const points: TrajectoryPoint[] = [];

  const live_price = live_price_input > 0 ? live_price_input : 175.00;

  const ip = config.income_profile;
  const jumpGrossAnnual   = ip.jump_gross_annual   || 275_000;
  const bridgeGrossAnnual = ip.bridge_gross_annual || 220_000;
  const opt               = config.tax_optimization;

  const JUMP_EQUITY_GROWTH = 0.08;
  const RENTAL_GROWTH_RATE = 0.074; // User-specified

  const startYear  = new Date().getFullYear();
  const startMonth = new Date().getMonth();

  // ── Initial balances ───────────────────────────────────────────────────────
  let liquidCash  = snapshot.liquid_assets.vanguard_bridge + snapshot.liquid_assets.cash_savings;
  // Split retirement into Roth (tax-free) vs traditional (taxable on withdrawal)
  let rothBalance  = snapshot.retirement_assets.roth_ira;
  let tradBalance  = snapshot.retirement_assets.k401 + snapshot.retirement_assets.traditional_ira;

  // The "concentrated position" (employer stock / RSUs) that gets its own growth
  // rate, vesting, and divestment treatment. Configurable per user; defaults to
  // none. Legacy data may carry GOOG holdings + share_counts.google_shares.
  const concSym = (config.concentrated_symbol ?? '').toUpperCase();
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

  const sabbaticalEndYear = config.career_path.exit_year + (config.career_path.use_sabbatical ? config.career_path.sabbatical_duration : 0);
  const jumpEndYear       = sabbaticalEndYear + (config.career_path.use_jump   ? config.career_path.jump_duration   : 0);
  const bridgeEndYear     = jumpEndYear       + (config.career_path.use_bridge ? config.career_path.bridge_duration : 0);

  const currentOtherInvestments = (snapshot.other_investments ?? [])
    .filter(i => !isConcentrated(i.symbol))
    .map(i => ({
      ...i,
      currentValue:   (i.shares * i.current_price) || 0,
      expectedReturn: i.expected_return ?? config.market_assumptions.market_return_rate,
    }));

  // IRS 401k limits 2025
  const K401_LIMIT      = 23_500;
  const CATCHUP_LIMIT   = 7_500;  // Age 50+
  const CATCHUP_AGE     = 50;
  // Federal mortgage acquisition debt deductibility cap (post-12/16/2017 loans)
  const FED_MORTGAGE_CAP = 750_000;

  // Convert an annual percentage rate (e.g. 7) to its TRUE monthly compounding
  // factor: (1 + r)^(1/12) − 1. Dividing the annual rate by 12 overstates the
  // effective annual yield (7%/12 monthly compounds to ~7.23%/yr).
  const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;

  // ── Main simulation loop (360 months = 30 years) ──────────────────────────
  for (let month = 0; month < 360; month++) {

    const totalMonths = startMonth + month;
    const currentYear = startYear + Math.floor(totalMonths / 12);
    const monthOfYear = totalMonths % 12;
    const currentDate = new Date(currentYear, monthOfYear, 1);
    const yearsPassed = month / 12;
    const currentAge  = currentYear - (config.birth_year || 1980);

    const effectiveMarketReturn = Math.max(0, config.market_assumptions.market_return_rate - config.market_assumptions.volatility_drag);
    const inflationMultiplier   = Math.pow(1 + config.market_assumptions.inflation_rate / 100, yearsPassed);

    // ── Asset growth (true geometric monthly compounding) ────────────────────
    const marketMo = monthlyRate(effectiveMarketReturn);
    currentGoogPrice      *= (1 + monthlyRate(config.market_assumptions.goog_growth_rate));
    currentJumpStockValue *= (1 + monthlyRate(JUMP_EQUITY_GROWTH * 100));
    liquidCash   *= (1 + marketMo);
    tradBalance  *= (1 + marketMo);
    rothBalance  *= (1 + marketMo);
    current529   *= (1 + monthlyRate(config.market_assumptions.market_return_rate));

    let totalOtherInvestmentsValue = 0;
    for (const inv of currentOtherInvestments) {
      inv.currentValue *= (1 + monthlyRate(Math.max(0, inv.expectedReturn - config.market_assumptions.volatility_drag)));
      totalOtherInvestmentsValue += inv.currentValue;
    }

    // ── Phase determination ────────────────────────────────────────────────
    let phase: 'GOOGLE' | 'SABBATICAL' | 'JUMP' | 'BRIDGE' | 'RETIRED' = 'GOOGLE';
    const nominalIncomeGrowth    = (ip.income_growth_rate || 0) / 100;
    const salaryGrowthMultiplier = Math.pow(1 + nominalIncomeGrowth, yearsPassed);

    let annualBaseSalary  = 0;
    let annualTargetBonus = 0;

    if (currentYear < config.career_path.exit_year) {
      phase = 'GOOGLE';
      annualBaseSalary  = (ip.gross_annual_salary || 0) * salaryGrowthMultiplier;
      annualTargetBonus = annualBaseSalary * ((ip.target_bonus_rate || 0) / 100);
    } else if (currentYear < sabbaticalEndYear) {
      phase = 'SABBATICAL';
    } else if (currentYear < jumpEndYear) {
      phase = 'JUMP';
      annualBaseSalary  = jumpGrossAnnual * salaryGrowthMultiplier;
      annualTargetBonus = annualBaseSalary * ((ip.jump_bonus_rate || 0) / 100);
    } else if (currentYear < bridgeEndYear) {
      phase = 'BRIDGE';
      annualBaseSalary = bridgeGrossAnnual * inflationMultiplier;
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
      * Math.pow(1 + RENTAL_GROWTH_RATE, Math.floor(yearsPassed));
    const annualRentalGross = rentalIncome * 12;

    // ── Part-time work income (earned → W2/FICA, ordinary income tax) ──────
    // Supplemental earned income the user expects to keep regardless of phase
    // (e.g. consulting or part-time work in early retirement). Tracks raises.
    const annualParttimeGross = (ip.monthly_parttime_income || 0) * 12 * salaryGrowthMultiplier;

    // ── RSU vesting ────────────────────────────────────────────────────────
    let monthlyEquityVestUnits = 0;
    if (phase === 'GOOGLE') {
      // Initial grant — linear over vesting_years
      if (yearsPassed < (ip.vesting_years || 4)) {
        monthlyEquityVestUnits += (ip.initial_unvested_shares || 0) / ((ip.vesting_years || 4) * 12);
      }
      // Refresher grants — 4 stacking cohorts (allow pre-sim grants via negative grantYear)
      const grantValue = ip.annual_equity_grant || 0;
      for (let i = 0; i < 4; i++) {
        const grantYear      = Math.floor(yearsPassed) - i;
        const grantTimeYears = Math.max(0, grantYear);
        const priceAtGrant   = Math.max(0.1, live_price * Math.pow(1 + config.market_assumptions.goog_growth_rate / 100, grantTimeYears));
        const grantValueAtTime = grantValue * Math.pow(1 + nominalIncomeGrowth, grantTimeYears);
        monthlyEquityVestUnits += (grantValueAtTime / priceAtGrant) / 48;
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
    const k401MaxAllowed = currentAge >= CATCHUP_AGE ? K401_LIMIT + CATCHUP_LIMIT : K401_LIMIT;
    const annualK401 = (phase === 'GOOGLE' || phase === 'JUMP' || phase === 'BRIDGE')
      ? Math.min(ip.annual_401k_contribution ?? K401_LIMIT, k401MaxAllowed, annualBaseSalary * 0.9)
      : 0;

    // ── OPT #2: Itemized deductions for mortgage interest ─────────────────
    // Federal: mortgage interest capped at $750k acquisition debt (post-2017 loans).
    // NY state: follows federal mortgage interest deduction.
    // SALT: capped at $10k federally (NY state: no cap for state deduction itself).
    const hasMortgageNow = currentDate < mortgagePayoffDate && currentMortgage > 0;
    const deductibleMortgagePct = hasMortgageNow
      ? Math.min(1, FED_MORTGAGE_CAP / Math.max(1, currentMortgage))
      : 0;
    const annualMortgageInterest    = hasMortgageNow ? currentMortgage * (mortgageRate / 100) : 0;
    const deductibleInterestFed     = annualMortgageInterest * deductibleMortgagePct;
    const saltCapFed                = 10_000;
    const totalItemizedFed          = deductibleInterestFed + saltCapFed;
    // NY: same mortgage interest deduction; SALT adds back since state deduction is for state
    const totalItemizedNY           = deductibleInterestFed;

    // ── Tax calculation ────────────────────────────────────────────────────
    // grossIncome = W2 (FICA base — full salary before 401k)
    // preTaxDeductions = 401k (reduces income tax but not FICA)
    const annualW2Gross = annualBaseSalary + annualTargetBonus + annualPartnerGross + annualParttimeGross + annualRSUValue + annualJumpGrantValue;

    const taxResult = calculateTax({
      filingStatus:          config.tax_assumptions.filing_status,
      state:                 config.tax_assumptions.state_of_residence,
      grossIncome:           annualW2Gross,
      preTaxDeductions:      annualK401,
      ficaExemptIncome:      annualRentalGross,
      itemizedDeductions:    totalItemizedFed,
      nyItemizedDeductions:  totalItemizedNY,
      longTermCapitalGains:  0,
      shortTermCapitalGains: 0,
    });

    const ordinaryEffRate = taxResult.ordinaryEffectiveRate;
    const marginalRate    = taxResult.marginalRate;

    // ── Net cash flows ─────────────────────────────────────────────────────
    const isBonusMonth     = (month % 12 === 2);
    // Salary net = (salary minus 401k contribution) after tax; 401k goes to tradBalance
    const taxableSalary    = Math.max(0, annualBaseSalary - annualK401);
    const monthlySalaryNet = (taxableSalary / 12) * (1 - ordinaryEffRate);
    const monthlyBonusNet  = isBonusMonth ? annualTargetBonus * (1 - ordinaryEffRate) : 0;
    const monthlyPartnerNet = (annualPartnerGross / 12) * (1 - ordinaryEffRate);
    const monthlyRentalNet  = (annualRentalGross  / 12) * (1 - ordinaryEffRate);
    const monthlyParttimeNet = (annualParttimeGross / 12) * (1 - ordinaryEffRate);

    // 401k contribution goes directly to traditional retirement each month
    tradBalance += annualK401 / 12;

    // OPT #1 (Backdoor Roth IRA) — $7k/yr ($8k if 50+), funded from liquid cash in April
    // Non-deductible contribution → immediate conversion → no current-year tax
    const rothIRALimit    = currentAge >= CATCHUP_AGE ? 8_000 : 7_000;
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
          const baseConvTax = calculateTax({
            filingStatus: config.tax_assumptions.filing_status,
            state: config.tax_assumptions.state_of_residence,
            grossIncome: 0,
            ficaExemptIncome: annualRentalGross,
            itemizedDeductions: totalItemizedFed,
            nyItemizedDeductions: totalItemizedNY,
            longTermCapitalGains: 0, shortTermCapitalGains: 0,
          });
          const withConvTax = calculateTax({
            filingStatus: config.tax_assumptions.filing_status,
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
    // Empty-nest phase is optional; treat a missing flag as enabled so existing
    // saved configs keep their prior behavior.
    const useEmptyNest  = config.spending.use_empty_nest !== false;
    const emptyNestYear = config.spending.empty_nest_year ?? 3_000;
    const baseMonthlySpend = (useEmptyNest && currentYear >= emptyNestYear && config.spending.empty_nest_monthly_spend)
      ? config.spending.empty_nest_monthly_spend
      : config.spending.monthly_lifestyle;

    let expense = baseMonthlySpend * inflationMultiplier;

    // Social Security — up to 85% of benefits are federally taxable; NY exempts
    // SS entirely (so we compute federal-only by passing state 'NONE'). The
    // taxable portion stacks on top of other ordinary income (rental).
    let socialSecurityIncome = 0;
    if (config.social_security && currentAge >= config.social_security.start_age) {
      const grossSSAnnual = config.social_security.monthly_amount * inflationMultiplier * 12;
      const taxableSSAnnual = grossSSAnnual * 0.85; // max inclusion for higher-income retirees

      const ssBaseTax = calculateTax({
        filingStatus: config.tax_assumptions.filing_status, state: "NONE",
        grossIncome: 0, ficaExemptIncome: annualRentalGross,
        longTermCapitalGains: 0, shortTermCapitalGains: 0,
      });
      const ssWithTax = calculateTax({
        filingStatus: config.tax_assumptions.filing_status, state: "NONE",
        grossIncome: 0, ficaExemptIncome: annualRentalGross + taxableSSAnnual,
        longTermCapitalGains: 0, shortTermCapitalGains: 0,
      });
      const ssFedTaxAnnual = Math.max(0, ssWithTax.federalIncomeTax - ssBaseTax.federalIncomeTax);

      socialSecurityIncome = (grossSSAnnual - ssFedTaxAnnual) / 12; // net monthly
      liquidCash += socialSecurityIncome;
    }

    // Healthcare
    const partnerIsWorking = ip.use_partner_income && ip.partner_has_health_insurance &&
      currentYear >= partnerStarts && currentYear < partnerRetires;
    const bridgeCovered = (phase === 'BRIDGE') && !!ip.bridge_has_health_insurance;
    const hasEmployerCoverage = phase === 'GOOGLE' || phase === 'JUMP' || partnerIsWorking || bridgeCovered;

    const adults = config.tax_assumptions.filing_status === 'married_joint' ? 2 : 1;

    // Self-paid healthcare cost — what the household WOULD pay without employer
    // coverage. Computed every year (even while employed) because the FI target
    // must reflect the retirement reality of buying your own coverage.
    let selfPaidHealthcare: number;
    if (config.medicare && currentAge >= config.medicare.start_age) {
      // Medicare: per-person all-in (Part B + Part D + modest Medigap) × adults.
      selfPaidHealthcare = config.medicare.monthly_premium * adults * inflationMultiplier;
    } else {
      // Pre-65 private/ACA coverage scales with the people actually on the plan;
      // children age off at ~22 (post-college).
      const baseFamilySize = Math.max(1, opt?.aca_family_size ?? 4);
      const perCapita      = config.spending.healthcare_premium / baseFamilySize;
      const coveredKids    = (config.children ?? []).filter(
        c => currentYear - c.birthYear < CHILD_OFF_PLAN_AGE
      ).length;
      selfPaidHealthcare = perCapita * (adults + coveredKids) * inflationMultiplier;
    }

    // Actual out-of-pocket healthcare expense this month (0 while employer-covered).
    let currentHealthcareCost = 0;
    if (!hasEmployerCoverage) {
      currentHealthcareCost = selfPaidHealthcare;

      // ACA premium subsidy applies only during a true low-income window — the
      // sabbatical, when the family lives on rental income alone. In normal early
      // retirement, six-figure withdrawals push MAGI above the subsidy range.
      if (phase === 'SABBATICAL' && (opt?.enable_aca_optimization ?? true)) {
        const baseFamilySize = Math.max(1, opt?.aca_family_size ?? 4);
        const fpl            = getFPL(baseFamilySize) * inflationMultiplier;
        const magiForACA     = annualRentalGross + socialSecurityIncome * 12 * 0.85;
        const maxContribPct  = acaMaxContributionPct(magiForACA / fpl);
        const maxMonthly     = (magiForACA * maxContribPct) / 12;
        currentHealthcareCost = Math.min(currentHealthcareCost, maxMonthly);
      }

      expense += currentHealthcareCost;
    }

    // Mortgage
    const hasMortgage = currentDate < mortgagePayoffDate;
    if (hasMortgage) {
      expense += config.spending.mortgage_payment;
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
          const inflatedCost = event.cost * inflationMultiplier;
          if (event.name.toLowerCase().includes('college')) {
            if (current529 >= inflatedCost) {
              current529 -= inflatedCost;
            } else {
              expense += inflatedCost - current529;
              current529 = 0;
            }
          } else {
            expense += inflatedCost;
          }
        }
      }
    }

    // Capital calls
    if (snapshot.liabilities.upcoming_capital_calls > 0 && snapshot.liabilities.capital_calls_due_date) {
      const due = new Date(snapshot.liabilities.capital_calls_due_date);
      if (currentDate.getFullYear() === due.getFullYear() && currentDate.getMonth() === due.getMonth()) {
        expense += snapshot.liabilities.upcoming_capital_calls;
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
        const baseTax    = calculateTax({ filingStatus: config.tax_assumptions.filing_status, state: config.tax_assumptions.state_of_residence, grossIncome: annualW2Gross, preTaxDeductions: annualK401, ficaExemptIncome: annualRentalGross, itemizedDeductions: totalItemizedFed, nyItemizedDeductions: totalItemizedNY, longTermCapitalGains: 0, shortTermCapitalGains: 0 });
        const withSaleTax = calculateTax({ filingStatus: config.tax_assumptions.filing_status, state: config.tax_assumptions.state_of_residence, grossIncome: annualW2Gross, preTaxDeductions: annualK401, ficaExemptIncome: annualRentalGross, itemizedDeductions: totalItemizedFed, nyItemizedDeductions: totalItemizedNY, longTermCapitalGains: annualLTCG, shortTermCapitalGains: 0 });

        divestmentProceeds = grossSale - (withSaleTax.totalTax - baseTax.totalTax) / 12;
        currentGoogShares -= sharesToSell;
      }

    } else if (config.divestment_strategy.type === 'immediate') {
      if (currentYear === config.career_path.exit_year && monthOfYear === 0 && currentGoogShares > 0) {
        const grossProceeds = currentGoogShares * currentGoogPrice;
        const totalBasis    = currentGoogByBasis.reduce((a, b) => a + b.shares * b.basis, 0);
        const totalSh       = currentGoogByBasis.reduce((a, b) => a + b.shares, 0);
        const avgBasis      = totalSh > 0 ? totalBasis / totalSh : 0;
        const gain          = Math.max(0, grossProceeds - currentGoogShares * avgBasis);

        const baseTax     = calculateTax({ filingStatus: config.tax_assumptions.filing_status, state: config.tax_assumptions.state_of_residence, grossIncome: annualW2Gross, preTaxDeductions: annualK401, ficaExemptIncome: annualRentalGross, itemizedDeductions: totalItemizedFed, nyItemizedDeductions: totalItemizedNY, longTermCapitalGains: 0,    shortTermCapitalGains: 0 });
        const withSaleTax = calculateTax({ filingStatus: config.tax_assumptions.filing_status, state: config.tax_assumptions.state_of_residence, grossIncome: annualW2Gross, preTaxDeductions: annualK401, ficaExemptIncome: annualRentalGross, itemizedDeductions: totalItemizedFed, nyItemizedDeductions: totalItemizedNY, longTermCapitalGains: gain, shortTermCapitalGains: 0 });

        divestmentProceeds = grossProceeds - (withSaleTax.totalTax - baseTax.totalTax);
        currentGoogShares  = 0;
      }
    }

    liquidCash += divestmentProceeds;

    // ── Net flow ───────────────────────────────────────────────────────────
    liquidCash += monthlyOrdinaryNet - expense;

    // Consumer debt paydown when flush
    if (liquidCash > 50_000 && currentConsumerDebt > 0) {
      const paydown = Math.min(liquidCash - 50_000, currentConsumerDebt);
      currentConsumerDebt -= paydown;
      liquidCash -= paydown;
    }

    // ── Deficit handling ──────────────────────────────────────────────────
    if (liquidCash < 0) {
      const deficit = Math.abs(liquidCash);
      liquidCash = 0;
      const emergencyTaxRate = Math.min(0.55, marginalRate + 0.05);

      const totalBasis = currentGoogByBasis.reduce((a, b) => a + b.shares * b.basis, 0);
      const totalSh    = currentGoogByBasis.reduce((a, b) => a + b.shares, 0);
      const avgBasis   = totalSh > 0 ? totalBasis / totalSh : 0;
      const netPerShare = currentGoogPrice - emergencyTaxRate * Math.max(0, currentGoogPrice - avgBasis);

      if (currentGoogShares * netPerShare >= deficit) {
        currentGoogShares -= deficit / Math.max(0.01, netPerShare);
      } else {
        let remaining = deficit - currentGoogShares * netPerShare;
        currentGoogShares = 0;
        // Draw from Roth first (tax-free), then traditional (with tax drag)
        if (rothBalance * 1.0 >= remaining) {
          rothBalance -= remaining;
        } else {
          remaining -= rothBalance;
          rothBalance = 0;
          if (currentJumpStockValue * 0.75 >= remaining) {
            currentJumpStockValue -= remaining / 0.75;
          } else {
            remaining -= currentJumpStockValue * 0.75;
            currentJumpStockValue = 0;
            tradBalance -= remaining / 0.70; // ~30% effective tax on traditional withdrawal
          }
        }
      }
    }

    // ── Derived values ────────────────────────────────────────────────────
    const totalRetirement  = tradBalance + rothBalance;
    const currentGoogValue = Math.max(0, currentGoogShares * currentGoogPrice);
    const totalLiabilities = currentMortgage + currentConsumerDebt;

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
    // FI Number = (Annual Expenses − Guaranteed/Passive Income) ÷ SWR.
    // Expenses use normalized retirement spending (lifestyle + healthcare; the
    // mortgage is finite and excluded). Passive income (rental + Social Security,
    // net of tax) is subtracted because it permanently offsets expenses, lowering
    // the nest egg you need.
    const SWR = 0.04; // 4% safe withdrawal rate (Rule of 25 → ×25)
    // baseMonthlySpend is in today's dollars (inflate it); currentHealthcareCost
    // is ALREADY inflation-adjusted above, so it must not be inflated again.
    // Use SELF-PAID healthcare (not the employer-covered $0) so the target
    // reflects what retirement actually costs — otherwise FI triggers years early.
    const annualExpenses      = (baseMonthlySpend * inflationMultiplier + selfPaidHealthcare) * 12;
    const annualPassiveIncome = (monthlyRentalNet + socialSecurityIncome) * 12; // rental + SS, net
    const netAnnualNeed       = Math.max(0, annualExpenses - annualPassiveIncome);
    const swrTargetValue      = netAnnualNeed / SWR; // the FI Number (25× the net need)

    // Independent once investable assets cover the FI Number (or passive income
    // alone already covers expenses → need is zero).
    const isIndependent = investableAssets >= swrTargetValue;

    // ── Chart fields ──────────────────────────────────────────────────────
    const equityPart    = monthlyEquityVestUnits > 0 ? monthlyEquityVestUnits * (1 - marginalRate) * currentGoogPrice : 0;
    const jumpStockPart = jumpGrantMonthlyGross  > 0 ? jumpGrantMonthlyGross  * (1 - marginalRate) : 0;

    const salaryAndEquityNet = (monthlySalaryNet + monthlyBonusNet + monthlyPartnerNet + monthlyParttimeNet + equityPart + jumpStockPart) * 12;
    const rentalIncomeNet    = monthlyRentalNet * 12;
    const socialSecurityNet  = socialSecurityIncome * 12;
    const annualizedComp     = salaryAndEquityNet + rentalIncomeNet + socialSecurityNet;

    points.push({
      date:       currentDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
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
      mortgagePayment:    Math.round((hasMortgage ? config.spending.mortgage_payment : 0) * 12),
      lifestyleExpense:   Math.round(baseMonthlySpend * inflationMultiplier * 12),
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
  const gapPrev = prev.investableAssets - prev.swrTarget; // < 0
  const gapNow  = fi.investableAssets  - fi.swrTarget;     // ≥ 0
  const denom = gapNow - gapPrev;
  const frac = denom > 0 ? Math.min(1, Math.max(0, -gapPrev / denom)) : 0;
  return (i - 1) + frac;
}

import { describe, it, expect } from "vitest";
import { runSimulation, findIndependencePoint, assessPlan, toDisplayDollars, findRetirementWindow } from "@/engine/calculator";
import { estimateMonthlySocialSecurity } from "@/engine/social_security";
import { calculateTax } from "@/engine/tax_engine";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";
import { DEFAULT_SIM_CONFIG, DEFAULT_SNAPSHOT } from "@/config/sharedConfig";

// Deep-clone the shared blank-slate defaults so each test can tweak freely
// without leaking state between cases.
const baseConfig = (): SimulationConfiguration => structuredClone(DEFAULT_SIM_CONFIG);
const baseSnap   = (): FinancialSnapshot      => structuredClone(DEFAULT_SNAPSHOT);

const YEAR = new Date().getFullYear();

describe("runSimulation — invariants", () => {
  it("is deterministic: identical inputs produce identical output", () => {
    const a = runSimulation(baseSnap(), baseConfig(), 200);
    const b = runSimulation(baseSnap(), baseConfig(), 200);
    expect(a).toEqual(b);
  });

  it("compounds a pure asset at the configured geometric rate (no income/expenses)", () => {
    const cfg = idleRetiree();
    cfg.market_assumptions.market_return_rate = 7;
    cfg.market_assumptions.volatility_drag = 0;
    cfg.market_assumptions.inflation_rate = 0; // isolate nominal == real growth

    const traj = runSimulation(idleSnap(1_000_000), cfg, 200);
    // One clean year of growth (no contributions/withdrawals) → exactly 7%.
    expect(traj[24].liquidCash / traj[12].liquidCash).toBeCloseTo(1.07, 3);
  });
});

// A retired, no-income, no-spend household whose only dynamic is asset growth —
// used to test compounding cleanly (no salary, 401k, backdoor Roth, SS, or spend).
function idleRetiree(): SimulationConfiguration {
  const cfg = baseConfig();
  cfg.birth_year = YEAR - 50;
  cfg.career_path.exit_year = YEAR;
  cfg.career_path.use_sabbatical = false;
  cfg.career_path.use_jump = false;
  cfg.career_path.use_bridge = false;
  cfg.income_profile.gross_annual_salary = 0;
  cfg.spending.monthly_lifestyle = 0;
  cfg.spending.healthcare_premium = 0;
  cfg.medicare.monthly_premium = 0;
  cfg.social_security.social_security_linked = false;
  cfg.social_security.monthly_amount = 0;
  cfg.market_assumptions.taxable_dividend_drag = 0; // isolate pure compounding
  return cfg;
}
function idleSnap(cash: number): FinancialSnapshot {
  const snap = baseSnap();
  snap.liquid_assets.cash_savings = cash;
  return snap;
}

describe("findRetirementWindow — earliest fundable & recommended exit years", () => {
  it("returns ordered years (recommended no earlier than earliest) for a fundable plan", () => {
    const win = findRetirementWindow(idleSnap(5_000_000), baseConfig(), 0);
    expect(win.earliest).not.toBeNull();
    if (win.earliest != null && win.recommended != null) {
      expect(win.recommended).toBeGreaterThanOrEqual(win.earliest);
    }
  });

  it("never returns a year before the current year", () => {
    const win = findRetirementWindow(idleSnap(5_000_000), baseConfig(), 0);
    if (win.earliest != null) expect(win.earliest).toBeGreaterThanOrEqual(YEAR);
  });
});

describe("assessPlan — solvency is separate from the FI flag", () => {
  it("flags a retiree who outspends modest assets as a shortfall (runs out of money)", () => {
    const cfg = idleRetiree();
    cfg.spending.monthly_lifestyle = 8_000; // ~$96k/yr with no income to cover it
    const traj = runSimulation(idleSnap(300_000), cfg, 0);
    const a = assessPlan(traj);
    expect(a.health).toBe("shortfall");
    expect(a.depletion).toBeDefined();
  });

  it("does not flag a comfortably-funded retiree as a shortfall", () => {
    const cfg = idleRetiree();
    cfg.spending.monthly_lifestyle = 2_000; // ~$24k/yr against a large balance
    const traj = runSimulation(idleSnap(5_000_000), cfg, 0);
    expect(assessPlan(traj).health).not.toBe("shortfall");
  });
});

describe("rental income growth is user-configurable", () => {
  function rentalAfter10y(rate: number): number {
    const cfg = baseConfig();
    cfg.income_profile.monthly_rental_income = 1_000;
    cfg.income_profile.rental_income_growth_rate = rate;
    cfg.market_assumptions.inflation_rate = 0; // compare the nominal rate directly (real == nominal)
    const traj = runSimulation(baseSnap(), cfg, 200);
    return traj[120].rentalIncome; // annualized gross rental at exactly 10 years
  }

  it("holds rental flat when growth is 0%", () => {
    expect(rentalAfter10y(0)).toBeCloseTo(12_000, 0);
  });

  it("grows rental faster at a higher configured rate", () => {
    const slow = rentalAfter10y(2);
    const fast = rentalAfter10y(8);
    expect(fast).toBeGreaterThan(slow);
    // 8%/yr for 10 yrs ≈ 2.16× the starting $12k.
    expect(fast).toBeGreaterThan(12_000 * 2);
  });
});

describe("mortgage payments stop once the balance is paid off", () => {
  it("does not keep charging the payment after the loan is gone", () => {
    const snap = baseSnap();
    snap.liabilities.mortgage_balance = 60_000;
    snap.liabilities.mortgage_interest_rate = 3.5;
    snap.liabilities.mortgage_payoff_date = `${YEAR + 30}-01-01`;
    const cfg = baseConfig();
    cfg.spending.mortgage_payment = 5_000; // pays off ~60k in ~12-13 months

    const traj = runSimulation(snap, cfg, 200);
    // Well after the balance is gone but long before the nominal payoff date,
    // there should be no mortgage outflow.
    const late = traj[48];
    expect(late.mortgagePayment).toBe(0);
  });
});

describe("decumulation draws down the taxable brokerage", () => {
  it("spends a diversified brokerage in retirement instead of leaving it untouched", () => {
    const snap = baseSnap();
    // A retiree whose wealth is almost entirely a broad-market brokerage.
    snap.other_investments = [{
      id: "vti", name: "Total Market", symbol: "VTI",
      shares: 10_000, cost_basis: 100, current_price: 100, expected_return: 4,
    }];
    const cfg = baseConfig();
    cfg.birth_year = YEAR - 60;          // already retired
    cfg.career_path.exit_year = YEAR;    // no earned income
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 0;
    cfg.spending.monthly_lifestyle = 12_000; // outspends the 4% return → real drawdown

    const traj = runSimulation(snap, cfg, 200);
    const start = traj[0].investableAssets;
    const tenYears = traj[120].investableAssets;
    // Spending must erode the brokerage (real drawdown)...
    expect(tenYears).toBeLessThan(start);
    // ...without the old artifact of driving the (empty) 401k/IRA negative to
    // absorb the deficit. Retirement and cash balances must never go negative.
    for (const p of traj) {
      expect(p.retirement).toBeGreaterThanOrEqual(-1);
      expect(p.liquidCash).toBeGreaterThanOrEqual(-1);
    }
  });
});

describe("FI test uses after-tax spendable assets, not gross balances", () => {
  // A pre-retiree with a single asset bucket and simple expenses, used to
  // isolate the tax-haircut behavior.
  function retireeConfig(): SimulationConfiguration {
    const cfg = baseConfig();
    cfg.birth_year = YEAR - 60;        // age 60: retired, pre-Medicare, pre-SS
    cfg.career_path.exit_year = YEAR;
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 0;
    cfg.spending.monthly_lifestyle = 3_000;
    cfg.spending.healthcare_premium = 0;
    cfg.spending.mortgage_payment = 0;
    cfg.medicare.monthly_premium = 0;
    return cfg;
  }
  function snapWith(bucket: "cash" | "roth" | "trad", amount: number): FinancialSnapshot {
    const snap = baseSnap();
    if (bucket === "cash") snap.liquid_assets.cash_savings = amount;
    if (bucket === "roth") snap.retirement_assets.roth_ira = amount;
    if (bucket === "trad") snap.retirement_assets.k401 = amount;
    return snap;
  }

  it("does not haircut cash or Roth (after-tax == gross)", () => {
    const traj = runSimulation(snapWith("cash", 1_000_000), retireeConfig(), 200);
    expect(traj[0].investableAfterTax).toBe(traj[0].investableAssets);
  });

  it("haircuts pre-tax balances (after-tax < gross)", () => {
    const traj = runSimulation(snapWith("trad", 1_000_000), retireeConfig(), 200);
    expect(traj[0].investableAfterTax).toBeLessThan(traj[0].investableAssets);
  });

  it("reaches FI on Roth dollars but not the same gross balance held pre-tax", () => {
    // $930k vs a $900k FI number ($36k/yr need ÷ 4%): Roth clears it after-tax,
    // but the same balance in a 401k does not once the withdrawal tax is netted.
    const roth = runSimulation(snapWith("roth", 930_000), retireeConfig(), 200);
    const trad = runSimulation(snapWith("trad", 930_000), retireeConfig(), 200);
    expect(roth[0].swrTarget).toBeCloseTo(900_000, -3);
    expect(roth[0].isIndependent).toBe(true);
    expect(trad[0].isIndependent).toBe(false);
  });
});

describe("real-dollar model (today's purchasing power)", () => {
  it("grows assets at the REAL return (nominal minus inflation)", () => {
    const cfg = idleRetiree();
    cfg.market_assumptions.market_return_rate = 7;
    cfg.market_assumptions.inflation_rate = 3;
    cfg.market_assumptions.volatility_drag = 0;

    const traj = runSimulation(idleSnap(1_000_000), cfg, 200);
    // Real return = 1.07 / 1.03 − 1 ≈ 3.883%/yr over one clean year.
    expect(traj[24].liquidCash / traj[12].liquidCash).toBeCloseTo(1.07 / 1.03, 3);
  });

  it("keeps lifestyle spending flat in real terms (no inflation ramp)", () => {
    const cfg = baseConfig();
    cfg.spending.monthly_lifestyle = 5_000;
    cfg.market_assumptions.inflation_rate = 3;
    const traj = runSimulation(baseSnap(), cfg, 200);
    expect(traj[120].lifestyleExpense).toBe(traj[12].lifestyleExpense);
    expect(traj[12].lifestyleExpense).toBe(5_000 * 12);
  });

  it("shows no bracket-creep: a salary that just tracks inflation has a flat real net", () => {
    const cfg = baseConfig();
    cfg.birth_year = YEAR - 35;
    cfg.career_path.exit_year = YEAR + 30;     // working the whole window
    cfg.income_profile.gross_annual_salary = 200_000;
    cfg.income_profile.income_growth_rate = 3; // nominal raise == inflation
    cfg.market_assumptions.inflation_rate = 3; // → 0% real growth
    const traj = runSimulation(baseSnap(), cfg, 200);
    // Same month-of-year 14 years apart (both non-bonus months) → identical real
    // take-home. Under the old frozen-bracket model this drifted down as nominal
    // pay climbed into higher brackets.
    const ratio = traj[180].salaryAndEquityNet / traj[12].salaryAndEquityNet;
    expect(ratio).toBeCloseTo(1, 2);
  });
});

describe("required minimum distributions (RMDs)", () => {
  // A retiree with a pre-tax balance and no growth/spending, to isolate the
  // forced withdrawal: zero returns, no expenses, no other income.
  function rmdScenario(birthOffset: number) {
    const cfg = baseConfig();
    cfg.birth_year = YEAR - birthOffset;
    cfg.career_path.exit_year = YEAR;
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 0;
    cfg.spending.monthly_lifestyle = 0;
    cfg.spending.healthcare_premium = 0;
    cfg.spending.mortgage_payment = 0;
    cfg.medicare.monthly_premium = 0;
    cfg.social_security.social_security_linked = false;
    cfg.social_security.monthly_amount = 0;
    cfg.market_assumptions.market_return_rate = 0;
    cfg.market_assumptions.inflation_rate = 0;
    cfg.market_assumptions.volatility_drag = 0;
    const snap = baseSnap();
    snap.retirement_assets.k401 = 1_000_000;
    return { snap, cfg };
  }

  it("forces the pre-tax balance down once past the RMD age", () => {
    const { snap, cfg } = rmdScenario(80); // age 80 → well past 75
    const traj = runSimulation(snap, cfg, 200);
    // With zero growth and no spending, the only thing moving the 401k is the RMD.
    expect(traj[24].retirement).toBeLessThan(traj[0].retirement);
    // ...and the after-tax proceeds accumulate in cash.
    expect(traj[24].liquidCash).toBeGreaterThan(traj[0].liquidCash);
  });

  it("does not withdraw before the RMD age", () => {
    const { snap, cfg } = rmdScenario(68); // age 68 → below 73/75
    const traj = runSimulation(snap, cfg, 200);
    // No growth, no RMD yet → the pre-tax balance is untouched for years.
    expect(traj[24].retirement).toBeCloseTo(traj[0].retirement, -1);
  });
});

describe("Social Security taxation & early-retiree benefit", () => {
  function ssRetiree(annualRental: number) {
    const cfg = baseConfig();
    cfg.birth_year = YEAR - 68;          // age 68, already claiming
    cfg.career_path.exit_year = YEAR;
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 120_000; // career earnings → PIA
    cfg.income_profile.monthly_rental_income = annualRental / 12;
    cfg.social_security.start_age = 67;
    cfg.spending.monthly_lifestyle = 0;
    cfg.spending.healthcare_premium = 0;
    cfg.spending.mortgage_payment = 0;
    cfg.medicare.monthly_premium = 0;
    return runSimulation(baseSnap(), cfg, 200);
  }

  it("taxes less of the benefit when other income is low (provisional income)", () => {
    const lowIncome = ssRetiree(0)[0].socialSecurityNet;
    const highIncome = ssRetiree(80_000)[0].socialSecurityNet;
    // Same gross benefit; the low-income retiree keeps more of it (≈ untaxed),
    // the high-income retiree has up to 85% of it pulled into taxable income.
    expect(lowIncome).toBeGreaterThan(highIncome);
    expect(lowIncome).toBeGreaterThan(40_000); // essentially untaxed at this income
  });
});

describe("early-retiree Social Security benefit (AIME)", () => {
  it("scales the benefit down for a shorter earnings record", () => {
    const full = estimateMonthlySocialSecurity(120_000, 67, 35);
    const short = estimateMonthlySocialSecurity(120_000, 67, 20);
    // Meaningfully reduced, but not strictly proportional — the progressive PIA
    // bend points give a higher replacement rate on the (now lower) AIME.
    expect(short).toBeLessThan(full * 0.85);
    expect(short).toBeGreaterThan(full * 0.5);
  });

  it("does not boost the benefit beyond a full 35-year record", () => {
    const full = estimateMonthlySocialSecurity(120_000, 67, 35);
    const over = estimateMonthlySocialSecurity(120_000, 67, 45);
    expect(over).toBe(full);
  });
});

describe("spousal Social Security (non-working partner)", () => {
  // A partner with no earnings record still draws SS on the primary's record
  // (up to 50% of the primary's PIA). Build a household with a $0-income partner
  // both already past the claim age and confirm SS exceeds the primary alone.
  function household(partnerSalary: number): SimulationConfiguration {
    const cfg = baseConfig();
    cfg.birth_year = YEAR - 67;          // primary already claiming
    cfg.career_path.exit_year = YEAR - 1;
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 150_000;
    cfg.income_profile.use_partner_income = true;
    cfg.income_profile.partner_gross_annual_salary = partnerSalary;
    cfg.income_profile.partner_birth_year = YEAR - 67; // partner also claiming
    cfg.social_security.start_age = 67;
    return cfg;
  }

  it("pays a non-working partner a spousal benefit (≈50% of primary)", () => {
    const single = runSimulation(baseSnap(), { ...household(0), income_profile: { ...household(0).income_profile, use_partner_income: false } }, 200);
    const couple = runSimulation(baseSnap(), household(0), 200);
    const at = (t: ReturnType<typeof runSimulation>) => t.find(p => p.socialSecurityNet > 0)?.socialSecurityNet ?? 0;
    // The non-working partner adds a spousal benefit on top of the primary's.
    expect(at(couple)).toBeGreaterThan(at(single));
  });

  it("uses the partner's own benefit when it exceeds the spousal amount", () => {
    const lowEarner = runSimulation(baseSnap(), household(0), 200);
    const highEarner = runSimulation(baseSnap(), household(150_000), 200);
    const at = (t: ReturnType<typeof runSimulation>) => t.find(p => p.socialSecurityNet > 0)?.socialSecurityNet ?? 0;
    // A partner who out-earned the 50% spousal floor draws their own (larger) benefit.
    expect(at(highEarner)).toBeGreaterThan(at(lowEarner));
  });
});

describe("healthcare cost realism (medical inflation + LTC)", () => {
  function healthRetiree(): SimulationConfiguration {
    const cfg = baseConfig();
    cfg.birth_year = YEAR - 66;        // retired, on Medicare
    cfg.career_path.exit_year = YEAR;
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 0;
    cfg.spending.monthly_lifestyle = 0;
    cfg.spending.healthcare_premium = 1_200;
    cfg.spending.mortgage_payment = 0;
    cfg.medicare.monthly_premium = 185;
    return cfg;
  }

  it("escalates healthcare faster than general inflation (real growth)", () => {
    const cfg = healthRetiree();
    cfg.market_assumptions.healthcare_inflation_premium = 2;
    const traj = runSimulation(baseSnap(), cfg, 200);
    // healthcareCost is in real dollars; with a +2% real premium it must climb.
    expect(traj[120].healthcareCost).toBeGreaterThan(traj[0].healthcareCost * 1.15);
  });

  it("holds healthcare flat in real terms when the premium is 0", () => {
    const cfg = healthRetiree();
    cfg.market_assumptions.healthcare_inflation_premium = 0;
    const traj = runSimulation(baseSnap(), cfg, 200);
    expect(traj[120].healthcareCost).toBeCloseTo(traj[0].healthcareCost, -1);
  });

  it("adds a long-term-care cost only within the configured window", () => {
    const cfg = healthRetiree();
    cfg.birth_year = YEAR - 70;
    cfg.market_assumptions.healthcare_inflation_premium = 0; // isolate the LTC step
    cfg.spending.ltc_annual_cost = 120_000;
    cfg.spending.ltc_start_age = 82;
    cfg.spending.ltc_years = 3;
    const traj = runSimulation(baseSnap(), cfg, 200);
    const at = (age: number) => traj.find(p => p.date.includes(String(YEAR + (age - 70))))!;
    const before = at(80).healthcareCost; // age 80, pre-LTC
    const during = at(83).healthcareCost; // age 83, mid-LTC
    const after  = at(86).healthcareCost; // age 86, post-LTC
    expect(during).toBeGreaterThan(before + 100_000); // ~+120k/yr while in care
    expect(after).toBeCloseTo(before, -2);             // back to baseline afterward
  });
});

describe("Phase 4 polish: dividend drag & marginal bonus", () => {
  it("drags taxable accounts below sheltered ones at the same return", () => {
    // Equal cash (taxable) and Roth (sheltered) balances, no income/spend, growth on.
    const cfg = idleRetiree();
    cfg.market_assumptions.market_return_rate = 7;
    cfg.market_assumptions.volatility_drag = 0;
    cfg.market_assumptions.inflation_rate = 0;
    cfg.market_assumptions.taxable_dividend_drag = 0.4;
    const snap = baseSnap();
    snap.liquid_assets.cash_savings = 1_000_000; // taxable
    snap.retirement_assets.roth_ira = 1_000_000; // sheltered
    const traj = runSimulation(snap, cfg, 200);
    // After a year the Roth (no drag) is worth more than the taxable cash.
    expect(traj[12].rothBalance).toBeGreaterThan(traj[12].liquidCash);
  });

  it("taxes a bonus at the marginal rate, which exceeds the effective rate at high income", () => {
    // The premise behind netting the bonus at marginal, not effective.
    const t = calculateTax({
      filingStatus: "single", state: "NONE",
      grossIncome: 400_000, longTermCapitalGains: 0, shortTermCapitalGains: 0,
    });
    expect(t.marginalRate).toBeGreaterThan(t.ordinaryEffectiveRate);
  });
});

describe("Medicare IRMAA surcharge (MAGI-based)", () => {
  function medicareRetiree(annualRental: number): SimulationConfiguration {
    const cfg = baseConfig();
    cfg.birth_year = YEAR - 66;          // age 66, on Medicare
    cfg.career_path.exit_year = YEAR;
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 0;
    cfg.income_profile.monthly_rental_income = annualRental / 12;
    cfg.income_profile.rental_income_growth_rate = 0;
    cfg.spending.monthly_lifestyle = 0;
    cfg.spending.healthcare_premium = 0;   // isolate Medicare premium + IRMAA
    cfg.spending.mortgage_payment = 0;
    cfg.medicare.monthly_premium = 185;
    cfg.market_assumptions.inflation_rate = 0;
    cfg.market_assumptions.healthcare_inflation_premium = 0;
    cfg.social_security.social_security_linked = false;
    cfg.social_security.monthly_amount = 0;
    return cfg;
  }

  it("charges a high-income retiree more for Medicare than a low-income one", () => {
    const hi = runSimulation(baseSnap(), medicareRetiree(300_000), 200);
    const lo = runSimulation(baseSnap(), medicareRetiree(0), 200);
    // By year 3+ the 2-years-prior MAGI is established. The high earner pays the
    // base premium plus a sizable IRMAA surcharge; the low earner pays only base.
    expect(hi[40].healthcareCost).toBeGreaterThan(lo[40].healthcareCost + 3_000);
    // Low earner: just the standard premium ($185/mo ≈ $2,220/yr), no surcharge.
    expect(lo[40].healthcareCost).toBeCloseTo(185 * 12, -2);
  });
});

describe("ACA subsidy in early retirement (#11)", () => {
  function earlyRetiree(annualRental: number, cash: number): { snap: FinancialSnapshot; cfg: SimulationConfiguration } {
    const cfg = baseConfig();
    cfg.birth_year = YEAR - 60;            // age 60: retired, pre-Medicare
    cfg.career_path.exit_year = YEAR;
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 0;
    cfg.income_profile.monthly_rental_income = annualRental / 12;
    cfg.income_profile.rental_income_growth_rate = 0;
    cfg.spending.monthly_lifestyle = 3_000;
    cfg.spending.healthcare_premium = 1_000;  // a real premium to subsidize
    cfg.spending.mortgage_payment = 0;
    cfg.market_assumptions.inflation_rate = 0;
    cfg.market_assumptions.healthcare_inflation_premium = 0;
    cfg.tax_optimization.aca_family_size = 1;
    const snap = baseSnap();
    snap.liquid_assets.cash_savings = cash;
    return { snap, cfg };
  }

  it("subsidizes healthcare for a low-MAGI early retiree but not a high-MAGI one", () => {
    const low  = earlyRetiree(0, 2_000_000);        // lives off cash → ~0 MAGI
    const high = earlyRetiree(200_000, 0);          // big rental → high MAGI
    const lowT  = runSimulation(low.snap, low.cfg, 200);
    const highT = runSimulation(high.snap, high.cfg, 200);
    // By year 3 the prior-year MAGI is established and drives the subsidy.
    expect(lowT[36].healthcareCost).toBeLessThan(highT[36].healthcareCost);
    expect(lowT[36].healthcareCost).toBeLessThan(2_000); // heavily subsidized at low income
  });

  it("sizes healthcare by the real household, not a static aca_family_size", () => {
    // A married couple + 2 kids, all pre-Medicare, paying their own coverage.
    // The premium is the full-household figure, so the unsubsidized cost should
    // equal that premium — NOT premium × headcount (the old aca_family_size=1
    // bug divided by 1 and then multiplied by 4).
    const cfg = baseConfig();
    cfg.tax_assumptions.filing_status = "married_joint";
    cfg.birth_year = YEAR - 60;
    cfg.income_profile.partner_birth_year = YEAR - 60;
    cfg.career_path.exit_year = YEAR;
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 0;
    cfg.spending.monthly_lifestyle = 3_000;
    cfg.spending.mortgage_payment = 0;
    cfg.spending.healthcare_premium = 2_000;       // full-household monthly premium
    cfg.market_assumptions.inflation_rate = 0;
    cfg.market_assumptions.healthcare_inflation_premium = 0;
    cfg.tax_optimization.enable_aca_optimization = false; // isolate the per-capita math
    cfg.tax_optimization.aca_family_size = 1;             // must be ignored now
    cfg.children = [{ birthYear: YEAR - 8 }, { birthYear: YEAR - 10 }];
    const snap = baseSnap();
    snap.liquid_assets.cash_savings = 3_000_000;
    const t = runSimulation(snap, cfg, 200);
    // Annualized: ~$2,000/mo × 12 = $24,000, not $96,000.
    expect(t[12].healthcareCost).toBeGreaterThan(23_000);
    expect(t[12].healthcareCost).toBeLessThan(25_000);
  });
});

describe("survivor transition for couples (#14)", () => {
  it("drops to one SS benefit and lower spending after the first death", () => {
    const cfg = baseConfig();
    cfg.tax_assumptions.filing_status = "married_joint";
    cfg.birth_year = YEAR - 65;          // both 65, retired and claiming
    cfg.career_path.exit_year = YEAR;
    cfg.career_path.use_sabbatical = false;
    cfg.career_path.use_jump = false;
    cfg.career_path.use_bridge = false;
    cfg.income_profile.gross_annual_salary = 120_000;       // career earnings → PIA
    cfg.income_profile.use_partner_income = true;
    cfg.income_profile.partner_gross_annual_salary = 120_000;
    cfg.income_profile.partner_birth_year = YEAR - 65;
    cfg.social_security.start_age = 65;
    cfg.spending.monthly_lifestyle = 5_000;
    cfg.spending.healthcare_premium = 0;
    cfg.spending.mortgage_payment = 0;
    cfg.medicare.monthly_premium = 0;
    cfg.market_assumptions.inflation_rate = 0;
    cfg.mortality = { first_death_age: 75, survivor_spending_factor: 0.75 };

    const traj = runSimulation(baseSnap(), cfg, 200);
    const at = (yr: number) => traj.find(p => p.date.includes(String(yr)))!;
    const before = at(YEAR + 5);   // age 70, both alive
    const after  = at(YEAR + 13);  // age 78, survivor

    // Spending falls to the survivor factor (0.75).
    expect(after.lifestyleExpense).toBeCloseTo(before.lifestyleExpense * 0.75, -2);
    // Two roughly-equal benefits collapse to one → survivor SS is well below the couple's.
    expect(after.socialSecurityNet).toBeLessThan(before.socialSecurityNet * 0.7);
  });

  it("leaves a single filer unaffected by the mortality setting", () => {
    const cfg = baseConfig();
    cfg.tax_assumptions.filing_status = "single";
    cfg.birth_year = YEAR - 65;
    cfg.career_path.exit_year = YEAR;
    cfg.spending.monthly_lifestyle = 5_000;
    cfg.market_assumptions.inflation_rate = 0;
    cfg.mortality = { first_death_age: 75, survivor_spending_factor: 0.75 };
    const traj = runSimulation(baseSnap(), cfg, 200);
    const at = (yr: number) => traj.find(p => p.date.includes(String(yr)))!;
    // No couple → no survivor transition → spending unchanged across age 75.
    expect(at(YEAR + 13).lifestyleExpense).toBeCloseTo(at(YEAR + 5).lifestyleExpense, -1);
  });
});

describe("toDisplayDollars — today's vs future dollars", () => {
  it("'today' mode is a no-op (engine already runs in real dollars)", () => {
    const traj = runSimulation(baseSnap(), baseConfig(), 200);
    expect(toDisplayDollars(traj, "today", 3)).toBe(traj);
  });

  it("zero inflation is a no-op even in 'future' mode", () => {
    const traj = runSimulation(baseSnap(), baseConfig(), 200);
    expect(toDisplayDollars(traj, "future", 0)).toBe(traj);
  });

  it("'future' mode leaves month 0 untouched and re-inflates by CPI over time", () => {
    const cfg = baseConfig();
    cfg.market_assumptions.inflation_rate = 3;
    const real = runSimulation(baseSnap(), cfg, 200);
    const nominal = toDisplayDollars(real, "future", 3);

    // Month 0 (today) is unchanged.
    expect(nominal[0].totalNetWorth).toBeCloseTo(real[0].totalNetWorth, 6);

    // After exactly 10 years, every dollar field is scaled by 1.03^10.
    const i = real.findIndex(p => p.monthIndex === 120);
    const f = Math.pow(1.03, 10);
    expect(nominal[i].totalNetWorth).toBeCloseTo(real[i].totalNetWorth * f, 4);
    expect(nominal[i].swrTarget).toBeCloseTo(real[i].swrTarget * f, 4);
  });

  it("preserves non-monetary fields (dates, phase, FI flag)", () => {
    const cfg = baseConfig();
    cfg.market_assumptions.inflation_rate = 3;
    const real = runSimulation(baseSnap(), cfg, 200);
    const nominal = toDisplayDollars(real, "future", 3);
    const i = Math.min(60, real.length - 1);
    expect(nominal[i].date).toBe(real[i].date);
    expect(nominal[i].monthIndex).toBe(real[i].monthIndex);
    expect(nominal[i].currentPhase).toBe(real[i].currentPhase);
    expect(nominal[i].isIndependent).toBe(real[i].isIndependent);
  });
});

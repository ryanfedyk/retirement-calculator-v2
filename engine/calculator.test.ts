import { describe, it, expect } from "vitest";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
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
  return cfg;
}
function idleSnap(cash: number): FinancialSnapshot {
  const snap = baseSnap();
  snap.liquid_assets.cash_savings = cash;
  return snap;
}

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

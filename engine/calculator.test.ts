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
    const snap = baseSnap();
    snap.liquid_assets.cash_savings = 1_000_000;
    const cfg = baseConfig();
    cfg.market_assumptions.market_return_rate = 7;
    cfg.market_assumptions.volatility_drag = 0;
    cfg.spending.monthly_lifestyle = 0;
    cfg.spending.healthcare_premium = 0;
    // Remove income/passive flows that would perturb the pure-growth check.
    cfg.income_profile.gross_annual_salary = 0;
    cfg.social_security.monthly_amount = 0;
    cfg.social_security.social_security_linked = false;

    const traj = runSimulation(snap, cfg, 200);
    const oneYear = traj[12].liquidCash;
    // True monthly compounding of 7%/yr → exactly 7% after 12 months.
    expect(oneYear / 1_000_000).toBeCloseTo(1.07, 2);
  });
});

describe("rental income growth is user-configurable", () => {
  function rentalAfter10y(rate: number): number {
    const cfg = baseConfig();
    cfg.income_profile.monthly_rental_income = 1_000;
    cfg.income_profile.rental_income_growth_rate = rate;
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

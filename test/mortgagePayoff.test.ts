import { describe, it, expect } from "vitest";
import { runSimulation, mortgagePaidOffDate, amortizationMonths } from "@/engine/calculator";
import { DEFAULT_SIM_CONFIG, DEFAULT_SNAPSHOT } from "@/config/sharedConfig";

const snap = () => structuredClone(DEFAULT_SNAPSHOT);
const cfg = () => structuredClone(DEFAULT_SIM_CONFIG);

describe("mortgage payoff on the trajectory", () => {
  it("ends at the amortized month, not a placeholder year", () => {
    const s = snap(); const c = cfg();
    s.liabilities.mortgage_balance = 200_000;
    s.liabilities.mortgage_interest_rate = 4;
    s.liabilities.mortgage_payoff_date = undefined; // force amortization
    c.spending.housing_type = "mortgage";
    c.spending.mortgage_payment = 2_000;

    const traj = runSimulation(s, c, 180);
    const paid = mortgagePaidOffDate(traj);
    expect(paid).not.toBeNull();

    const months = amortizationMonths(200_000, 4, 2_000)!;   // ≈ 122 months (~10 yrs)
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth() + months, 1).getFullYear();
    const gotYear = Number(paid!.split(" ")[1]);
    // Lands on the real amortized year (±1 for the month/rounding boundary) — and
    // nowhere near the old fixed 2051 default.
    expect(Math.abs(gotYear - expected)).toBeLessThanOrEqual(1);
    expect(gotYear).toBeLessThan(2051);
  });

  it("has no payoff for a renter", () => {
    const s = snap(); const c = cfg();
    c.spending.housing_type = "rent";
    c.spending.mortgage_payment = 3_000; // this is rent — perpetual
    expect(mortgagePaidOffDate(runSimulation(s, c, 180))).toBeNull();
  });
});

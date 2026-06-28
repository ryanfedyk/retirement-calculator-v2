// ── Social Security benefit estimate ─────────────────────────────────────────
//
// Estimates the monthly Social Security benefit from the user's income using the
// standard PIA (Primary Insurance Amount) formula and claiming-age adjustment.
//
// This is a planning approximation: it assumes current salary is representative
// of the user's career average indexed earnings (a real SSA estimate uses the
// highest 35 years). Good enough to ballpark; the user can override.

const SS_WAGE_BASE = 176_100; // 2025 taxable maximum
// 2025 PIA bend points (monthly AIME)
const BEND_1 = 1_226;
const BEND_2 = 7_391;
const FRA = 67; // Full retirement age for anyone retiring today

/** The monthly Primary Insurance Amount (PIA) — the benefit at full retirement
 * age, 100% of PIA — for a given annual salary.
 *
 * `yearsWorked` (default 35) models the reality that benefits are based on the
 * highest 35 years of indexed earnings: someone who retires early has
 * zero-earning years dragging the average down. We scale the AIME by
 * yearsWorked/35 (capped at 1) — so a 28-year career yields ~80% of the
 * otherwise-estimated benefit. */
export function estimatePIA(annualSalary: number, yearsWorked = 35): number {
  const cappedSalary = Math.min(Math.max(0, annualSalary || 0), SS_WAGE_BASE);
  const fullAime = cappedSalary / 12; // average indexed monthly earnings (approx)
  // Early retirement → fewer than 35 earning years → zero years dilute the average.
  const aime = fullAime * Math.min(1, Math.max(0, yearsWorked) / 35);

  // PIA: 90% of first bend, 32% to second bend, 15% above.
  return (
    0.9 * Math.min(aime, BEND_1) +
    0.32 * Math.max(0, Math.min(aime, BEND_2) - BEND_1) +
    0.15 * Math.max(0, aime - BEND_2)
  );
}

/** Claiming-age adjustment relative to FRA, applied to the PIA.
 *
 * `spousal` benefits follow different rules: they're reduced for early claiming
 * but earn NO delayed-retirement credits past FRA (capped at 100% of the spousal
 * amount), so the factor never exceeds 1 for them. */
export function claimingFactor(claimAge: number, spousal = false): number {
  if (claimAge >= FRA) {
    // Delayed retirement credits: +8%/yr up to age 70 — own benefit only.
    return spousal ? 1 : 1 + 0.08 * Math.min(claimAge - FRA, 3);
  }
  // Early reduction: 5/9% per month for first 36, 5/12% per month beyond.
  const monthsEarly = (FRA - claimAge) * 12;
  const first = Math.min(monthsEarly, 36) * (5 / 9 / 100);
  const rest = Math.max(0, monthsEarly - 36) * (5 / 12 / 100);
  return Math.max(0, 1 - first - rest);
}

/** Monthly benefit estimate for a given annual salary and claiming age — the
 * worker's own benefit (PIA × claiming-age factor). */
export function estimateMonthlySocialSecurity(annualSalary: number, claimAge: number, yearsWorked = 35): number {
  return Math.round(estimatePIA(annualSalary, yearsWorked) * claimingFactor(claimAge));
}

/** Spousal benefit estimate: up to 50% of the higher earner's PIA, reduced for
 * early claiming. This is why a partner with little or no earnings record still
 * draws Social Security — they claim on their spouse's record. A spouse always
 * receives the GREATER of their own benefit or this spousal amount. */
export function estimateSpousalBenefit(primaryPIA: number, claimAge: number): number {
  return Math.round(0.5 * primaryPIA * claimingFactor(claimAge, true));
}

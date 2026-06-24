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

/** Monthly benefit estimate for a given annual salary and claiming age.
 *
 * `yearsWorked` (default 35) models the reality that benefits are based on the
 * highest 35 years of indexed earnings: someone who retires early has zero-earning
 * years dragging the average down. We scale the AIME by yearsWorked/35 (capped at
 * 1) — so a 28-year career yields ~80% of the otherwise-estimated benefit. */
export function estimateMonthlySocialSecurity(annualSalary: number, claimAge: number, yearsWorked = 35): number {
  const cappedSalary = Math.min(Math.max(0, annualSalary || 0), SS_WAGE_BASE);
  const fullAime = cappedSalary / 12; // average indexed monthly earnings (approx)
  // Early retirement → fewer than 35 earning years → zero years dilute the average.
  const aime = fullAime * Math.min(1, Math.max(0, yearsWorked) / 35);

  // PIA: 90% of first bend, 32% to second bend, 15% above.
  const pia =
    0.9 * Math.min(aime, BEND_1) +
    0.32 * Math.max(0, Math.min(aime, BEND_2) - BEND_1) +
    0.15 * Math.max(0, aime - BEND_2);

  // Claiming-age adjustment relative to FRA.
  let factor: number;
  if (claimAge >= FRA) {
    // Delayed retirement credits: +8%/yr up to age 70.
    factor = 1 + 0.08 * Math.min(claimAge - FRA, 3);
  } else {
    // Early reduction: 5/9% per month for first 36, 5/12% per month beyond.
    const monthsEarly = (FRA - claimAge) * 12;
    const first = Math.min(monthsEarly, 36) * (5 / 9 / 100);
    const rest = Math.max(0, monthsEarly - 36) * (5 / 12 / 100);
    factor = Math.max(0, 1 - first - rest);
  }

  return Math.round(pia * factor);
}

const MMM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The trajectory-point date string for a career exit — "MMM YYYY", matching the
 * engine's point format (calculator.ts) and honoring the 0-indexed `exit_month`
 * (0 = January) so a chart's Retire/Exit flag lands on the right month, not just
 * the start of the exit year.
 */
export function exitDateString(cp: { exit_year: number; exit_month?: number }): string {
  const m = Math.min(11, Math.max(0, Math.round(cp.exit_month ?? 0)));
  return `${MMM[m]} ${cp.exit_year}`;
}

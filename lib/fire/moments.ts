/**
 * FIRE-community "in the know" moments — cost-of-living tiers and net-worth /
 * milestone callouts, with a few winks for those who speak the lingo.
 */

export interface ColTier { code: string; label: string; emoji: string; color: string; }

/** Cost-of-living tier from monthly lifestyle spend (excl. housing). */
export function colTier(monthlySpend: number): ColTier {
  if (monthlySpend >= 7_000) return { code: "VHCOL", label: "Very high cost of living", emoji: "🌃", color: "#c45b6b" };
  if (monthlySpend >= 5_000) return { code: "HCOL",  label: "High cost of living",       emoji: "🏙️", color: "#d98a3d" };
  if (monthlySpend >= 3_000) return { code: "MCOL",  label: "Medium cost of living",     emoji: "🏡", color: "#3a7d9c" };
  return { code: "LCOL", label: "Low cost of living", emoji: "🌾", color: "#2a9d7f" };
}

export interface Milestone {
  id: string;
  title: string;
  sub: string;
  emoji: string;
  /** Becomes active when this metric crosses the threshold. */
  active: (m: FireMetrics) => boolean;
  confetti?: boolean;
}

export interface FireMetrics {
  netWorth: number;
  swrTarget: number;
  isIndependent: boolean;
  savingsRate: number; // 0..1
}

export const MILESTONES: Milestone[] = [
  { id: "comma2", title: "Two Comma Club", sub: "Your net worth crossed $1M 🎉", emoji: "🎉", active: (m) => m.netWorth >= 1_000_000, confetti: true },
  { id: "nw25",   title: "Fat stacks",      sub: "Net worth crossed $2.5M",        emoji: "💰", active: (m) => m.netWorth >= 2_500_000, confetti: true },
  { id: "nw5",    title: "Cruising altitude",sub: "Net worth crossed $5M",         emoji: "🚀", active: (m) => m.netWorth >= 5_000_000, confetti: true },
  { id: "lean",   title: "Lean-FIRE pace",  sub: "Your savings rate is 50%+ — serious tailwind", emoji: "🌬️", active: (m) => m.savingsRate >= 0.5 },
  { id: "fat",    title: "Fat-FIRE pace",   sub: "Saving 70%+ — you're flying",     emoji: "🔥", active: (m) => m.savingsRate >= 0.7, confetti: true },
  { id: "fi",     title: "Financially Independent", sub: "You hit your FI number — 25× your spend 🔥", emoji: "🔥", active: (m) => m.swrTarget > 0 && m.isIndependent, confetti: true },
];

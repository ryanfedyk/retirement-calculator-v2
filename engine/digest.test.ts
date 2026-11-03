import { describe, it, expect } from "vitest";
import { buildDigest, type QuoteLike } from "@/lib/digest/buildDigest";
import { renderDigestHtml, renderDigestText } from "@/lib/digest/renderEmail";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";
import { DEFAULT_SIM_CONFIG, DEFAULT_SNAPSHOT } from "@/config/sharedConfig";

const YEAR = new Date().getFullYear();

function plan(): { snapshot: FinancialSnapshot; config: SimulationConfiguration } {
  const snapshot = structuredClone(DEFAULT_SNAPSHOT);
  snapshot.share_counts.google_shares = 4000;
  snapshot.share_counts.live_stock_price = 180;
  snapshot.liquid_assets.cash_savings = 150_000;
  snapshot.retirement_assets.k401 = 400_000;
  snapshot.other_investments = [
    { name: "VTI", symbol: "VTI", shares: 500, cost_basis: 200, current_price: 270, expected_return: 7 } as any,
  ];
  const config = structuredClone(DEFAULT_SIM_CONFIG);
  config.use_equity_comp = true;
  config.concentrated_symbol = "GOOG";
  config.birth_year = YEAR - 45;
  config.career_path.exit_year = YEAR + 3;
  return { snapshot, config };
}

const quotes: Record<string, QuoteLike> = {
  GOOG: { price: 198, previousClose: 180, changePct: 0.10 },   // +10%
  VTI: { price: 272.7, previousClose: 270, changePct: 0.01 },  // +1%
};

describe("buildDigest", () => {
  it("computes a positive day move from previous closes and lists movers", () => {
    const d = buildDigest({ config: plan().config, snapshot: plan().snapshot, quotes, liveConcentratedPrice: 198 });
    expect(d.portfolio.dayChange).not.toBeNull();
    expect(d.portfolio.dayChange!).toBeGreaterThan(0);
    // GOOG 4000 sh: +$18 => +$72k; VTI 500 sh: +$2.7 => +$1.35k.
    expect(d.portfolio.dayChange!).toBeCloseTo(4000 * 18 + 500 * 2.7, -2);
    expect(d.portfolio.movers[0].symbol).toBe("GOOG"); // biggest move first
    expect(d.portfolio.concentratedSymbol).toBe("GOOG");
    expect(d.portfolio.concentrationPct).toBeGreaterThan(0);
  });

  it("flags heavy concentration and surfaces framing + a holdings note", () => {
    const d = buildDigest({ config: plan().config, snapshot: plan().snapshot, quotes, liveConcentratedPrice: 198 });
    expect(d.keepInMind.some((k) => k.includes("GOOG"))).toBe(true);
    expect(d.framing.seasonName.length).toBeGreaterThan(0);
    expect(d.holdingsNotes.some((h) => h.includes("GOOG"))).toBe(true);
  });

  it("handles missing previous closes (no market data) without throwing", () => {
    const noPrev: Record<string, QuoteLike> = {
      GOOG: { price: 180, previousClose: null, changePct: null },
      VTI: { price: 270, previousClose: null, changePct: null },
    };
    const d = buildDigest({ config: plan().config, snapshot: plan().snapshot, quotes: noPrev, liveConcentratedPrice: 180 });
    expect(d.portfolio.dayChange).toBeNull();
    expect(d.holdingsNotes[0]).toMatch(/quiet session/i);
  });

  it("renders email HTML and text without leaving unfilled placeholders", () => {
    const d = buildDigest({ config: plan().config, snapshot: plan().snapshot, quotes, liveConcentratedPrice: 198 });
    const html = renderDigestHtml(d, { appUrl: "https://example.app" });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("investable");
    expect(html).not.toContain("undefined");
    const text = renderDigestText(d);
    expect(text).toContain("THE ROUNDUP:");
    expect(text).toContain("THE MONEY:");
    expect(text).toContain("THE MARKET & THE MONTHS AHEAD:");
    expect(text).toContain("THOUGHT FOR THE DAY:");
  });

  it("produces a roundup, a market outlook, and a daily thought", () => {
    const d = buildDigest({ config: plan().config, snapshot: plan().snapshot, quotes, liveConcentratedPrice: 198 });
    expect(d.roundup.length).toBeGreaterThan(0);
    expect(d.marketOutlook.length).toBeGreaterThan(20);
    expect(d.motivation.quote.length).toBeGreaterThan(5);
    expect(d.motivation.attribution).toBeTruthy(); // deterministic default has an attribution
  });

  it("produces an editorial lede and at least one milestone", () => {
    const d = buildDigest({ config: plan().config, snapshot: plan().snapshot, quotes, liveConcentratedPrice: 198 });
    expect(d.editorial.length).toBeGreaterThan(20);
    // Plan-intact reassurance is always present.
    expect(["on-track", "tight", "shortfall"]).toContain(d.plan.health);
    expect(d.plan.headline.length).toBeGreaterThan(0);
    expect(d.plan.reassurance.length).toBeGreaterThan(20);
    // Upside is either absent or a well-formed "you could move your date up" note.
    if (d.upside) { expect(typeof d.upside.betterFiYear).toBe("number"); expect(d.upside.note).toMatch(/upside/i); }
    expect(Array.isArray(d.milestones)).toBe(true);
    // The fixture exits in 3 years with a concentrated position → there's always
    // something to mark (a season countdown, a review window, concentration, etc.).
    expect(d.milestones.length).toBeGreaterThan(0);
  });

  it("reports a Monte Carlo number and its day-over-day change", () => {
    const { snapshot, config } = plan();
    const first = buildDigest({ config, snapshot, quotes, liveConcentratedPrice: 198 });
    expect(first.monteCarlo.successRate).toBeGreaterThanOrEqual(0);
    expect(first.monteCarlo.successRate).toBeLessThanOrEqual(1);
    expect(first.monteCarlo.deltaPts).toBeNull(); // no prior → first read
    expect(typeof first.metrics.mcSuccess).toBe("number");

    // Fixed seed → re-running identical inputs gives an identical number, so a
    // "yesterday" equal to today yields a 0-pt delta (signal, not sampling noise).
    const again = buildDigest({ config, snapshot, quotes, liveConcentratedPrice: 198, previous: { mcSuccess: first.metrics.mcSuccess } });
    expect(again.monteCarlo.deltaPts).toBeCloseTo(0, 6);

    // A worse "yesterday" → today reads as an improvement in points.
    const improved = buildDigest({ config, snapshot, quotes, liveConcentratedPrice: 198, previous: { mcSuccess: first.metrics.mcSuccess - 0.02 } });
    expect(improved.monteCarlo.deltaPts!).toBeCloseTo(2, 5);
  });

  it("surfaces a seasonal 'Nth-to-last' milestone as exit approaches", () => {
    const { snapshot, config } = plan();
    config.career_path.exit_year = YEAR + 1; // exit next year → the current season is near its last
    const d = buildDigest({ config, snapshot, quotes, liveConcentratedPrice: 198, now: new Date(YEAR, 0, 15) }); // January
    const hasCountdown = d.milestones.some((m) => /last/.test(m.headline.toLowerCase()));
    expect(hasCountdown).toBe(true);
  });
});

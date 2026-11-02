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
    expect(text).toContain("THE NUMBER:");
    expect(text).toContain("KEEP IN MIND:");
  });

  it("produces an editorial lede and at least one milestone", () => {
    const d = buildDigest({ config: plan().config, snapshot: plan().snapshot, quotes, liveConcentratedPrice: 198 });
    expect(d.editorial.length).toBeGreaterThan(20);
    expect(Array.isArray(d.milestones)).toBe(true);
    // The fixture exits in 3 years with a concentrated position → there's always
    // something to mark (a season countdown, a review window, concentration, etc.).
    expect(d.milestones.length).toBeGreaterThan(0);
  });

  it("surfaces a seasonal 'Nth-to-last' milestone as exit approaches", () => {
    const { snapshot, config } = plan();
    config.career_path.exit_year = YEAR + 1; // exit next year → the current season is near its last
    const d = buildDigest({ config, snapshot, quotes, liveConcentratedPrice: 198, now: new Date(YEAR, 0, 15) }); // January
    const hasCountdown = d.milestones.some((m) => /last/.test(m.headline.toLowerCase()));
    expect(hasCountdown).toBe(true);
  });
});

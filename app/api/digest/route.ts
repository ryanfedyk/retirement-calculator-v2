import { NextResponse } from "next/server";
import { fetchQuotes, fetchMarketTrend } from "@/lib/quotes";
import { buildDigest, MARKET_INDICES } from "@/lib/digest/buildDigest";
import { renderDigestHtml, renderDigestText } from "@/lib/digest/renderEmail";
import { buildMcFanSvg } from "@/lib/digest/charts";
import { svgToPng } from "@/lib/server/raster";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST { profile?, config, snapshot, liveGoogPrice? } [?format=html]
// Builds the daily brief from the posted plan + freshly-fetched quotes. Returns
// { digest, html, text } as JSON, or the raw HTML document when ?format=html (so
// the brief can be opened/screenshotted directly). Scheduled SENDING to your
// inbox is added in a follow-up that reads the plan from Firestore server-side.
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { profile, config, snapshot, liveGoogPrice } = await req.json();
    if (!config || !snapshot) {
      return NextResponse.json({ error: "config and snapshot are required" }, { status: 400 });
    }

    const concSym = config.use_equity_comp ? (config.concentrated_symbol ?? "").toUpperCase() : "";
    const symbols = [
      ...(concSym ? [concSym] : []),
      ...((snapshot.other_investments ?? []).map((i: { symbol?: string }) => (i.symbol ?? "").toUpperCase())),
    ].filter(Boolean);

    const [quotes, marketTrend] = await Promise.all([fetchQuotes(symbols), fetchMarketTrend()]);
    const live = typeof liveGoogPrice === "number" && liveGoogPrice > 0
      ? liveGoogPrice
      : (concSym ? quotes[concSym]?.price ?? 0 : 0);

    const digest = buildDigest({ profile, config, snapshot, quotes, liveConcentratedPrice: live, marketTrend });
    // Preview embeds the fan chart as a data: URI (fine in a browser; the real email
    // send uses a CID attachment instead, which Gmail/Outlook require).
    let mcFan: { src: string; startYear: number; endYear: number } | undefined;
    try {
      const chart = buildMcFanSvg(digest.monteCarlo.bands);
      if (chart) {
        const png = await svgToPng(chart.svg, 1120);
        if (png) mcFan = { src: `data:image/png;base64,${png.toString("base64")}`, startYear: chart.meta.startYear, endYear: chart.meta.endYear };
      }
    } catch { /* no chart */ }
    const html = renderDigestHtml(digest, { mcFan });

    if (searchParams.get("format") === "html") {
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return NextResponse.json({ digest, html, text: renderDigestText(digest) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to build digest";
    return NextResponse.json({ error: "Digest build failed", detail: msg }, { status: 500 });
  }
}

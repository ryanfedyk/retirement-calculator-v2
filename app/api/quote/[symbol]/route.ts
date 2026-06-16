import { NextResponse } from "next/server";

const FALLBACK_PRICES: Record<string, number> = {
  GOOG: 180.00, VTI: 270.00, VFIAX: 520.00,
  VGHCX: 95.00, VSEQX: 48.00, VTIVX: 38.00,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  try {
    // Yahoo Finance v8 quote endpoint
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${upper}?interval=1d&range=1d`;
    const res  = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 }, // cache 60s
    });
    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice as number | undefined;
    if (!price) throw new Error("No price in response");
    return NextResponse.json({ symbol: upper, price, source: "yahoo" });
  } catch {
    const price = FALLBACK_PRICES[upper] ?? 100;
    return NextResponse.json({ symbol: upper, price, source: "fallback" });
  }
}

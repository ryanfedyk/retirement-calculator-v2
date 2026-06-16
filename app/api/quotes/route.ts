import { NextResponse } from "next/server";

const FALLBACK_PRICES: Record<string, number> = {
  GOOG:  180.00,
  GOOGL: 180.00,
  VTI:   270.00,
  VFIAX: 520.00,
  VGHCX:  95.00,
  VSEQX:  48.00,
  VTIVX:  42.00,
  SPY:   530.00,
  QQQ:   460.00,
};

async function fetchOne(symbol: string): Promise<{ price: number; source: "yahoo" | "fallback" }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice as number | undefined;
  if (!price) throw new Error("No price in response");
  return { price, source: "yahoo" };
}

// GET /api/quotes?symbols=GOOG,VTI,VFIAX,VGHCX,VSEQX
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbols") ?? "";
  const symbols = raw
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols.length) {
    return NextResponse.json({ prices: {} });
  }

  // Fetch all in parallel; fall back per-symbol on error
  const settled = await Promise.allSettled(
    symbols.map(sym => fetchOne(sym).then(r => ({ sym, ...r })))
  );

  const prices: Record<string, { price: number; source: "yahoo" | "fallback" }> = {};
  settled.forEach((r, i) => {
    const sym = symbols[i];
    if (r.status === "fulfilled") {
      prices[sym] = { price: r.value.price, source: r.value.source };
    } else {
      prices[sym] = { price: FALLBACK_PRICES[sym] ?? 100, source: "fallback" };
    }
  });

  return NextResponse.json({ prices, fetchedAt: Date.now() });
}

import { NextResponse } from "next/server";

export interface TickerResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

// Offline fallback so the autocomplete still offers sensible picks when Yahoo
// is unreachable (same resilience pattern as the /api/quote* routes).
const FALLBACK_UNIVERSE: TickerResult[] = [
  { symbol: "AAPL",  name: "Apple Inc.",                         exchange: "NMS", type: "EQUITY" },
  { symbol: "MSFT",  name: "Microsoft Corporation",             exchange: "NMS", type: "EQUITY" },
  { symbol: "GOOG",  name: "Alphabet Inc. (Class C)",           exchange: "NMS", type: "EQUITY" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)",           exchange: "NMS", type: "EQUITY" },
  { symbol: "AMZN",  name: "Amazon.com, Inc.",                  exchange: "NMS", type: "EQUITY" },
  { symbol: "NVDA",  name: "NVIDIA Corporation",                exchange: "NMS", type: "EQUITY" },
  { symbol: "META",  name: "Meta Platforms, Inc.",              exchange: "NMS", type: "EQUITY" },
  { symbol: "TSLA",  name: "Tesla, Inc.",                       exchange: "NMS", type: "EQUITY" },
  { symbol: "BRK-B", name: "Berkshire Hathaway Inc.",           exchange: "NYQ", type: "EQUITY" },
  { symbol: "JPM",   name: "JPMorgan Chase & Co.",              exchange: "NYQ", type: "EQUITY" },
  { symbol: "V",     name: "Visa Inc.",                         exchange: "NYQ", type: "EQUITY" },
  { symbol: "VTI",   name: "Vanguard Total Stock Market ETF",   exchange: "PCX", type: "ETF" },
  { symbol: "VOO",   name: "Vanguard S&P 500 ETF",              exchange: "PCX", type: "ETF" },
  { symbol: "SPY",   name: "SPDR S&P 500 ETF Trust",            exchange: "PCX", type: "ETF" },
  { symbol: "QQQ",   name: "Invesco QQQ Trust",                 exchange: "NMS", type: "ETF" },
  { symbol: "VXUS",  name: "Vanguard Total Intl Stock ETF",     exchange: "NMS", type: "ETF" },
  { symbol: "BND",   name: "Vanguard Total Bond Market ETF",    exchange: "NMS", type: "ETF" },
  { symbol: "VFIAX", name: "Vanguard 500 Index Fund Admiral",   exchange: "MUTUALFUND", type: "MUTUALFUND" },
  { symbol: "VTSAX", name: "Vanguard Total Stock Mkt Idx Adm",  exchange: "MUTUALFUND", type: "MUTUALFUND" },
];

function fallbackSearch(q: string): TickerResult[] {
  const needle = q.toLowerCase();
  return FALLBACK_UNIVERSE.filter(
    r => r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)
  ).slice(0, 8);
}

// GET /api/search?q=appl — ticker/company autocomplete
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) return NextResponse.json({ results: [] });

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 }, // cache 5 min — symbol metadata is stable
    });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const data = await res.json();

    const results: TickerResult[] = (data?.quotes ?? [])
      // Tradeable instruments only — drop futures/options/currencies noise.
      .filter((qt: any) => qt?.symbol && (qt.quoteType === "EQUITY" || qt.quoteType === "ETF" || qt.quoteType === "MUTUALFUND"))
      .map((qt: any) => ({
        symbol:   String(qt.symbol).toUpperCase(),
        name:     qt.shortname || qt.longname || qt.symbol,
        exchange: qt.exchDisp || qt.exchange,
        type:     qt.quoteType,
      }))
      .slice(0, 8);

    // Yahoo occasionally returns nothing for a valid prefix — fall back rather
    // than show an empty list.
    return NextResponse.json({ results: results.length ? results : fallbackSearch(q) });
  } catch {
    return NextResponse.json({ results: fallbackSearch(q), source: "fallback" });
  }
}

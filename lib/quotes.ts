// Shared market-quote fetcher. Used by the /api/quotes client endpoint and the
// daily-digest builder, so both price holdings the same way and the digest can
// report day-over-day moves (which need the previous close, not just the price).

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number | null;
  change: number | null;      // price − previousClose (null if no prev close)
  changePct: number | null;   // change / previousClose (fraction, e.g. 0.012 = +1.2%)
  source: "yahoo" | "fallback";
}

// Last-resort prices so a blocked/slow Yahoo never collapses a portfolio to $0.
export const FALLBACK_PRICES: Record<string, number> = {
  GOOG: 180.0, GOOGL: 180.0, VTI: 270.0, VFIAX: 520.0, VGHCX: 95.0,
  VSEQX: 48.0, VTIVX: 42.0, SPY: 530.0, QQQ: 460.0,
};

async function fetchOne(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  // Hard timeout so a slow or network-policy-blocked Yahoo can't hang the request.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice as number | undefined;
    if (!price) throw new Error("No price in response");
    const previousClose = (meta?.previousClose ?? meta?.chartPreviousClose ?? null) as number | null;
    const change = previousClose != null ? price - previousClose : null;
    const changePct = previousClose ? change! / previousClose : null;
    return { symbol, price, previousClose, change, changePct, source: "yahoo" };
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch quotes for the given symbols in parallel, falling back per-symbol on
 *  error. Symbols are upper-cased and de-duplicated. */
export async function fetchQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const uniq = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (!uniq.length) return {};
  const settled = await Promise.allSettled(uniq.map((sym) => fetchOne(sym)));
  const out: Record<string, Quote> = {};
  settled.forEach((r, i) => {
    const sym = uniq[i];
    out[sym] = r.status === "fulfilled"
      ? r.value
      : { symbol: sym, price: FALLBACK_PRICES[sym] ?? 100, previousClose: null, change: null, changePct: null, source: "fallback" };
  });
  return out;
}

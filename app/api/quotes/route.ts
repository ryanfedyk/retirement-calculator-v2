import { NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/quotes";

// GET /api/quotes?symbols=GOOG,VTI,VFIAX,VGHCX,VSEQX
// Returns { prices: { SYM: { price, source, previousClose, change, changePct } } }.
// `price`/`source` are unchanged; the day-change fields are additive.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  if (!symbols.length) return NextResponse.json({ prices: {} });

  const quotes = await fetchQuotes(symbols);
  const prices: Record<string, { price: number; source: "yahoo" | "fallback"; previousClose: number | null; change: number | null; changePct: number | null }> = {};
  for (const sym of symbols) {
    const q = quotes[sym];
    if (q) prices[sym] = { price: q.price, source: q.source, previousClose: q.previousClose, change: q.change, changePct: q.changePct };
  }
  return NextResponse.json({ prices, fetchedAt: Date.now() });
}

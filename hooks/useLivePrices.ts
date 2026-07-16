"use client";
/**
 * useLivePrices — fetches live quotes for every symbol in the portfolio and
 * keeps them fresh. Lifted out of FinancialDashboard so the Scenarios hub and
 * the financial deep-dive can share one set of prices (one fetch, one source).
 */
import { useState, useEffect, useCallback } from "react";
import { useFinancialStore } from "@/store/useFinancialStore";

export interface PriceInfo { price: number; source: "yahoo" | "fallback"; }
export type LivePrices = Record<string, PriceInfo>; // keyed by UPPERCASE symbol

export function useLivePrices({ enabled = true }: { enabled?: boolean } = {}) {
  const holdings = useFinancialStore((s) => s.snapshot.other_investments);

  const [livePrices, setLivePrices] = useState<LivePrices>({});
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState<Date | null>(null);
  const [pricesFetching, setPricesFetching] = useState(false);

  const refresh = useCallback(async () => {
    const symbols = [...new Set((holdings ?? []).map((inv) => inv.symbol.toUpperCase()))];
    if (!symbols.length) return;

    setPricesFetching(true);
    try {
      const res = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
      const data = (await res.json()) as { prices: LivePrices };
      setLivePrices(data.prices ?? {});
      // Persist last-known prices so a later outage can't zero out holdings.
      useFinancialStore.getState().cacheLivePrices(
        Object.fromEntries(Object.entries(data.prices ?? {}).map(([k, v]) => [k, v.price])),
      );
      setPricesUpdatedAt(new Date());
    } catch {
      // keep stale prices; UI shows "fallback" badges
    } finally {
      setPricesFetching(false);
    }
  }, [holdings]);

  // Fetch on mount; re-fetch when holdings change (user adds/removes tickers)
  useEffect(() => { if (enabled) refresh(); }, [enabled, refresh]);

  return { livePrices, pricesUpdatedAt, pricesFetching, refresh };
}

"use client";
import { useState, useEffect, useCallback } from "react";
import LeftPanel  from "./LeftPanel";
import RightPanel from "./RightPanel";
import ScenarioBar from "./ScenarioBar";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";

// ── Shared type for live prices ───────────────────────────────────────────────
export interface PriceInfo { price: number; source: "yahoo" | "fallback"; }
export type LivePrices = Record<string, PriceInfo>; // keyed by UPPERCASE symbol

export default function FinancialDashboard() {
  const { snapshot } = useFinancialStore();

  const [livePrices,      setLivePrices]     = useState<LivePrices>({});
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState<Date | null>(null);
  const [pricesFetching,  setPricesFetching]  = useState(false);

  const fetchAllPrices = useCallback(async () => {
    // Collect unique symbols from the portfolio
    const symbols = [
      ...new Set(
        (snapshot.other_investments ?? []).map(inv => inv.symbol.toUpperCase())
      ),
    ];
    if (!symbols.length) return;

    setPricesFetching(true);
    try {
      const res  = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
      const data = await res.json() as { prices: LivePrices };
      setLivePrices(data.prices ?? {});
      setPricesUpdatedAt(new Date());
    } catch {
      // keep stale prices; UI shows "fallback" badges
    } finally {
      setPricesFetching(false);
    }
  }, [snapshot.other_investments]);

  // Fetch on mount; re-fetches when holdings change (user adds/removes tickers)
  useEffect(() => { fetchAllPrices(); }, [fetchAllPrices]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)", background: C.bg }}>
      <ScenarioBar livePrices={livePrices} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <LeftPanel
          livePrices={livePrices}
        />
        <RightPanel
          livePrices={livePrices}
          pricesUpdatedAt={pricesUpdatedAt}
          pricesFetching={pricesFetching}
          onRefreshPrices={fetchAllPrices}
        />
      </div>
    </div>
  );
}

"use client";
import { RefreshCw } from "lucide-react";
import { C } from "@/config/colors";
import type { LivePrices } from "./FinancialDashboard";
import type { FinancialSnapshot } from "@/engine/calculator";

/**
 * Live-price ticker built from the user's manually-entered portfolio holdings
 * (snapshot.other_investments). Replaces the old hardcoded GOOG bar so each
 * account shows tickers for whatever symbols they actually own.
 */
export default function PriceTicker({
  holdings,
  livePrices,
  concentratedSymbol,
  pricesUpdatedAt,
  pricesFetching = false,
  onRefreshPrices,
  align = "end",
}: {
  holdings: FinancialSnapshot["other_investments"];
  livePrices: LivePrices;
  /** The user's employer/equity stock — always pinned when held. */
  concentratedSymbol?: string;
  pricesUpdatedAt?: Date | null;
  pricesFetching?: boolean;
  onRefreshPrices?: () => void;
  align?: "start" | "end";
}) {
  // Don't list every holding — keep the bar focused: the company/employer stock
  // (awarded through their job) plus their single largest position.
  const held = (holdings ?? []).filter((h) => h.symbol);
  const valueOf = (h: { symbol: string; shares: number; current_price: number }) =>
    h.shares * (livePrices[h.symbol.toUpperCase()]?.price ?? h.current_price ?? 0);
  const concSym = (concentratedSymbol ?? "").toUpperCase();

  const symbols: string[] = [];
  if (concSym && held.some((h) => h.symbol.toUpperCase() === concSym)) symbols.push(concSym);
  const largest = held.reduce<typeof held[number] | null>((best, h) => (!best || valueOf(h) > valueOf(best) ? h : best), null);
  if (largest) {
    const s = largest.symbol.toUpperCase();
    if (!symbols.includes(s)) symbols.push(s);
  }

  const wrap: React.CSSProperties = {
    display: "flex",
    justifyContent: align === "end" ? "flex-end" : "flex-start",
  };

  // No holdings yet — gentle prompt instead of an empty bar.
  if (symbols.length === 0) {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 14px" }}>
          <span style={{ fontSize: 11, color: C.inkSoft }}>Add portfolio holdings to see live prices</span>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20,
          padding: "6px 14px", maxWidth: "100%", overflowX: "auto",
        }}
      >
        {symbols.map((sym) => {
          const info = livePrices[sym];
          return (
            <span key={sym} style={{ display: "inline-flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.inkMid }}>{sym}</span>
              <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: C.ink }}>
                {info?.price ? `$${info.price.toFixed(2)}` : "–"}
              </span>
            </span>
          );
        })}
        {pricesUpdatedAt && (
          <span style={{ flexShrink: 0, fontSize: 9, color: C.inkFaint, letterSpacing: "0.03em" }}>
            {pricesUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {onRefreshPrices && (
          <button
            onClick={onRefreshPrices}
            disabled={pricesFetching}
            aria-label="Refresh prices"
            style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: C.teal, display: "flex", alignItems: "center", padding: 0 }}
          >
            <RefreshCw size={12} style={{ animation: pricesFetching ? "spin 1s linear infinite" : "none" }} />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useRef } from "react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useRecordSnapshot } from "./useRecordSnapshot";
import type { LivePrices } from "@/components/finance/FinancialDashboard";

/**
 * Records one snapshot of the PRIMARY plan per calendar month (net worth,
 * spendable assets, and the projected FI date), building the plan-history trail
 * shown in Finances. The store no-ops if the current month is already captured.
 *
 * Holdings are stored with `current_price: 0` — their real prices (and the
 * concentrated RSU position's) come ONLY from the live-quote fetch. Recording
 * before those load would value every holding at $0 and badly understate net
 * worth. So when the plan holds any positions, this waits until live prices have
 * arrived; the effect re-runs as `livePrices` updates, then captures once.
 * (The actual compute-and-record lives in useRecordSnapshot, shared with the
 * manual "Record snapshot" control.)
 */
export function useMonthlyPlanSnapshot(livePrices: LivePrices) {
  const recorded = useRef(false);
  const snapshot = useFinancialStore((s) => s.snapshot);
  const record = useRecordSnapshot(livePrices);

  useEffect(() => {
    if (recorded.current) return;

    // Wait for live prices before recording if the plan holds any positions,
    // otherwise every holding (vested RSUs included) values to $0.
    const hasHoldings = (snapshot.other_investments?.length ?? 0) > 0;
    const pricesReady = Object.keys(livePrices).length > 0;
    if (hasHoldings && !pricesReady) return;

    if (record()) recorded.current = true;
  }, [snapshot, livePrices, record]);
}

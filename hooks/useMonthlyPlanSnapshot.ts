"use client";
import { useEffect, useRef } from "react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
import type { LivePrices } from "@/components/finance/FinancialDashboard";

/**
 * Records one snapshot of the PRIMARY plan per calendar month (net worth,
 * spendable assets, and the projected FI date), building the plan-history trail
 * shown in Finances. The store no-ops if the current month is already captured,
 * so this can run freely on load — it fires once per session, using whatever
 * live prices are available (falling back to the snapshot's stored prices).
 */
export function useMonthlyPlanSnapshot(livePrices: LivePrices) {
  const recorded = useRef(false);
  const scenarios = useFinancialStore((s) => s.scenarios);
  const primaryScenarioId = useFinancialStore((s) => s.primaryScenarioId);
  const snapshot = useFinancialStore((s) => s.snapshot);
  const recordHistoryPoint = useFinancialStore((s) => s.recordHistoryPoint);

  useEffect(() => {
    if (recorded.current) return;
    const primary = scenarios.find((sc) => sc.id === primaryScenarioId) ?? scenarios[0];
    if (!primary) return;
    recorded.current = true;

    const liveGoog = livePrices["GOOG"]?.price ?? livePrices["GOOGL"]?.price ?? 0;
    const enriched = {
      ...snapshot,
      other_investments: (snapshot.other_investments ?? []).map((inv) => {
        const info = livePrices[inv.symbol.toUpperCase()];
        return info ? { ...inv, current_price: info.price } : inv;
      }),
    };

    const points = runSimulation(enriched, primary.config, liveGoog);
    const today = points[0];
    if (!today) return;
    const fi = findIndependencePoint(points);
    recordHistoryPoint({
      netWorth: today.totalNetWorth,
      spendable: today.investableAfterTax,
      swrTarget: today.swrTarget,
      fiDate: fi?.date ?? null,
      scenarioName: primary.name,
    });
  }, [scenarios, primaryScenarioId, snapshot, livePrices, recordHistoryPoint]);
}

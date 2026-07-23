"use client";
import { useCallback } from "react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
import type { LivePrices } from "@/components/finance/FinancialDashboard";

/**
 * Compute-and-record one plan-history snapshot of the PRIMARY plan (net worth,
 * spendable, FI Number, projected FI date) into the monthly trail. Shared by the
 * automatic monthly capture (useMonthlyPlanSnapshot) and the manual "Record
 * snapshot" control.
 *
 * Holdings carry `current_price: 0`; their real prices (and the concentrated RSU
 * position's) come only from the live-quote fetch, so we enrich with `livePrices`
 * before simulating — otherwise every holding would value to $0. Returns a
 * `record()` that returns true when a point was written, false if it couldn't
 * (no primary scenario / no simulation output).
 */
export function useRecordSnapshot(livePrices: LivePrices) {
  const scenarios = useFinancialStore((s) => s.scenarios);
  const primaryScenarioId = useFinancialStore((s) => s.primaryScenarioId);
  const snapshot = useFinancialStore((s) => s.snapshot);
  const recordHistoryPoint = useFinancialStore((s) => s.recordHistoryPoint);

  return useCallback((): boolean => {
    const primary = scenarios.find((sc) => sc.id === primaryScenarioId) ?? scenarios[0];
    if (!primary) return false;

    const concSym = primary.config.use_equity_comp ? (primary.config.concentrated_symbol ?? "").toUpperCase() : "";
    const concPrice = concSym ? (livePrices[concSym]?.price ?? 0) : 0;
    const enriched = {
      ...snapshot,
      other_investments: (snapshot.other_investments ?? []).map((inv) => {
        const info = livePrices[inv.symbol.toUpperCase()];
        return info ? { ...inv, current_price: info.price } : inv;
      }),
    };

    const points = runSimulation(enriched, primary.config, concPrice);
    const today = points[0];
    if (!today) return false;
    const fi = findIndependencePoint(points);
    recordHistoryPoint({
      netWorth: today.totalNetWorth,
      spendable: today.investableAfterTax,
      swrTarget: today.swrTarget,
      fiDate: fi?.date ?? null,
      scenarioName: primary.name,
    });
    return true;
  }, [scenarios, primaryScenarioId, snapshot, livePrices, recordHistoryPoint]);
}

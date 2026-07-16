"use client";
import { useEffect, useRef } from "react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
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

    // Wait for live prices before recording if the plan holds any positions,
    // otherwise every holding (vested RSUs included) values to $0.
    const hasHoldings = (snapshot.other_investments?.length ?? 0) > 0;
    const pricesReady = Object.keys(livePrices).length > 0;
    if (hasHoldings && !pricesReady) return;

    recorded.current = true;

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

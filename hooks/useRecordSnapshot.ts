"use client";
import { useCallback } from "react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulationConverged, findCashflowFiPoint, assessPlan } from "@/engine/calculator";
import type { LivePrices } from "@/components/finance/FinancialDashboard";

/**
 * Compute-and-record one plan-history snapshot of the PRIMARY plan (net worth,
 * spendable, FI Number, projected FI date) into the monthly trail. Shared by the
 * automatic monthly capture (useMonthlyPlanSnapshot) and the manual "Record
 * snapshot" control.
 *
 * Holdings carry `current_price: 0`; their real prices (and the concentrated RSU
 * position's) come only from the live-quote fetch, so we enrich with `livePrices`
 * before simulating — otherwise every holding would value to $0.
 *
 * The net worth / spendable / FI Number / FI date are computed EXACTLY as the
 * Trajectory summary cards do — the converged run (runSimulationConverged), the
 * cash-flow FI point (findCashflowFiPoint), and the same "on-track" gating — so a
 * recorded snapshot always matches what the card shows for the primary plan.
 *
 * Returns `record(mode)`: "month" refreshes the current month's point (the
 * automatic trail); "manual" appends a distinct, timestamped capture. Returns
 * true when a point was written, false if it couldn't (no primary scenario / no
 * simulation output).
 */
export function useRecordSnapshot(livePrices: LivePrices) {
  const scenarios = useFinancialStore((s) => s.scenarios);
  const primaryScenarioId = useFinancialStore((s) => s.primaryScenarioId);
  const snapshot = useFinancialStore((s) => s.snapshot);
  const recordHistoryPoint = useFinancialStore((s) => s.recordHistoryPoint);
  const addManualSnapshot = useFinancialStore((s) => s.addManualSnapshot);

  return useCallback((mode: "month" | "manual" = "month"): boolean => {
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

    // Match the Trajectory card: converged run, cash-flow FI, on-track gating.
    const traj = runSimulationConverged(enriched, primary.config, concPrice);
    const today = traj[0];
    if (!today) return false;
    const fiPoint = findCashflowFiPoint(enriched, primary.config, concPrice, traj);
    const onTrack = assessPlan(traj).health === "on-track";
    const pt = {
      netWorth: today.totalNetWorth,
      spendable: today.investableAfterTax,
      swrTarget: today.swrTarget,
      fiDate: onTrack && fiPoint ? fiPoint.date : null,
      scenarioName: primary.name,
    };
    (mode === "manual" ? addManualSnapshot : recordHistoryPoint)(pt);
    return true;
  }, [scenarios, primaryScenarioId, snapshot, livePrices, recordHistoryPoint, addManualSnapshot]);
}

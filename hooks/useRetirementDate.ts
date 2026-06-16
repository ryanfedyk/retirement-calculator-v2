"use client";
/**
 * useRetirementDate — single source of truth for the live retirement date.
 *
 * Reads from useFinancialStore so that changes made in the Financial tab
 * (exit year, sabbatical, jump, bridge toggles) are immediately reflected
 * in every Forecasting component that calls this hook.
 *
 * "Google Exit Date" = when Ryan leaves Google (the Taper target).
 * "True Retirement Date" = after any post-Google phases (sabbatical / jump / bridge).
 * The flight map and countdown count down to the Google exit date.
 */
import { useMemo } from "react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { PERSONAL } from "@/config/sharedConfig";

export function useRetirementDate() {
  const cp = useFinancialStore(s => s.config.career_path);

  // True full-retirement year = exit + any post-Google phases
  let trueYear = cp.exit_year;
  if (cp.use_sabbatical) trueYear += cp.sabbatical_duration;
  if (cp.use_jump)       trueYear += cp.jump_duration;
  if (cp.use_bridge)     trueYear += cp.bridge_duration;

  // Memoize Date objects on primitive deps so their references stay stable
  // across renders. Without this, every render produces fresh Date instances,
  // which breaks downstream useMemo/useEffect dependency checks (infinite loop).
  const googleExitDate = useMemo(
    () => new Date(cp.exit_year, PERSONAL.retirementMonth, 1),
    [cp.exit_year]
  );
  const trueRetirementDate = useMemo(
    () => new Date(trueYear, PERSONAL.retirementMonth, 1),
    [trueYear]
  );

  return {
    /** Date Ryan leaves Google — primary countdown / flight map target */
    retirementDate:      googleExitDate,
    /** Date after all post-Google career phases */
    trueRetirementDate,
    exitYear:            cp.exit_year,
    trueRetirementYear:  trueYear,
    hasPostGooglePhases: cp.use_sabbatical || cp.use_jump || cp.use_bridge,
  };
}

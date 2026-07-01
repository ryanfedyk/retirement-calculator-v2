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

export function useRetirementDate() {
  const cp = useFinancialStore(s => s.config.career_path);
  const profileMonth = useFinancialStore(s => s.profile.retirementMonth);
  // The scenario's own exit month is the source of truth; fall back to the profile.
  const retirementMonth = cp.exit_month ?? profileMonth ?? 0;

  // True full-retirement year = exit + any post-Google phases
  let trueYear = cp.exit_year;
  if (cp.use_sabbatical) trueYear += cp.sabbatical_duration;
  if (cp.use_jump)       trueYear += cp.jump_duration;
  if (cp.use_bridge)     trueYear += cp.bridge_duration;

  // Memoize Date objects on primitive deps so their references stay stable
  // across renders. Without this, every render produces fresh Date instances,
  // which breaks downstream useMemo/useEffect dependency checks (infinite loop).
  const googleExitDate = useMemo(
    () => new Date(cp.exit_year, retirementMonth, 1),
    [cp.exit_year, retirementMonth]
  );
  const trueRetirementDate = useMemo(
    () => new Date(trueYear, retirementMonth, 1),
    [trueYear, retirementMonth]
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

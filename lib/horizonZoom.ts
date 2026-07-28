/**
 * Horizon zoom for the trajectory charts — three levels instead of two:
 *  - "full":  the whole horizon (to ~age 100)
 *  - "focus": to age 70 (the default)
 *  - "near":  the next ~10 years, for a close-up on the years just ahead
 */
export type HorizonZoom = "near" | "focus" | "full";

/** The last calendar year visible at each zoom level. */
export function horizonCapYear(zoom: HorizonZoom, birthYear: number, currentYear: number): number {
  if (zoom === "full") return Infinity;
  if (zoom === "focus") return birthYear + 70;
  return currentYear + 10; // near
}

export const horizonZoomIn = (z: HorizonZoom): HorizonZoom => (z === "full" ? "focus" : "near");
export const horizonZoomOut = (z: HorizonZoom): HorizonZoom => (z === "near" ? "focus" : "full");

/** A short human phrase for the current scope, e.g. "the next 10 years" / "age 70". */
export function horizonScope(zoom: HorizonZoom): string {
  return zoom === "near" ? "the next 10 years" : zoom === "focus" ? "age 70" : "age 100";
}

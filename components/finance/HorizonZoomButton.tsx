"use client";
import { ZoomIn, ZoomOut } from "lucide-react";
import { C } from "@/config/colors";

/**
 * A small magnifier that toggles a chart's horizon between the focused (to age
 * 70) and full (to age 100) views. Renders as a floating control in the
 * bottom-right of the graph — the parent must be `position: relative`. Shows the
 * zoom-IN glass when fully zoomed out (at 100) and zoom-OUT when focused (at 70).
 */
export default function HorizonZoomButton({
  ageCap,
  onToggle,
  size = 32,
}: {
  ageCap: 70 | 100;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      onClick={onToggle}
      title={ageCap === 100 ? "Zoom in — focus on the years to age 70" : "Zoom out — show the full horizon to age 100"}
      aria-label={ageCap === 100 ? "Zoom in to age 70" : "Zoom out to age 100"}
      style={{
        position: "absolute", right: 24, bottom: 52, zIndex: 3,
        display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size,
        borderRadius: 8, border: `1px solid ${C.border}`, background: `${C.bgCard}f0`,
        color: C.inkMid, cursor: "pointer", boxShadow: `0 1px 4px ${C.border}`, backdropFilter: "blur(2px)",
      }}
    >
      {ageCap === 100 ? <ZoomIn size={size * 0.5} /> : <ZoomOut size={size * 0.5} />}
    </button>
  );
}

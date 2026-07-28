"use client";
import { ZoomIn, ZoomOut } from "lucide-react";
import { C } from "@/config/colors";
import type { HorizonZoom } from "@/lib/horizonZoom";

/**
 * A compact zoom control for a chart's horizon, with three levels: the next
 * 10 years (near) → age 70 (focus) → the full horizon (full). Renders a
 * stacked +/- pair floating in the bottom-right of the graph — the parent must
 * be `position: relative`. Each button dims at the extreme it can't go past.
 */
export default function HorizonZoomButton({
  zoom,
  onZoomIn,
  onZoomOut,
  size = 32,
}: {
  zoom: HorizonZoom;
  onZoomIn: () => void;
  onZoomOut: () => void;
  size?: number;
}) {
  const canIn = zoom !== "near";
  const canOut = zoom !== "full";
  const base: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size,
    border: `1px solid ${C.border}`, background: `${C.bgCard}f0`, color: C.inkMid,
    boxShadow: `0 1px 4px ${C.border}`, backdropFilter: "blur(2px)",
  };
  return (
    <div style={{ position: "absolute", right: 24, bottom: 52, zIndex: 3, display: "flex", flexDirection: "column" }}>
      <button
        onClick={canIn ? onZoomIn : undefined} disabled={!canIn}
        title={zoom === "full" ? "Zoom in — focus to age 70" : "Zoom in — the next 10 years"}
        aria-label="Zoom in"
        style={{ ...base, borderRadius: "8px 8px 0 0", borderBottom: "none", cursor: canIn ? "pointer" : "default", opacity: canIn ? 1 : 0.4 }}
      >
        <ZoomIn size={size * 0.5} />
      </button>
      <button
        onClick={canOut ? onZoomOut : undefined} disabled={!canOut}
        title={zoom === "near" ? "Zoom out — back to age 70" : "Zoom out — the full horizon"}
        aria-label="Zoom out"
        style={{ ...base, borderRadius: "0 0 8px 8px", cursor: canOut ? "pointer" : "default", opacity: canOut ? 1 : 0.4 }}
      >
        <ZoomOut size={size * 0.5} />
      </button>
    </div>
  );
}

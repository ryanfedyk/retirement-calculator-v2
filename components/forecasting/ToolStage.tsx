"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { R, SERIF } from "./reclaimTheme";

/**
 * A full-viewport immersive frame for a launched forecasting tool. The section
 * itself is a quiet hub of tool cards; tapping one opens it here — a focused
 * canvas on the warm-grey ground, above the app chrome, with a pinned title bar
 * and a clear way back. Locks the page behind it and closes on Escape.
 *
 * `fill` decides how the body behaves: false (default) scrolls the tool as one
 * column; true hands a flex-column of full height to the child so it can pin its
 * own header/footer and scroll internally (used by the Design flow).
 */
export default function ToolStage({
  eyebrow, title, onClose, children, fill = false,
}: {
  eyebrow?: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  fill?: boolean;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1600, background: R.ground,
      height: "100dvh", display: "flex", flexDirection: "column",
      padding: "max(14px, env(safe-area-inset-top)) 18px calc(14px + env(safe-area-inset-bottom))",
      animation: "toolstage-rise 0.28s ease",
    }}>
      <style>{"@keyframes toolstage-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>

      {/* Pinned title bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, paddingBottom: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {eyebrow && (
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: R.accentInk, marginBottom: 3 }}>{eyebrow}</div>
          )}
          <div style={{ fontFamily: SERIF, fontSize: "clamp(21px, 5.5vw, 27px)", fontWeight: 500, color: R.ink, letterSpacing: "-0.01em", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "50%",
          border: `1px solid ${R.line}`, background: R.card, color: R.inkSoft, cursor: "pointer",
        }}><X size={18} /></button>
      </div>

      {/* Body */}
      <div style={fill
        ? { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }
        : { flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", margin: "0 -2px", padding: "2px 2px 8px", WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}>
        {children}
      </div>
    </div>
  );
}

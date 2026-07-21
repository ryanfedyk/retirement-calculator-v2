"use client";
import { useEffect, useRef, useState } from "react";
import { C } from "@/config/colors";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Fixed header (title/close) drawn above the scroll area; the drag handle is
   *  rendered automatically above it. */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Viewport fraction visible at the resting (partial) detent. */
  restFraction?: number;
  /** Viewport fraction at the fully-expanded detent (the sheet's actual height). */
  fullFraction?: number;
  zIndex?: number;
}

/**
 * A proper detented bottom sheet. It opens at a **partial** height; an upward
 * swipe (or "scrolling down" a list) expands it to **full**; once full and
 * scrolled back to the top, a further downward pull collapses it to partial, and
 * a pull past partial dismisses it. The sheet is always `fullFraction` tall and is
 * translated down to reveal only the partial detent, so expanding is a cheap
 * transform. Content scrolls natively at the full detent; the gesture only drives
 * the sheet when the content can't scroll in that direction.
 */
export default function BottomSheet({
  open, onClose, header, children,
  restFraction = 0.6, fullFraction = 0.94, zIndex = 200,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState(0);         // live finger offset in px (0 when settled)
  const [dragging, setDragging] = useState(false);

  // Percent of the sheet's OWN height to hide at the partial detent (so the
  // translate needs no viewport-pixel math and survives browser-chrome resizes).
  const hidePct = Math.max(0, (1 - restFraction / fullFraction) * 100);

  useEffect(() => {
    if (open) { setExpanded(false); setDrag(0); requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 })); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Native touch listeners — touchmove must be non-passive so it can preventDefault
  // (React's onTouchMove is passive and can't stop native scroll).
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !open) return;
    let startY = 0, lastY = 0, active = false, sheetMode = false, t0 = 0;

    const start = (e: TouchEvent) => {
      startY = lastY = e.touches[0].clientY; t0 = Date.now(); active = true; sheetMode = false;
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      const y = e.touches[0].clientY; const dy = y - startY; lastY = y;
      const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
      if (!sheetMode) {
        if (Math.abs(dy) < 5) return;
        // Does this gesture move the SHEET or scroll the CONTENT?
        if (!expanded) sheetMode = true;               // partial: the sheet always moves
        else if (atTop && dy > 0) sheetMode = true;    // full, at top, pulling down → collapse
        else { active = false; return; }               // full + scrolling → hand off to native scroll
        setDragging(true);
      }
      e.preventDefault();
      // Don't let an upward drag pull the sheet above the full detent.
      const basePx = expanded ? 0 : ((fullFraction - restFraction) * window.innerHeight);
      setDrag(basePx + dy < 0 ? -basePx : dy);
    };
    const end = () => {
      if (!active && !sheetMode) return;
      const dy = lastY - startY; const v = dy / Math.max(1, Date.now() - t0);
      if (sheetMode) {
        if (!expanded) {
          if (dy < -50 || v < -0.35) setExpanded(true);         // pulled up → expand
          else if (dy > 90 || v > 0.45) onClose();              // pulled down → dismiss
        } else if (dy > 90 || v > 0.45) {
          setExpanded(false);                                    // pulled down at top → collapse
        }
      }
      setDrag(0); setDragging(false); active = false; sheetMode = false;
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [open, expanded, onClose, fullFraction, restFraction]);

  const transform = open
    ? `translateY(calc(${expanded ? 0 : hidePct}% + ${drag}px))`
    : "translateY(110%)";

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex, background: "rgba(20,30,28,0.42)", backdropFilter: "blur(2px)",
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.28s ease",
      }} />
      <div ref={sheetRef} style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: zIndex + 1,
        height: `${fullFraction * 100}dvh`,
        background: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        transform,
        transition: dragging ? "none" : "transform 0.34s cubic-bezier(0.32,0.72,0,1)",
        display: "flex", flexDirection: "column",
        pointerEvents: open ? "auto" : "none",
      }}>
        {/* Grab handle — tapping it also toggles the detent, as an alternative to dragging. */}
        <div
          onClick={() => setExpanded((v) => !v)}
          style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 0 6px", cursor: "pointer" }}
        >
          <span style={{ width: 40, height: 5, borderRadius: 999, background: C.border }} />
        </div>
        {header && <div style={{ flexShrink: 0 }}>{header}</div>}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </>
  );
}

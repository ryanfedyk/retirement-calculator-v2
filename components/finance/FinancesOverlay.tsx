"use client";
import { useEffect, useRef } from "react";
import { X, Wallet } from "lucide-react";
import { C } from "@/config/colors";
import { useUIStore } from "@/store/useUIStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import LeftPanel from "@/components/finance/LeftPanel";
import MobileFinancesSections from "@/components/mobile/MobileFinancesSections";
import type { LivePrices } from "@/components/finance/FinancialDashboard";

// The shared "Your finances" editor (the global snapshot — assets, holdings,
// 529s — that every scenario draws on), surfaced as an overlay that can be
// opened from anywhere via useUIStore.setFinancesOpen(true). Desktop renders a
// centered modal around LeftPanel's finances variant; mobile renders a
// touch-friendly bottom sheet.
export default function FinancesOverlay({ livePrices = {} }: { livePrices?: LivePrices }) {
  const open = useUIStore((s) => s.financesOpen);
  const setOpen = useUIStore((s) => s.setFinancesOpen);
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, isMobile]);

  // The sheet stays mounted (it only slides off-screen), so its scroll position
  // persists between opens — reset it to the top each time it's opened.
  useEffect(() => {
    if (open && isMobile) requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
  }, [open, isMobile]);

  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(26,46,37,0.45)", backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s ease",
        }} />
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61,
          background: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          // dvh (dynamic viewport) — not vh — so the sheet sizes to the *visible*
          // area and its top isn't tucked behind the mobile browser chrome.
          height: "92dvh", maxHeight: "92dvh", display: "flex", flexDirection: "column",
        }}>
          {/* Grabber + header */}
          <div style={{ flexShrink: 0, padding: "8px 20px 12px" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 10px" }}>
              <div style={{ width: 40, height: 5, borderRadius: 999, background: C.border }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 20, fontWeight: 300, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}>
                  <Wallet size={18} color={C.teal} /> Your finances
                </h2>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.inkFaint }}>Shared across every scenario</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} color={C.inkSoft} />
              </button>
            </div>
          </div>
          {/* Scrollable body */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px calc(28px + env(safe-area-inset-bottom))", WebkitOverflowScrolling: "touch" }}>
            <MobileFinancesSections />
            <button onClick={() => setOpen(false)} style={{ marginTop: 8, width: "100%", padding: "16px", borderRadius: 16, border: "none", background: C.teal, color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: `0 4px 16px ${C.teal}55` }}>
              Done
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Desktop: centered modal (kept mounted so it can fade/scale in & out) ──
  return (
    <div
      onMouseDown={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,30,26,0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px",
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.22s ease",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: 560, maxHeight: "90vh", background: C.bgCard,
          borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          transform: open ? "translateY(0) scale(1)" : "translateY(10px) scale(0.98)",
          opacity: open ? 1 : 0,
          transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease",
        }}
      >
        <button
          onClick={() => setOpen(false)} aria-label="Close"
          style={{ position: "absolute", top: 12, right: 12, zIndex: 2, width: 30, height: 30, borderRadius: 8, border: "none", background: C.bg, color: C.inkSoft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <X size={16} />
        </button>
        <LeftPanel variant="finances" livePrices={livePrices} />
      </div>
    </div>
  );
}

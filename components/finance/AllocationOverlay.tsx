"use client";
import { useEffect, useMemo } from "react";
import { X, PieChart as PieIcon } from "lucide-react";
import { C } from "@/config/colors";
import { useUIStore } from "@/store/useUIStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useFinancialStore } from "@/store/useFinancialStore";
import BottomSheet from "@/components/mobile/BottomSheet";
import AllocationCard from "./AllocationCard";
import BalanceSheetEditor from "./BalanceSheetEditor";
import type { LivePrices } from "./FinancialDashboard";

// The full Portfolio Allocation breakdown, surfaced as an overlay opened from the
// compact preview via useUIStore.setAllocationOpen(true). Desktop = centered
// modal; mobile = bottom sheet. Mirrors FinancesOverlay's dual-mode pattern.
export default function AllocationOverlay({ livePrices = {} }: { livePrices?: LivePrices }) {
  const open = useUIStore((s) => s.allocationOpen);
  const setOpen = useUIStore((s) => s.setAllocationOpen);
  const isMobile = useIsMobile();
  const { snapshot, config } = useFinancialStore();

  const liveGoogPrice = (livePrices["GOOG"] ?? livePrices["GOOGL"])?.price ?? 0;
  const enrichedSnapshot = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map((inv) => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  // Escape-to-close on desktop (the sheet handles its own gestures on mobile).
  useEffect(() => {
    if (!open || isMobile) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isMobile, setOpen]);

  const title = (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 300, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}>
        <PieIcon size={18} color={C.teal} /> Portfolio
      </h2>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.inkFaint }}>See and edit what you own</span>
    </>
  );

  const sectionLabel = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkSoft, margin: "22px 2px 12px", paddingTop: 18, borderTop: `1px solid ${C.borderSoft}` }}>{t}</div>
  );

  // The hub body: the allocation view, then the editable balance sheet — one
  // surface to see the mix and adjust the holdings behind it.
  const body = (
    <>
      <AllocationCard snapshot={enrichedSnapshot} config={config} liveGoogPrice={liveGoogPrice} bare />
      {sectionLabel("Edit your investments")}
      <BalanceSheetEditor livePrices={livePrices} scope="investments" />
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={() => setOpen(false)} zIndex={60} restFraction={0.7} fullFraction={0.94}
        header={
          <div style={{ padding: "0 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>{title}</div>
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={16} color={C.inkSoft} />
            </button>
          </div>
        }
      >
        <div style={{ padding: "0 16px calc(28px + env(safe-area-inset-bottom))" }}>
          {body}
        </div>
      </BottomSheet>
    );
  }

  // ── Desktop: centered modal (kept mounted so it can fade/scale in & out) ──
  return (
    <div
      onMouseDown={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,30,26,0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8vh 16px",
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.22s ease",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: 640, maxHeight: "84vh", background: C.bgCard,
          borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          transform: open ? "translateY(0) scale(1)" : "translateY(10px) scale(0.98)",
          opacity: open ? 1 : 0,
          transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "18px 20px 12px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <div>{title}</div>
          <button
            onClick={() => setOpen(false)} aria-label="Close"
            style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: "none", background: C.bg, color: C.inkSoft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px 22px" }}>
          {body}
        </div>
      </div>
    </div>
  );
}

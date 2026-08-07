"use client";
import { useMemo } from "react";
import { ChevronRight, PieChart as PieIcon } from "lucide-react";
import { C } from "@/config/colors";
import { useUIStore } from "@/store/useUIStore";
import { portfolioAllocation } from "@/engine/calculator";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";
import { SLICE_COLOR, HATCHED, fmtM, pctStr } from "./AllocationCard";

// Compact, tappable summary of the portfolio allocation. Shows the headline
// concentration + a thin allocation bar; tapping opens the full breakdown in the
// allocation overlay (bottom sheet on mobile, modal on desktop). Uses the
// investable lens for the at-a-glance figure — the full view offers the toggle.
export default function AllocationPreview({ snapshot, config, liveGoogPrice = 0 }: {
  snapshot: FinancialSnapshot; config: SimulationConfiguration; liveGoogPrice?: number;
}) {
  const setOpen = useUIStore((s) => s.setAllocationOpen);
  const a = useMemo(() => portfolioAllocation(snapshot, config, liveGoogPrice), [snapshot, config, liveGoogPrice]);

  const ordered = useMemo(() => {
    const conc = a.slices.filter((s) => s.key === "concentrated");
    const rest = a.slices.filter((s) => s.key !== "concentrated").sort((x, y) => y.value - x.value);
    return [...conc, ...rest];
  }, [a.slices]);

  const total = a.investable;
  const empty = total <= 0 || ordered.length === 0;
  const hasConc = a.concentratedValue > 0;

  return (
    <button
      onClick={() => setOpen(true)}
      aria-label="Open portfolio allocation breakdown"
      style={{
        width: "100%", textAlign: "left", cursor: "pointer", flexShrink: 0,
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.tealLight; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 7, background: C.tealWash, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <PieIcon size={14} color={C.teal} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>Portfolio Allocation</div>
          <div style={{ fontSize: 11, color: C.inkSoft }}>
            {empty ? (
              "Add holdings to see your breakdown"
            ) : hasConc ? (
              <>
                <span style={{ fontWeight: 700, color: SLICE_COLOR.concentrated }}>{pctStr(a.concentration)}</span>
                {" in "}{a.concentratedSymbol}
                <span style={{ color: C.inkFaint }}>{" · "}{fmtM(total)} invested</span>
              </>
            ) : (
              <><span style={{ fontWeight: 700, color: C.ink }}>{fmtM(total)}</span> invested · diversified</>
            )}
          </div>
        </div>
        <ChevronRight size={18} color={C.inkFaint} style={{ flexShrink: 0 }} />
      </div>

      {/* Thin allocation bar — a glanceable split, 2px gaps between segments */}
      {!empty && (
        <div style={{ display: "flex", gap: 2, height: 8, borderRadius: 5, overflow: "hidden" }}>
          {ordered.map((s) => (
            <span key={s.key} style={{
              width: `${(s.value / total) * 100}%`, minWidth: 3,
              background: SLICE_COLOR[s.key],
              backgroundImage: HATCHED.has(s.key) ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0 1.5px, transparent 1.5px 3.5px)" : undefined,
            }} />
          ))}
        </div>
      )}
    </button>
  );
}

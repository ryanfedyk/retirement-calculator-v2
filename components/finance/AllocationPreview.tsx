"use client";
import { useMemo } from "react";
import { PieChart as PieIcon } from "lucide-react";
import { C } from "@/config/colors";
import { useUIStore } from "@/store/useUIStore";
import { portfolioAllocation } from "@/engine/calculator";
import type { FinancialSnapshot, SimulationConfiguration } from "@/engine/calculator";
import { SLICE_COLOR, HATCHED, fmtM, pctStr } from "./AllocationCard";

// Compact allocation card for the summary-card row. Shows the headline
// concentration + a thin allocation bar; tapping opens the full breakdown (and
// editing) in the allocation overlay. Sized to match the sibling summary cards.
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
      title="Portfolio allocation"
      style={{
        position: "relative", flex: "1 0 230px", minHeight: 128, borderRadius: 14, padding: "15px 16px",
        display: "flex", flexDirection: "column", textAlign: "left", font: "inherit", cursor: "pointer",
        border: `1px solid ${C.border}`, background: C.bgCard,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.tealLight; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.inkFaint, marginBottom: 6 }}>Allocation</div>
          <div style={{ fontSize: 23, fontWeight: 300, color: C.ink, whiteSpace: "nowrap" }}>
            {empty ? "—" : hasConc
              ? <><span style={{ color: SLICE_COLOR.concentrated }}>{pctStr(a.concentration)}</span> {a.concentratedSymbol}</>
              : "Diversified"}
          </div>
        </div>
        <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: C.tealWash, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PieIcon size={17} color={C.teal} />
        </span>
      </div>

      {/* Thin allocation bar + caption pinned to the bottom, like sibling cards */}
      <div style={{ marginTop: "auto", paddingTop: 10 }}>
        {!empty && (
          <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
            {ordered.map((s) => (
              <span key={s.key} style={{
                width: `${(s.value / total) * 100}%`, minWidth: 2,
                background: SLICE_COLOR[s.key],
                backgroundImage: HATCHED.has(s.key) ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0 1.5px, transparent 1.5px 3.5px)" : undefined,
              }} />
            ))}
          </div>
        )}
        <div style={{ fontSize: 10, color: C.inkFaint }}>
          {empty ? "Add holdings to see your mix" : `${fmtM(total)} invested · tap to explore & edit`}
        </div>
      </div>
    </button>
  );
}

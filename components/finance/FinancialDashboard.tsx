"use client";
import { Sliders } from "lucide-react";
import LeftPanel  from "./LeftPanel";
import RightPanel from "./RightPanel";
import { C } from "@/config/colors";
import { useUIStore } from "@/store/useUIStore";

// ── Shared type for live prices (defined in the hook; re-exported here so the
//    many components that import it from this path keep working) ───────────────
export type { PriceInfo, LivePrices } from "@/hooks/useLivePrices";
import type { LivePrices } from "@/hooks/useLivePrices";

interface Props {
  livePrices: LivePrices;
}

/** The slim left rail shown when the Scenario plan panel is collapsed — click to
 *  expand. Keeps the trajectory front-and-center while one tap away from levers. */
function PlanRail({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="Open scenario plan"
      title="Scenario plan"
      style={{
        width: 44, flexShrink: 0, background: C.bgCard,
        border: "none", borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 18,
        cursor: "pointer",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: C.tealWash }}>
        <Sliders size={16} color={C.teal} />
      </span>
      {/* Vertical label */}
      <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.inkSoft }}>
        Scenario plan
      </span>
    </button>
  );
}

export default function FinancialDashboard({ livePrices }: Props) {
  const planPanelOpen = useUIStore((s) => s.planPanelOpen);
  const setPlanPanelOpen = useUIStore((s) => s.setPlanPanelOpen);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", overflow: "hidden", background: C.bg }}>
      {planPanelOpen
        ? <LeftPanel livePrices={livePrices} onClose={() => setPlanPanelOpen(false)} />
        : <PlanRail onOpen={() => setPlanPanelOpen(true)} />}
      <RightPanel livePrices={livePrices} />
    </div>
  );
}

"use client";
import LeftPanel  from "./LeftPanel";
import RightPanel from "./RightPanel";
import { C } from "@/config/colors";

// ── Shared type for live prices (defined in the hook; re-exported here so the
//    many components that import it from this path keep working) ───────────────
export type { PriceInfo, LivePrices } from "@/hooks/useLivePrices";
import type { LivePrices } from "@/hooks/useLivePrices";

interface Props {
  livePrices: LivePrices;
}

export default function FinancialDashboard({ livePrices }: Props) {
  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", overflow: "hidden", background: C.bg }}>
      <LeftPanel livePrices={livePrices} />
      <RightPanel livePrices={livePrices} />
    </div>
  );
}

"use client";
import { useState } from "react";
import { Anchor, Wind, Clock, Compass } from "lucide-react";
import { useHorizonProfile } from "@/config/horizonConfig";
import { C } from "@/config/colors";
import Header, { type AppView } from "@/components/Header";
import { X } from "lucide-react";
import CountdownStrip        from "@/components/CountdownStrip";
import ScenariosHub          from "@/components/ScenariosHub";
import LeftPanel             from "@/components/finance/LeftPanel";
import { useIsMobile }       from "@/hooks/useIsMobile";
import { useLivePrices }     from "@/hooks/useLivePrices";
import MobileApp             from "@/components/mobile/MobileApp";
import { useRetirementDate } from "@/hooks/useRetirementDate";
import FlightMap             from "@/components/FlightMap";
import MacroSeasonsTimeline  from "@/components/MacroSeasonsTimeline";
import ReclaimedTimeCalculator from "@/components/ReclaimedTimeCalculator";
import AdventureGenerator    from "@/components/AdventureGenerator";
import DailyDeflationWidget  from "@/components/DailyDeflationWidget";
import FinancialDashboard    from "@/components/finance/FinancialDashboard";
import LifeEventsFab         from "@/components/forecasting/LifeEventsFab";
import SettingsPanel         from "@/components/SettingsPanel";
import type { AdventureBlueprint } from "@/types/horizon";

const NAV = [
  { id: "seasons",   label: "Seasons",   icon: Anchor },
  { id: "reclaim",   label: "Reclaim",   icon: Wind },
  { id: "adventure", label: "Adventure", icon: Compass },
  { id: "deflate",   label: "Deflate",   icon: Clock },
] as const;
type NavId = typeof NAV[number]["id"];

export default function DashboardShell() {
  const [appView, setAppView] = useState<AppView>("financial");
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [financesOpen, setFinancesOpen] = useState(false);
  const [tab,   setTab]   = useState<NavId>("seasons");
  const [saved, setSaved] = useState<AdventureBlueprint[]>([]);
  const { retirementDate } = useRetirementDate();
  const { user } = useHorizonProfile();
  const isMobile = useIsMobile();
  const prices = useLivePrices({ enabled: !isMobile });

  if (isMobile) return <MobileApp />;

  // ── Scenarios hub — top-level landing ──
  if (!scenarioOpen) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>
        <Header view={appView} onViewChange={setAppView} mode="hub" />
        <SettingsPanel />
        <ScenariosHub livePrices={prices.livePrices} onOpen={() => setScenarioOpen(true)} onEditFinances={() => setFinancesOpen(true)} />
        {financesOpen && (
          <div
            onMouseDown={() => setFinancesOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,30,26,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px" }}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              style={{ position: "relative", width: "100%", maxWidth: 560, maxHeight: "90vh", background: C.bgCard, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 16px 48px rgba(0,0,0,0.25)" }}
            >
              <button
                onClick={() => setFinancesOpen(false)} aria-label="Close"
                style={{ position: "absolute", top: 12, right: 12, zIndex: 2, width: 30, height: 30, borderRadius: 8, border: "none", background: C.bg, color: C.inkSoft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
              <LeftPanel variant="finances" livePrices={prices.livePrices} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Scenario deep-dive ──
  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>

      <Header
        view={appView}
        onViewChange={setAppView}
        mode="scenario"
        onBack={() => setScenarioOpen(false)}
      />
      <SettingsPanel />

      {/* Countdown — reflects the open scenario, across both deep-dive tabs */}
      <CountdownStrip />

      {/* ── Financial View ── */}
      {appView === "financial" && (
        <div className="flex-1" style={{ minHeight: 0 }}>
          <FinancialDashboard
            livePrices={prices.livePrices}
            pricesUpdatedAt={prices.pricesUpdatedAt}
            pricesFetching={prices.pricesFetching}
            onRefreshPrices={prices.refresh}
          />
        </div>
      )}

      {/* ── Forecasting View ── */}
      {appView === "forecasting" && (
        <>
          <FlightMap pinnedAdventures={saved} />
          <LifeEventsFab />

          {/* Nav */}
          <nav style={{ background: C.bgCard, borderBottom: `1px solid ${C.border}` }} className="px-8">
            <div className="max-w-7xl mx-auto flex">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                        className="flex items-center gap-2 px-5 py-3.5 text-xs font-medium border-b-2 transition-all duration-200 cursor-pointer tracking-wide uppercase"
                        style={{
                          borderColor: tab === id ? C.teal : "transparent",
                          color:       tab === id ? C.tealDark : C.inkSoft,
                        }}>
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </nav>

          {/* Main */}
          <main className="flex-1 px-8 py-12">
            <div className="max-w-7xl mx-auto">
              {tab === "seasons"   && <MacroSeasonsTimeline />}
              {tab === "reclaim"   && <ReclaimedTimeCalculator />}
              {tab === "adventure" && <AdventureGenerator saved={saved} setSaved={setSaved} />}
              {tab === "deflate"   && <DailyDeflationWidget />}
            </div>
          </main>

          <footer style={{ borderTop: `1px solid ${C.border}`, background: C.bgHeader }} className="px-8 py-4">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <p style={{ color: C.inkFaint }} className="text-[10px] tracking-widest uppercase">Taper</p>
              <p style={{ color: C.inkFaint }} className="text-[10px]">
                {user.name ? `${user.name} · ` : ""}Retiring {retirementDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
              </p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { Anchor, Wind, Clock, Compass } from "lucide-react";
import { useHorizonProfile } from "@/config/horizonConfig";
import { C } from "@/config/colors";
import Header, { type AppView } from "@/components/Header";
import CountdownStrip        from "@/components/CountdownStrip";
import ScenariosHub          from "@/components/ScenariosHub";
import FinancesOverlay       from "@/components/finance/FinancesOverlay";
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
import PriceTicker           from "@/components/finance/PriceTicker";
import LifeEventsFab         from "@/components/forecasting/LifeEventsFab";
import SettingsPanel         from "@/components/SettingsPanel";
import ScenarioReportModal   from "@/components/ScenarioReportModal";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { useBrowserBackNav } from "@/hooks/useBrowserBackNav";
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
  // Persisted (survives refresh) so reloading keeps you in the open scenario.
  const scenarioOpen = useUIStore((s) => s.scenarioOpen);
  const setScenarioOpen = useUIStore((s) => s.setScenarioOpen);
  const [tab,   setTab]   = useState<NavId>("seasons");
  const [saved, setSaved] = useState<AdventureBlueprint[]>([]);
  const { retirementDate } = useRetirementDate();
  const { user } = useHorizonProfile();
  const { snapshot, config } = useFinancialStore();
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const financesOpen = useUIStore((s) => s.financesOpen);
  const setFinancesOpen = useUIStore((s) => s.setFinancesOpen);
  const isMobile = useIsMobile();
  const prices = useLivePrices({ enabled: !isMobile });

  // Let the browser Back button step back through the in-memory navigation
  // (close an overlay, then leave a scenario for the hub) instead of unloading
  // the page. Ordered top-most first. Disabled on mobile, which has its own nav.
  useBrowserBackNav({
    enabled: !isMobile,
    layers: [
      { open: settingsOpen, close: () => setSettingsOpen(false) },
      { open: financesOpen, close: () => setFinancesOpen(false) },
      { open: scenarioOpen, close: () => setScenarioOpen(false) },
    ],
  });

  if (isMobile) return <MobileApp />;

  // ── Scenarios hub — top-level landing ──
  if (!scenarioOpen) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>
        <Header view={appView} onViewChange={setAppView} mode="hub" />
        <SettingsPanel />
        <FinancesOverlay livePrices={prices.livePrices} />
        <ScenarioReportModal livePrices={prices.livePrices} />
        <ScenariosHub livePrices={prices.livePrices} onOpen={() => setScenarioOpen(true)} />
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
      <FinancesOverlay livePrices={prices.livePrices} />
      <ScenarioReportModal livePrices={prices.livePrices} />

      {/* Countdown — reflects the open scenario, across both deep-dive tabs.
          The portfolio price ticker rides on the same line to save a widget. */}
      <CountdownStrip
        right={
          <PriceTicker
            holdings={snapshot.other_investments}
            livePrices={prices.livePrices}
            concentratedSymbol={config.use_equity_comp ? config.concentrated_symbol : ""}
            pricesUpdatedAt={prices.pricesUpdatedAt}
            pricesFetching={prices.pricesFetching}
            onRefreshPrices={prices.refresh}
            align="end"
          />
        }
      />

      {/* ── Financial View ── */}
      {appView === "financial" && (
        <div className="flex-1" style={{ minHeight: 0 }}>
          <FinancialDashboard livePrices={prices.livePrices} />
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

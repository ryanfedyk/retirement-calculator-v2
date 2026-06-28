"use client";
import { useState, useEffect, useRef } from "react";
import { Anchor, Wind, CalendarRange, Sun } from "lucide-react";
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
import PerfectYear          from "@/components/forecasting/PerfectYear";
import FinancialDashboard    from "@/components/finance/FinancialDashboard";
import PerfectDay            from "@/components/forecasting/PerfectDay";
import LifeEventsFab         from "@/components/forecasting/LifeEventsFab";
import SettingsPanel         from "@/components/SettingsPanel";
import ScenarioReportModal   from "@/components/ScenarioReportModal";
import PartnerAlignment      from "@/components/partner/PartnerAlignment";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { usePartnerStore } from "@/store/usePartnerStore";
import { decodeAnswers } from "@/lib/partnerAlignment";
import { useBrowserBackNav } from "@/hooks/useBrowserBackNav";

const NAV = [
  { id: "seasons",    label: "Seasons",     icon: Anchor },
  { id: "perfectday", label: "Perfect Day", icon: Sun },
  { id: "reclaim",    label: "Reclaim",     icon: Wind },
  { id: "year",       label: "Perfect Year", icon: CalendarRange },
] as const;
type NavId = typeof NAV[number]["id"];

export default function DashboardShell() {
  const [tab,   setTab]   = useState<NavId>("seasons");
  const { retirementDate } = useRetirementDate();
  const { user } = useHorizonProfile();
  const { snapshot, config, activeScenarioId, primaryScenarioId, setActiveScenario } = useFinancialStore();
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const financesOpen = useUIStore((s) => s.financesOpen);
  const setFinancesOpen = useUIStore((s) => s.setFinancesOpen);
  const compareOpen = useUIStore((s) => s.compareOpen);
  const setCompareOpen = useUIStore((s) => s.setCompareOpen);
  // The active scenario's remembered view (Trajectory/Reclaim), so returning to a
  // scenario lands you where you left it.
  const appView = useUIStore((s) => s.viewByScenario[activeScenarioId] ?? "financial");
  const setScenarioView = useUIStore((s) => s.setScenarioView);
  const setAppView = (v: AppView) => setScenarioView(activeScenarioId, v);
  const isMobile = useIsMobile();
  const prices = useLivePrices({ enabled: !isMobile });

  // Land in the primary "home" scenario on first load, not wherever the active
  // pointer was last left.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current) return;
    landed.current = true;
    if (primaryScenarioId && primaryScenarioId !== activeScenarioId) setActiveScenario(primaryScenarioId);
  }, [primaryScenarioId, activeScenarioId, setActiveScenario]);

  const goHome = () => { setCompareOpen(false); if (primaryScenarioId) setActiveScenario(primaryScenarioId); };

  // A partner who opens a shared "?align=" link: load their partner's answers
  // into the local "partner" slot and open the alignment overlay so they can add
  // theirs and see the comparison. Runs once; then strips the param from the URL.
  const alignHandled = useRef(false);
  useEffect(() => {
    if (alignHandled.current) return;
    alignHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const a = params.get("align");
    if (!a) return;
    const decoded = decodeAnswers(a);
    if (decoded) { usePartnerStore.getState().loadPartner(decoded); useUIStore.getState().setPartnerOpen(true); }
    params.delete("align");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  // Let the browser Back button step back through the in-memory navigation (close
  // an overlay, then leave the compare view). Ordered top-most first. Disabled on
  // mobile, which has its own nav.
  useBrowserBackNav({
    enabled: !isMobile,
    layers: [
      { open: settingsOpen, close: () => setSettingsOpen(false) },
      { open: financesOpen, close: () => setFinancesOpen(false) },
      { open: compareOpen, close: () => setCompareOpen(false) },
    ],
  });

  if (isMobile) return <MobileApp />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>

      <Header
        view={appView}
        onViewChange={setAppView}
        mode={compareOpen ? "compare" : "scenario"}
        onBack={goHome}
      />
      <SettingsPanel />
      <FinancesOverlay livePrices={prices.livePrices} />
      <PartnerAlignment />
      <ScenarioReportModal livePrices={prices.livePrices} />

      {compareOpen ? (
        /* ── Compare scenarios — a destination reached from the dropdown ── */
        <ScenariosHub livePrices={prices.livePrices} onOpen={() => setCompareOpen(false)} />
      ) : (
      <>
      {/* Countdown — reflects the open scenario, across both deep-dive tabs.
          (Live prices now ride on the Progress-to-FI summary card.) */}
      <CountdownStrip />

      {/* ── Financial View ── */}
      {appView === "financial" && (
        <div className="flex-1" style={{ minHeight: 0 }}>
          <FinancialDashboard livePrices={prices.livePrices} />
        </div>
      )}

      {/* ── Forecasting View ── */}
      {appView === "forecasting" && (
        <>
          <FlightMap />
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
              {tab === "seasons"    && <MacroSeasonsTimeline />}
              {tab === "perfectday" && <PerfectDay />}
              {tab === "reclaim"    && <ReclaimedTimeCalculator />}
              {tab === "year" && <PerfectYear />}
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
      </>
      )}
    </div>
  );
}

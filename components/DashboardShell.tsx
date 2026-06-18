"use client";
import { useState } from "react";
import { Anchor, Wind, Clock, Compass } from "lucide-react";
import { useHorizonProfile } from "@/config/horizonConfig";
import { C } from "@/config/colors";
import Header, { type AppView } from "@/components/Header";
import CountdownStrip        from "@/components/CountdownStrip";
import { useIsMobile }       from "@/hooks/useIsMobile";
import MobileApp             from "@/components/mobile/MobileApp";
import { useRetirementDate } from "@/hooks/useRetirementDate";
import FlightMap             from "@/components/FlightMap";
import MacroSeasonsTimeline  from "@/components/MacroSeasonsTimeline";
import ReclaimedTimeCalculator from "@/components/ReclaimedTimeCalculator";
import AdventureGenerator    from "@/components/AdventureGenerator";
import DailyDeflationWidget  from "@/components/DailyDeflationWidget";
import FinancialDashboard    from "@/components/finance/FinancialDashboard";
import LifeEventsFab         from "@/components/forecasting/LifeEventsFab";
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
  const [tab,   setTab]   = useState<NavId>("seasons");
  const [saved, setSaved] = useState<AdventureBlueprint[]>([]);
  const { retirementDate } = useRetirementDate();
  const { user } = useHorizonProfile();
  const isMobile = useIsMobile();

  if (isMobile) return <MobileApp />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>

      <Header view={appView} onViewChange={setAppView} />

      {/* Countdown — shown across both views */}
      <CountdownStrip />

      {/* ── Financial View ── */}
      {appView === "financial" && (
        <div className="flex-1">
          <FinancialDashboard />
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
              <p style={{ color: C.inkFaint }} className="text-[10px] tracking-widest uppercase">Horizon — The Elegant Taper</p>
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

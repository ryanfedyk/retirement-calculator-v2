"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Compass, SlidersHorizontal, LogOut, Settings, ChevronLeft, Wallet } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { useBrowserBackNav } from "@/hooks/useBrowserBackNav";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { LivePrices } from "@/components/finance/FinancialDashboard";
import MobileFinancial from "./MobileFinancial";
import MobileForecasting from "./MobileForecasting";
import ScenariosHub from "@/components/ScenariosHub";
import ConfigSheet from "./ConfigSheet";
import FinancesOverlay from "@/components/finance/FinancesOverlay";
import SettingsPanel from "@/components/SettingsPanel";

type View = "financial" | "forecasting";

export default function MobileApp() {
  const { snapshot } = useFinancialStore();
  const scenarios = useFinancialStore((s) => s.scenarios);
  const activeScenarioId = useFinancialStore((s) => s.activeScenarioId);
  const activeName = scenarios.find((s) => s.id === activeScenarioId)?.name ?? "Scenario";
  const financesOpen = useUIStore((s) => s.financesOpen);
  const setFinancesOpen = useUIStore((s) => s.setFinancesOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const [view, setView] = useState<View>("financial");
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Make the device/browser Back button step back through the app: close an
  // open sheet/overlay first, then leave a scenario for the hub. Ordered
  // top-most first.
  useBrowserBackNav({
    enabled: true,
    layers: [
      { open: settingsOpen, close: () => setSettingsOpen(false) },
      { open: financesOpen, close: () => setFinancesOpen(false) },
      { open: configOpen, close: () => setConfigOpen(false) },
      { open: scenarioOpen, close: () => setScenarioOpen(false) },
    ],
  });

  // ── Live prices (shared with the chart) ─────────────────────────────────────
  const [livePrices, setLivePrices]         = useState<LivePrices>({});
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState<Date | null>(null);
  const [pricesFetching, setPricesFetching]   = useState(false);

  const fetchAllPrices = useCallback(async () => {
    const symbols = [...new Set((snapshot.other_investments ?? []).map(i => i.symbol.toUpperCase()))];
    if (!symbols.length) return;
    setPricesFetching(true);
    try {
      const res = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
      const data = await res.json() as { prices: LivePrices };
      setLivePrices(data.prices ?? {});
      setPricesUpdatedAt(new Date());
    } catch { /* keep stale */ } finally { setPricesFetching(false); }
  }, [snapshot.other_investments]);

  useEffect(() => { fetchAllPrices(); }, [fetchAllPrices]);

  const tabs: { id: View; label: string; icon: typeof LineChart }[] = [
    { id: "financial",   label: "Trajectory", icon: LineChart },
    { id: "forecasting", label: "Reclaim",    icon: Compass },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", flexDirection: "column", overflowX: "hidden" }}>

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: `${C.bgHeader}f2`, backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "calc(10px + env(safe-area-inset-top)) 18px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        {scenarioOpen ? (
          // Back button (returns to the hub, where scenarios are switched) plus
          // the active scenario name as a static title — no in-place dropdown.
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button onClick={() => setScenarioOpen(false)} aria-label="Back to scenarios" style={{
              display: "flex", alignItems: "center", gap: 3, padding: "6px 10px 6px 6px",
              borderRadius: 9, border: `1px solid ${C.border}`, background: C.bgCard, cursor: "pointer",
              color: C.inkSoft, fontSize: 13, fontWeight: 600, flexShrink: 0,
            }}>
              <ChevronLeft size={16} /> Scenarios
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {activeName}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: C.ink }}>TAPER</div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {scenarioOpen && (
            <button onClick={() => useUIStore.getState().setFinancesOpen(true)} aria-label="Your finances" style={{
              width: 40, height: 40, borderRadius: "50%", border: `1px solid ${C.border}`, flexShrink: 0,
              background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}>
              <Wallet size={18} color={C.teal} />
            </button>
          )}
          {scenarioOpen && view === "financial" && (
            <button onClick={() => setConfigOpen(true)} aria-label="Adjust plan" style={{
              width: 40, height: 40, borderRadius: "50%", border: `1px solid ${C.border}`, flexShrink: 0,
              background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}>
              <SlidersHorizontal size={18} color={C.teal} />
            </button>
          )}
          <MobileAccountMenu />
        </div>
      </header>

      {/* Body — hub landing, or the open scenario's deep-dive */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", paddingBottom: scenarioOpen ? "calc(84px + env(safe-area-inset-bottom))" : "env(safe-area-inset-bottom)" }}>
        {!scenarioOpen ? (
          <ScenariosHub livePrices={livePrices} onOpen={() => { setView("financial"); setScenarioOpen(true); }} />
        ) : view === "financial" ? (
          <MobileFinancial livePrices={livePrices} pricesUpdatedAt={pricesUpdatedAt} pricesFetching={pricesFetching} onRefreshPrices={fetchAllPrices} onOpenConfig={() => setConfigOpen(true)} />
        ) : (
          <MobileForecasting />
        )}
      </main>

      <ConfigSheet open={configOpen} onClose={() => setConfigOpen(false)} />
      <FinancesOverlay livePrices={livePrices} />
      <SettingsPanel />

      {/* Bottom tab bar — only while exploring a scenario */}
      {scenarioOpen && (
        <nav style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
          display: "flex", background: `${C.bgCard}f5`, backdropFilter: "blur(12px)",
          borderTop: `1px solid ${C.border}`,
          padding: "8px 12px calc(8px + env(safe-area-inset-bottom))",
        }}>
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <button key={id} onClick={() => setView(id)} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "6px 0", border: "none", background: "transparent", cursor: "pointer",
                color: active ? C.teal : C.inkFaint, transition: "color 0.18s",
              }}>
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: "0.04em" }}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function MobileAccountMenu() {
  const { user, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;
  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Account" style={{
        width: 40, height: 40, borderRadius: "50%", border: `1px solid ${C.border}`,
        background: C.tealWash, color: C.tealDark, fontSize: 15, fontWeight: 600,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
      }}>
        {initial}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 200, zIndex: 100,
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
          boxShadow: `0 6px 20px ${C.border}`, padding: 8,
        }}>
          <div style={{ padding: "6px 10px 10px", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 12, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.displayName || user.email}
          </div>
          <button onClick={() => { setOpen(false); useUIStore.getState().setSettingsOpen(true); }} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, marginTop: 6,
            padding: "10px", background: "transparent", border: "none", borderRadius: 8,
            color: C.inkMid, fontSize: 14, cursor: "pointer", textAlign: "left",
          }}>
            <Settings size={15} /> Settings
          </button>
          <button onClick={() => { setOpen(false); signOutUser(); }} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, marginTop: 2,
            padding: "10px", background: "transparent", border: "none", borderRadius: 8,
            color: C.inkMid, fontSize: 14, cursor: "pointer", textAlign: "left",
          }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

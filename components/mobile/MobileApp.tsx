"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Compass, SlidersHorizontal, LogOut, Settings, ChevronLeft, Wallet, ChevronDown, Star, ArrowLeftRight, Plus, Copy, Pencil, FileText, Trash2, Check, Heart } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { useBrowserBackNav } from "@/hooks/useBrowserBackNav";
import { useMonthlyPlanSnapshot } from "@/hooks/useMonthlyPlanSnapshot";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useConfirm } from "@/components/ui/DialogProvider";
import type { LivePrices } from "@/components/finance/FinancialDashboard";
import MobileFinancial from "./MobileFinancial";
import MobileForecasting from "./MobileForecasting";
import ScenariosHub from "@/components/ScenariosHub";
import ConfigSheet from "./ConfigSheet";
import FinancesOverlay from "@/components/finance/FinancesOverlay";
import SettingsPanel from "@/components/SettingsPanel";
import ScenarioReportModal from "@/components/ScenarioReportModal";
import PartnerAlignment from "@/components/partner/PartnerAlignment";

type View = "financial" | "forecasting";

export default function MobileApp() {
  const { snapshot } = useFinancialStore();
  const scenarios = useFinancialStore((s) => s.scenarios);
  const activeScenarioId = useFinancialStore((s) => s.activeScenarioId);
  const primaryScenarioId = useFinancialStore((s) => s.primaryScenarioId);
  const setActiveScenario = useFinancialStore((s) => s.setActiveScenario);
  const active = scenarios.find((s) => s.id === activeScenarioId);
  const activeName = active?.name ?? "Scenario";
  const isPrimaryActive = activeScenarioId === primaryScenarioId;

  const financesOpen = useUIStore((s) => s.financesOpen);
  const setFinancesOpen = useUIStore((s) => s.setFinancesOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const reportScenarioId = useUIStore((s) => s.reportScenarioId);
  const closeReport = useUIStore((s) => s.closeReport);
  // Full-screen "Compare" destination (transient — we always land in a scenario).
  const compareOpen = useUIStore((s) => s.compareOpen);
  const setCompareOpen = useUIStore((s) => s.setCompareOpen);
  // Per-scenario remembered view (Trajectory/Reclaim), shared with desktop.
  const view = useUIStore((s) => s.viewByScenario[activeScenarioId] ?? "financial");
  const setScenarioView = useUIStore((s) => s.setScenarioView);
  const setView = (v: View) => setScenarioView(activeScenarioId, v);

  const [configOpen, setConfigOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Land in the primary "home" scenario on first load.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current) return;
    landed.current = true;
    if (primaryScenarioId && primaryScenarioId !== activeScenarioId) setActiveScenario(primaryScenarioId);
  }, [primaryScenarioId, activeScenarioId, setActiveScenario]);

  // Entering compare or switching tabs lands at the top of the page.
  useEffect(() => { window.scrollTo(0, 0); }, [compareOpen, view]);

  // Device/browser Back steps back through the app: close a sheet/overlay first,
  // then leave the compare destination. Ordered top-most first.
  useBrowserBackNav({
    enabled: true,
    layers: [
      { open: !!reportScenarioId, close: closeReport },
      { open: settingsOpen, close: () => setSettingsOpen(false) },
      { open: financesOpen, close: () => setFinancesOpen(false) },
      { open: configOpen, close: () => setConfigOpen(false) },
      { open: switcherOpen, close: () => setSwitcherOpen(false) },
      { open: compareOpen, close: () => setCompareOpen(false) },
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
      useFinancialStore.getState().cacheLivePrices(
        Object.fromEntries(Object.entries(data.prices ?? {}).map(([k, v]) => [k, v.price])),
      );
      setPricesUpdatedAt(new Date());
    } catch { /* keep stale */ } finally { setPricesFetching(false); }
  }, [snapshot.other_investments]);

  useEffect(() => { fetchAllPrices(); }, [fetchAllPrices]);

  // Monthly plan-history snapshot — uses mobile's own live prices (the shell's
  // useLivePrices is disabled on mobile), so vested RSUs are valued correctly.
  useMonthlyPlanSnapshot(livePrices);

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
        {compareOpen ? (
          // In Compare: a Done chip to return to the active scenario.
          <button onClick={() => setCompareOpen(false)} aria-label="Done comparing" style={{
            display: "flex", alignItems: "center", gap: 3, padding: "6px 12px 6px 8px",
            borderRadius: 9, border: `1px solid ${C.border}`, background: C.bgCard, cursor: "pointer",
            color: C.inkSoft, fontSize: 13, fontWeight: 600,
          }}>
            <ChevronLeft size={16} /> Done
          </button>
        ) : (
          // The scenario switcher — tap to open the bottom sheet (mobile's dropdown).
          <button onClick={() => setSwitcherOpen(true)} aria-label="Switch scenario" style={{
            display: "flex", alignItems: "center", gap: 6, minWidth: 0, padding: "6px 8px",
            borderRadius: 9, border: "none", background: "transparent", cursor: "pointer",
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "56vw" }}>
              {activeName}
            </span>
            {isPrimaryActive && <Star size={13} color={C.teal} fill={C.teal} style={{ flexShrink: 0 }} />}
            <ChevronDown size={17} color={C.inkSoft} style={{ flexShrink: 0 }} />
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {!compareOpen && (
            <button onClick={() => useUIStore.getState().setFinancesOpen(true)} aria-label="Your finances" style={{
              width: 40, height: 40, borderRadius: "50%", border: `1px solid ${C.border}`, flexShrink: 0,
              background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}>
              <Wallet size={18} color={C.teal} />
            </button>
          )}
          {!compareOpen && view === "financial" && (
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

      {/* Body — the active scenario's deep-dive, or the Compare destination */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", paddingBottom: compareOpen ? "env(safe-area-inset-bottom)" : "calc(84px + env(safe-area-inset-bottom))" }}>
        {compareOpen ? (
          <ScenariosHub livePrices={livePrices} onOpen={() => setCompareOpen(false)} />
        ) : view === "financial" ? (
          <MobileFinancial livePrices={livePrices} pricesUpdatedAt={pricesUpdatedAt} pricesFetching={pricesFetching} onRefreshPrices={fetchAllPrices} onOpenConfig={() => setConfigOpen(true)} />
        ) : (
          <MobileForecasting />
        )}
      </main>

      <MobileScenarioSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <ConfigSheet open={configOpen} onClose={() => setConfigOpen(false)} />
      <FinancesOverlay livePrices={livePrices} />
      <PartnerAlignment />
      <SettingsPanel />
      <ScenarioReportModal livePrices={livePrices} />

      {/* Bottom tab bar — while in a scenario (hidden in Compare) */}
      {!compareOpen && (
        <nav style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
          display: "flex", background: `${C.bgCard}f5`, backdropFilter: "blur(12px)",
          borderTop: `1px solid ${C.border}`,
          padding: "8px 12px calc(8px + env(safe-area-inset-bottom))",
        }}>
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = view === id;
            return (
              <button key={id} onClick={() => setView(id)} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "6px 0", border: "none", background: "transparent", cursor: "pointer",
                color: isActive ? C.teal : C.inkFaint, transition: "color 0.18s",
              }}>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: "0.04em" }}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/** The mobile scenario switcher — a bottom sheet that mirrors the desktop header
 * dropdown: switch scenarios (primary starred), jump to Compare, create a new
 * one, and act on the current scenario (set primary, duplicate, rename, export,
 * delete). This is mobile's navigational spine. */
function MobileScenarioSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scenarios = useFinancialStore((s) => s.scenarios);
  const activeScenarioId = useFinancialStore((s) => s.activeScenarioId);
  const primaryScenarioId = useFinancialStore((s) => s.primaryScenarioId);
  const setActiveScenario = useFinancialStore((s) => s.setActiveScenario);
  const setPrimaryScenario = useFinancialStore((s) => s.setPrimaryScenario);
  const addScenario = useFinancialStore((s) => s.addScenario);
  const duplicateScenario = useFinancialStore((s) => s.duplicateScenario);
  const renameScenario = useFinancialStore((s) => s.renameScenario);
  const deleteScenario = useFinancialStore((s) => s.deleteScenario);
  const setCompareOpen = useUIStore((s) => s.setCompareOpen);
  const openReport = useUIStore((s) => s.openReport);
  const confirm = useConfirm();

  const active = scenarios.find((s) => s.id === activeScenarioId);
  const isPrimaryActive = activeScenarioId === primaryScenarioId;
  const [renaming, setRenaming] = useState(false);
  const [nameBuf, setNameBuf] = useState(active?.name ?? "");
  useEffect(() => { if (open) { setRenaming(false); setNameBuf(active?.name ?? ""); } }, [open, active?.name]);

  if (!open) return null;

  const pick = (id: string) => { setActiveScenario(id); setCompareOpen(false); onClose(); };
  const commitRename = () => { const n = nameBuf.trim(); if (n) renameScenario(activeScenarioId, n); setRenaming(false); };

  const action = (Icon: typeof Copy, label: string, fn: () => void, danger = false) => (
    <button onClick={fn} style={{
      display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "13px 14px",
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 8,
      color: danger ? C.warm : C.inkMid, fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left",
    }}>
      <Icon size={17} /> {label}
    </button>
  );
  const sectionLabel = (t: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint, margin: "6px 2px 8px" }}>{t}</div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(20,30,28,0.4)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxHeight: "85dvh", overflowY: "auto", background: C.bg,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: "10px 16px calc(20px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 12px" }}>
          <span style={{ width: 36, height: 4, borderRadius: 99, background: C.border }} />
        </div>

        {renaming ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input autoFocus value={nameBuf} onChange={(e) => setNameBuf(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); }}
              aria-label="Scenario name"
              style={{ flex: 1, border: `1px solid ${C.teal}`, borderRadius: 10, padding: "11px 12px", fontSize: 16, color: C.ink, background: C.bgCard, outline: "none" }} />
            <button onClick={commitRename} style={{ padding: "0 16px", borderRadius: 10, border: "none", background: C.teal, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Save</button>
          </div>
        ) : (
          <>
            {sectionLabel("Switch scenario")}
            {scenarios.map((sc) => (
              <button key={sc.id} onClick={() => pick(sc.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "13px 14px",
                background: sc.id === activeScenarioId ? C.tealWash : C.bgCard,
                border: `1px solid ${sc.id === activeScenarioId ? C.tealLight : C.border}`, borderRadius: 12, marginBottom: 8,
                cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sc.name}</span>
                {sc.id === primaryScenarioId && <Star size={15} color={C.teal} fill={C.teal} style={{ flexShrink: 0 }} />}
                {sc.id === activeScenarioId && <Check size={17} color={C.teal} style={{ flexShrink: 0 }} />}
              </button>
            ))}

            <div style={{ height: 1, background: C.borderSoft, margin: "8px 0 12px" }} />
            {action(ArrowLeftRight, "Compare all scenarios", () => { setCompareOpen(true); onClose(); })}
            {action(Plus, "New scenario", () => { addScenario(); setCompareOpen(false); onClose(); })}

            <div style={{ height: 1, background: C.borderSoft, margin: "8px 0 12px" }} />
            {sectionLabel("This scenario")}
            {!isPrimaryActive && action(Star, "Set as primary", () => { setPrimaryScenario(activeScenarioId); })}
            {action(Copy, "Duplicate", () => { duplicateScenario(); setCompareOpen(false); onClose(); })}
            {action(Pencil, "Rename", () => setRenaming(true))}
            {action(FileText, "Export for LLM", () => { openReport(activeScenarioId); onClose(); })}
            {scenarios.length > 1 && action(Trash2, "Delete", async () => {
              if (active && await confirm({ title: `Delete “${active.name}”?`, message: "This can't be undone.", confirmLabel: "Delete", danger: true })) { deleteScenario(active.id); onClose(); }
            }, true)}
          </>
        )}
      </div>
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
            <Settings size={15} /> Profile
          </button>
          <button onClick={() => { setOpen(false); useUIStore.getState().setPartnerOpen(true); }} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, marginTop: 2,
            padding: "10px", background: "transparent", border: "none", borderRadius: 8,
            color: C.inkMid, fontSize: 14, cursor: "pointer", textAlign: "left",
          }}>
            <Heart size={15} /> Partner alignment
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

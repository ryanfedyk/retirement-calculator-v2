"use client";
import { useState, useRef, useEffect } from "react";
import { Check, Cloud, LogOut, AlertCircle, Settings, ChevronDown, Wallet, LineChart, Compass, Pencil, Star, ArrowLeftRight, Plus, Copy, Trash2, FileText } from "lucide-react";
import { createPortal } from "react-dom";
import { C, SCENARIO_PALETTE as PALETTE } from "@/config/colors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCloudSync } from "@/lib/cloud/CloudSyncProvider";
import { useUIStore } from "@/store/useUIStore";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useConfirm } from "@/components/ui/DialogProvider";

export type AppView = "forecasting" | "financial";

interface Props {
  view: AppView;
  onViewChange: (v: AppView) => void;
  /** "compare" = the full-screen comparison destination (no view toggle);
   *  "scenario" = a scenario deep-dive (view toggle shown). */
  mode: "compare" | "scenario";
  /** Go home: exit compare and return to the primary scenario. */
  onBack?: () => void;
}

export default function Header({ view, onViewChange, mode, onBack }: Props) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      background: C.bgHeader,
      borderBottom: `1px solid ${C.border}`,
      padding: "14px 32px",
    }}>
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-3" style={{ minHeight: 36 }}>
        {/* Wordmark (home → primary scenario) + scenario switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={onBack}
            title="Home — your primary scenario"
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: 0,
              border: "none", background: "transparent", cursor: "pointer",
            }}
            onMouseEnter={(e) => { const s = e.currentTarget.querySelector("span"); if (s) s.style.color = C.teal; }}
            onMouseLeave={(e) => { const s = e.currentTarget.querySelector("span"); if (s) s.style.color = C.ink; }}
          >
            <div style={{ width: 2, height: 28, borderRadius: 2, background: C.teal, flexShrink: 0 }} />
            <span style={{ color: C.ink, fontSize: 12, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", lineHeight: 1, transition: "color 0.15s" }}>
              Taper
            </span>
          </button>

          <div style={{ width: 1, height: 20, background: C.border }} />
          {/* The scenario switcher — the navigational spine. Switch scenarios,
              jump to Compare, create a new one, or act on the current scenario. */}
          <ScenarioMenu comparing={mode === "compare"} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* View toggle — which view of this scenario. Icons + a "View" label so
              it reads as one switch. The view is named "Trajectory" (not
              "Financial") so it doesn't echo the "Finances" button beside it. */}
          {mode === "scenario" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkFaint }}>View</span>
              <div style={{
                display: "flex", background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: 3, gap: 2,
              }}>
                {([["financial", "Trajectory", LineChart], ["forecasting", "Reclaim", Compass]] as const).map(([v, label, Icon]) => (
                  <button
                    key={v}
                    onClick={() => onViewChange(v)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "5px 13px", borderRadius: 16,
                      border: "none", cursor: "pointer",
                      background: view === v ? C.bgCard : "transparent",
                      boxShadow: view === v ? `0 1px 3px ${C.border}` : "none",
                      color: view === v ? C.ink : C.inkSoft,
                      fontSize: 12, fontWeight: view === v ? 600 : 500,
                      transition: "all 0.15s",
                    }}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Shared finances — the balance sheet, reachable from anywhere. A clean
              wallet glyph (no label) keeps the header calm; the balance sheet is
              also reachable contextually by tapping the Portfolio Strength card on
              the scenario page. */}
          <button
            onClick={() => useUIStore.getState().setFinancesOpen(true)}
            aria-label="Your finances"
            title="Your finances — the balance sheet shared across every scenario"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.teal)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
          >
            <Wallet size={16} color={C.teal} />
          </button>

          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

/** The scenario switcher + command menu — the app's navigational spine. Switch
 * scenarios (the primary is starred), jump to the Compare destination, spin up a
 * new scenario, or act on the current one (set primary, duplicate, rename,
 * export, delete). A "Rename" flips the trigger into an inline edit. */
function ScenarioMenu({ comparing }: { comparing: boolean }) {
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
  const activeIdx = Math.max(0, scenarios.findIndex((s) => s.id === activeScenarioId));
  const isPrimaryActive = activeScenarioId === primaryScenarioId;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(active?.name ?? "");
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setName(active?.name ?? ""); }, [active?.name]);

  useEffect(() => {
    if (!open) return;
    const place = () => { const r = btnRef.current?.getBoundingClientRect(); if (r) setCoords({ top: r.bottom + 6, left: r.left }); };
    place();
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const commit = () => { const n = name.trim(); if (n) renameScenario(activeScenarioId, n); setEditing(false); };

  if (editing) {
    return (
      <input
        autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") { setName(active?.name ?? ""); setEditing(false); } }}
        aria-label="Scenario name"
        style={{ maxWidth: 240, border: `1px solid ${C.teal}`, borderRadius: 7, padding: "5px 8px", fontSize: 14, fontWeight: 700, color: C.ink, background: C.bg, outline: "none" }}
      />
    );
  }

  const pick = (id: string) => { setActiveScenario(id); setCompareOpen(false); setOpen(false); };
  const menuItem = (Icon: typeof Copy, text: string, fn: () => void, danger = false) => (
    <button
      onClick={() => { setOpen(false); fn(); }}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, color: danger ? C.warm : C.inkMid, textAlign: "left" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Icon size={14} /> {text}
    </button>
  );
  const sectionLabel = (t: string) => (
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint, padding: "8px 10px 4px" }}>{t}</div>
  );
  const divider = <div style={{ height: 1, background: C.borderSoft, margin: "5px 0" }} />;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch scenario"
        style={{ display: "inline-flex", alignItems: "center", gap: 7, maxWidth: 260, border: "none", background: open ? C.bg : "transparent", borderRadius: 7, padding: "5px 8px", cursor: "pointer", transition: "background 0.15s" }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = C.bg; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: PALETTE[activeIdx % PALETTE.length], flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {comparing ? "Comparing all" : active?.name ?? "Scenario"}
        </span>
        {!comparing && isPrimaryActive && <Star size={12} color={C.teal} fill={C.teal} style={{ flexShrink: 0 }} />}
        <ChevronDown size={15} color={C.inkSoft} style={{ flexShrink: 0 }} />
      </button>

      {open && coords && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 1000, width: 256, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: 6, maxHeight: "80vh", overflowY: "auto" }}>
          {sectionLabel("Switch scenario")}
          {scenarios.map((sc, i) => (
            <button key={sc.id} onClick={() => pick(sc.id)}
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderRadius: 7, cursor: "pointer", textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sc.name}</span>
              {sc.id === primaryScenarioId && <Star size={12} color={C.teal} fill={C.teal} style={{ flexShrink: 0 }} />}
              {sc.id === activeScenarioId && !comparing && <Check size={14} color={C.teal} style={{ flexShrink: 0 }} />}
            </button>
          ))}
          {divider}
          <button onClick={() => { setOpen(false); setCompareOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", background: comparing ? C.tealWash : "transparent", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, color: comparing ? C.tealDark : C.inkMid, textAlign: "left" }}
            onMouseEnter={(e) => { if (!comparing) e.currentTarget.style.background = C.bg; }}
            onMouseLeave={(e) => { if (!comparing) e.currentTarget.style.background = "transparent"; }}
          >
            <ArrowLeftRight size={14} /> Compare all scenarios
          </button>
          {menuItem(Plus, "New scenario", () => { addScenario(); setCompareOpen(false); })}
          {divider}
          {sectionLabel("This scenario")}
          {!isPrimaryActive && menuItem(Star, "Set as primary", () => setPrimaryScenario(activeScenarioId))}
          {menuItem(Copy, "Duplicate", () => { duplicateScenario(); setCompareOpen(false); })}
          {menuItem(Pencil, "Rename", () => setEditing(true))}
          {menuItem(FileText, "Export for LLM", () => openReport(activeScenarioId))}
          {scenarios.length > 1 && menuItem(Trash2, "Delete", async () => {
            if (active && await confirm({ title: `Delete “${active.name}”?`, message: "This can't be undone.", confirmLabel: "Delete", danger: true })) deleteScenario(active.id);
          }, true)}
        </div>,
        document.body
      )}
    </>
  );
}

function SaveIndicator() {
  const { status } = useCloudSync();
  const map = {
    idle:   { icon: Cloud,       text: "Synced", color: C.inkFaint },
    saving: { icon: Cloud,       text: "Saving…", color: C.inkSoft },
    saved:  { icon: Check,       text: "Saved",   color: C.teal },
    error:  { icon: AlertCircle, text: "Offline", color: C.warm },
  }[status];
  const Icon = map.icon;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: map.color }}>
      <Icon size={13} /> {map.text}
    </div>
  );
}

function AccountMenu() {
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

  const label = user.displayName || user.email || "Account";
  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`,
          background: C.tealWash, color: C.tealDark, fontSize: 13, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}
        aria-label="Account menu"
      >
        {initial}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", width: 220, zIndex: 1000,
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
          boxShadow: `0 6px 20px ${C.border}`, padding: 8,
        }}>
          <div style={{ padding: "8px 10px 10px", borderBottom: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {label}
            </div>
            {user.email && user.displayName && (
              <div style={{ fontSize: 11, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </div>
            )}
            <div style={{ marginTop: 8 }}><SaveIndicator /></div>
          </div>
          <button
            onClick={() => { setOpen(false); useUIStore.getState().setSettingsOpen(true); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, marginTop: 6,
              padding: "9px 10px", background: "transparent", border: "none", borderRadius: 8,
              color: C.inkMid, fontSize: 13, cursor: "pointer", textAlign: "left",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <Settings size={14} /> Profile
          </button>
          <button
            onClick={() => { setOpen(false); signOutUser(); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, marginTop: 6,
              padding: "9px 10px", background: "transparent", border: "none", borderRadius: 8,
              color: C.inkMid, fontSize: 13, cursor: "pointer", textAlign: "left",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

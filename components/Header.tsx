"use client";
import { useState, useRef, useEffect } from "react";
import { Check, Cloud, LogOut, AlertCircle, Settings, ChevronRight, ChevronDown, Wallet, LineChart, Compass } from "lucide-react";
import { C } from "@/config/colors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCloudSync } from "@/lib/cloud/CloudSyncProvider";
import { useUIStore } from "@/store/useUIStore";
import { useFinancialStore } from "@/store/useFinancialStore";

export type AppView = "forecasting" | "financial";

interface Props {
  view: AppView;
  onViewChange: (v: AppView) => void;
  /** "hub" = scenarios landing (no view toggle); "scenario" = deep-dive (back + toggle). */
  mode: "hub" | "scenario";
  onBack?: () => void;
}

export default function Header({ view, onViewChange, mode, onBack }: Props) {
  return (
    <header style={{
      background: C.bgHeader,
      borderBottom: `1px solid ${C.border}`,
      padding: "14px 32px",
    }}>
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {/* Wordmark + (deep-dive) back-to-scenarios breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 2, height: 28, borderRadius: 2, background: C.teal, flexShrink: 0 }} />
            <div style={{ color: C.ink, fontSize: 12, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", lineHeight: 1 }}>
              Taper
            </div>
          </div>

          {mode === "scenario" && (
            <>
              <div style={{ width: 1, height: 20, background: C.border }} />
              {/* Breadcrumb: "Scenarios › [active scenario ▾]". Clicking the root
                  goes back to the hub; the dropdown switches the active scenario.
                  The hierarchy makes "leave" vs "switch" unambiguous. */}
              <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={onBack}
                  title="Back to all scenarios"
                  style={{
                    display: "flex", alignItems: "center", padding: "5px 4px",
                    border: "none", background: "transparent", cursor: "pointer",
                    color: C.inkSoft, fontSize: 12, fontWeight: 600,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = C.ink)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = C.inkSoft)}
                >
                  Scenarios
                </button>
                <ChevronRight size={14} color={C.inkFaint} style={{ flexShrink: 0 }} />
                <ScenarioSelect />
              </nav>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* View toggle — which view of this scenario. Icons + a "View" label so
              it reads as one switch, and so "Financial" isn't mistaken for the
              shared "Balance Sheet" button beside it. */}
          {mode === "scenario" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkFaint }}>View</span>
              <div style={{
                display: "flex", background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: 3, gap: 2,
              }}>
                {([["financial", "Financial", LineChart], ["forecasting", "Forecasting", Compass]] as const).map(([v, label, Icon]) => (
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

          {/* Shared balance sheet — reachable from anywhere. Named "Balance Sheet"
              (not "Finances") so it's clearly distinct from the "Financial" view. */}
          <button
            onClick={() => useUIStore.getState().setFinancesOpen(true)}
            title="Your balance sheet — assets & liabilities shared across every scenario"
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
              borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer",
              color: C.inkSoft, fontSize: 12, fontWeight: 600,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.ink)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.inkSoft)}
          >
            <Wallet size={14} color={C.teal} /> Balance Sheet
          </button>

          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

/** Switch the active scenario without leaving the deep-dive. The selection
 * drives the countdown and both tabs (everything reads the active scenario). */
function ScenarioSelect() {
  const scenarios = useFinancialStore((s) => s.scenarios);
  const activeScenarioId = useFinancialStore((s) => s.activeScenarioId);
  const setActiveScenario = useFinancialStore((s) => s.setActiveScenario);

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <select
        value={activeScenarioId}
        onChange={(e) => setActiveScenario(e.target.value)}
        aria-label="Active scenario"
        style={{
          appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
          maxWidth: 220, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "6px 28px 6px 11px", fontSize: 13, fontWeight: 700, color: C.ink,
          background: C.bgCard, outline: "none", cursor: "pointer",
        }}
      >
        {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <ChevronDown size={14} color={C.inkSoft} style={{ position: "absolute", right: 9, pointerEvents: "none" }} />
    </div>
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
            <Settings size={14} /> Settings
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

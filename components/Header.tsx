"use client";
import { useState, useRef, useEffect } from "react";
import { Check, Cloud, LogOut, AlertCircle } from "lucide-react";
import { C } from "@/config/colors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCloudSync } from "@/lib/cloud/CloudSyncProvider";

export type AppView = "forecasting" | "financial";

interface Props {
  view: AppView;
  onViewChange: (v: AppView) => void;
}

export default function Header({ view, onViewChange }: Props) {
  return (
    <header style={{
      background: C.bgHeader,
      borderBottom: `1px solid ${C.border}`,
      padding: "14px 32px",
    }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 2, height: 28, borderRadius: 2, background: C.teal, flexShrink: 0 }} />
          <div>
            <div style={{ color: C.ink, fontSize: 12, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", lineHeight: 1 }}>
              Taper
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* View toggle */}
          <div style={{
            display: "flex", background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 20, padding: 3, gap: 2,
          }}>
            {(["financial", "forecasting"] as AppView[]).map(v => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                style={{
                  padding: "5px 16px", borderRadius: 16,
                  border: "none", cursor: "pointer",
                  background: view === v ? C.bgCard : "transparent",
                  boxShadow: view === v ? `0 1px 3px ${C.border}` : "none",
                  color: view === v ? C.ink : C.inkSoft,
                  fontSize: 10, fontWeight: view === v ? 600 : 400,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  transition: "all 0.15s",
                }}
              >
                {v === "forecasting" ? "Forecasting" : "Financial"}
              </button>
            ))}
          </div>

          <AccountMenu />
        </div>
      </div>
    </header>
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

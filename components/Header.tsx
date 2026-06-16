"use client";
import { C } from "@/config/colors";

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
              Horizon
            </div>
            <div style={{ color: C.inkSoft, fontSize: 8.5, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 3 }}>
              The Elegant Taper
            </div>
          </div>
        </div>

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
      </div>
    </header>
  );
}

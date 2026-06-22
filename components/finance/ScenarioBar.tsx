"use client";
/**
 * ScenarioBar — compact scenario builder used on mobile: the scenario switcher
 * plus the "What if…" shortcuts (each clones the active scenario, applies its
 * tweak, and switches to it, with a live FI-date preview). On desktop this role
 * is filled by the full ScenariosHub.
 */
import { Sparkles } from "lucide-react";
import { C } from "@/config/colors";
import ScenarioSwitcher from "./ScenarioSwitcher";
import { useScenarioSuggestions } from "@/hooks/useScenarioSuggestions";
import type { LivePrices } from "@/hooks/useLivePrices";

export default function ScenarioBar({ livePrices = {} }: { livePrices?: LivePrices }) {
  const suggestions = useScenarioSuggestions(livePrices);

  return (
    <div className="px-4 min-[700px]:px-8" style={{ background: C.bgHeader, borderBottom: `1px solid ${C.border}`, paddingTop: 8, paddingBottom: 8 }}>
      <div className="max-w-7xl mx-auto w-full" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <ScenarioSwitcher />

        <div style={{ width: 1, height: 22, background: C.border, flexShrink: 0 }} className="hidden min-[900px]:block" />

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft }}>
            <Sparkles size={13} color={C.teal} /> What if…
          </span>
          {suggestions.map((s) => (
            <button
              key={s.title}
              onClick={s.build}
              title={`Create a new scenario: ${s.title}`}
              style={{
                display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 1,
                padding: "5px 11px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.bgCard,
                cursor: "pointer", transition: "all 0.15s", lineHeight: 1.15,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{s.title}</span>
              <span style={{ display: "flex", gap: 8, fontSize: 10, fontWeight: 600 }}>
                <span style={{ color: s.nwColor }}>{s.nwDelta}</span>
                <span style={{ color: s.fiColor }}>FI {s.fiDelta}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

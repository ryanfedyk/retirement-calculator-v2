"use client";
import { useState } from "react";
import { Sparkles, Plus } from "lucide-react";
import { C } from "@/config/colors";
import { useScenarioSuggestions } from "@/hooks/useScenarioSuggestions";
import type { LivePrices } from "./FinancialDashboard";

/** "Branch this scenario" — diverse offshoots of the current plan (retire a year
 * sooner, take a sabbatical, trim spending…). Collapsed, it's one slim teaser
 * line (a hint of the ideas); expanded, it's a horizontally-scrollable carousel
 * of cards with the time/money trade-off. Building one creates a real branch. */
export function BranchStrip({ livePrices, title = "Branch this scenario", subtitle = "· spin off a variation" }: { livePrices: LivePrices; title?: string; subtitle?: string }) {
  const suggestions = useScenarioSuggestions(livePrices);
  const [expanded, setExpanded] = useState(false);
  if (!suggestions.length) return null;
  const teaser = suggestions.slice(0, 3).map((s) => s.title).join(" · ") + (suggestions.length > 3 ? ` · +${suggestions.length - 3}` : "");

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "2px 0" }}
      >
        <Sparkles size={13} color={C.inkFaint} style={{ flexShrink: 0 }} />
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint }}>{title}</span>
        {expanded ? (
          <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: C.inkFaint }}>{subtitle}</span>
        ) : (
          <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teaser}</span>
        )}
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.teal }}>
          {expanded ? "Show less ▴" : `Show all ${suggestions.length} ▾`}
        </span>
      </button>

      {expanded && (
        <div className="no-scrollbar" style={{ display: "flex", flexWrap: "nowrap", gap: 10, overflowX: "auto", paddingBottom: 4, marginTop: 10, scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" }}>
          {suggestions.map((s, j) => (
            <button
              key={j}
              onClick={s.build}
              title={`Branch a new scenario: ${s.title}`}
              style={{
                flex: "0 0 auto", width: 200, textAlign: "left", display: "flex", flexDirection: "column", gap: 6,
                padding: "11px 13px", borderRadius: 10, border: `1px dashed ${C.border}`, background: "transparent", cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.tealLight; e.currentTarget.style.background = C.bgCard; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: C.inkMid, minWidth: 0 }}>
                <Plus size={13} color={C.inkFaint} style={{ flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
              </span>
              <span style={{ fontSize: 10.5, color: C.inkSoft, lineHeight: 1.35 }}>{s.detail}</span>
              <div style={{ display: "flex", gap: 14, marginTop: 2 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint }}>Freedom</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: s.timeColor, fontVariantNumeric: "tabular-nums" }}>{s.timeDelta}</div>
                  {s.timeHours && <div style={{ fontSize: 8.5, color: C.inkFaint, whiteSpace: "nowrap" }}>{s.timeHours}</div>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint }}>Net worth</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: s.nwColor, fontVariantNumeric: "tabular-nums" }}>{s.nwDelta}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

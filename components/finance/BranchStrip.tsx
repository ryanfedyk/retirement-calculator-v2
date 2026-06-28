"use client";
import { useState } from "react";
import { Sparkles, Check, Plus, CopyPlus, Clock, TrendingUp } from "lucide-react";
import { C } from "@/config/colors";
import { useScenarioSuggestions, type Suggestion } from "@/hooks/useScenarioSuggestions";
import type { LivePrices } from "./FinancialDashboard";

/** "What if…" — moves you can make on the plan. It leads with the three career
 * phases (Sabbatical, Career Jump, Bridge Job), then broader what-ifs (retire a
 * year sooner, trim spending…). Each card offers two moves: **Apply** changes the
 * scenario you're in right now, **Duplicate** spins it off into a new scenario.
 * Expanded by default as a horizontally-scrollable carousel; collapses to a slim
 * teaser line. */
export function BranchStrip({ livePrices, title = "What if…", subtitle = "· apply a move or spin off a copy" }: { livePrices: LivePrices; title?: string; subtitle?: string }) {
  const suggestions = useScenarioSuggestions(livePrices);
  const [expanded, setExpanded] = useState(true);
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
          {suggestions.map((s, j) => <Card key={j} s={s} />)}
        </div>
      )}
    </div>
  );
}

/** A compact "what if" card. The whole card is the primary action — clicking it
 * applies the move to the current scenario (an active phase toggles back off). A
 * small secondary "open in a new scenario" button sits in the corner. */
function Card({ s }: { s: Suggestion }) {
  const isPhase = s.kind === "phase";
  const accent = isPhase ? C.teal : C.inkFaint;
  const apply = () => s.apply();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={apply}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apply(); } }}
      title={s.active ? "Click to remove from this scenario" : "Click to apply to this scenario"}
      style={{
        position: "relative", flex: "0 0 auto", width: 158, textAlign: "left", display: "flex", flexDirection: "column", gap: 4,
        padding: "9px 10px", borderRadius: 9, cursor: "pointer",
        border: `1px ${isPhase ? "solid" : "dashed"} ${s.active ? C.tealLight : C.border}`,
        background: s.active ? C.tealWash : "transparent", transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => { if (!s.active) { e.currentTarget.style.borderColor = C.tealLight; e.currentTarget.style.background = C.bgCard; } }}
      onMouseLeave={(e) => { if (!s.active) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; } }}
    >
      {/* Secondary move: spin the idea off into its own scenario. */}
      <button
        onClick={(e) => { e.stopPropagation(); s.duplicate(); }}
        title="Open in a new scenario"
        aria-label="Open in a new scenario"
        style={{
          position: "absolute", top: 6, right: 6, display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: C.bgCard, color: C.inkSoft, cursor: "pointer",
        }}
      >
        <CopyPlus size={12} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, paddingRight: 24 }}>
        {isPhase ? <Sparkles size={11} color={accent} style={{ flexShrink: 0 }} /> : <Plus size={12} color={accent} style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: C.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
      </div>

      <span style={{ fontSize: 10, color: C.inkSoft, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.detail}</span>

      {/* Compact trade-off footer — or an "active" marker for a phase in the plan. */}
      {s.active ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: C.tealDark }}>
          <Check size={10} /> In this plan
        </span>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: s.timeColor }}>
            <Clock size={10} /> {s.timeDelta}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: s.nwColor }}>
            <TrendingUp size={10} /> {s.nwDelta}
          </span>
        </div>
      )}
    </div>
  );
}

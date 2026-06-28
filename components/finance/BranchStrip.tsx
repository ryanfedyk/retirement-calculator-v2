"use client";
import { useState } from "react";
import { Sparkles, Check, Plus, Copy } from "lucide-react";
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

/** A single "what if" card: title + plain-language detail + the time/money
 * trade-off (or an "active" state for a phase already in the plan), then the two
 * moves — Apply (to this scenario) and Duplicate (into a new one). */
function Card({ s }: { s: Suggestion }) {
  const isPhase = s.kind === "phase";
  const accent = isPhase ? C.teal : C.inkFaint;
  return (
    <div
      style={{
        flex: "0 0 auto", width: 212, textAlign: "left", display: "flex", flexDirection: "column", gap: 7,
        padding: "12px 13px", borderRadius: 10,
        border: `1px ${isPhase ? "solid" : "dashed"} ${s.active ? C.tealLight : C.border}`,
        background: s.active ? C.tealWash : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        {isPhase ? <Sparkles size={12} color={accent} style={{ flexShrink: 0 }} /> : <Plus size={13} color={accent} style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: C.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
        {s.active && (
          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: C.tealDark, background: "#ffffffcc", borderRadius: 5, padding: "1px 5px" }}>
            <Check size={9} /> Active
          </span>
        )}
      </div>

      <span style={{ fontSize: 10.5, color: C.inkSoft, lineHeight: 1.35, minHeight: 28 }}>{s.detail}</span>

      {/* Active phases are already baked into the plan — no delta to show. */}
      {!s.active && (
        <div style={{ display: "flex", gap: 14, marginTop: 1 }}>
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
      )}

      {/* Two moves: Apply to this scenario · Duplicate into a new one. An active
          phase's Apply removes it instead. */}
      <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 4 }}>
        <button
          onClick={s.apply}
          title={s.active ? "Remove from this scenario" : "Apply to this scenario"}
          style={{
            flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
            padding: "6px 8px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700,
            border: "none",
            background: s.active ? C.bg : C.teal,
            color: s.active ? C.inkMid : "#fff",
          }}
        >
          {s.active ? "Remove" : "Apply"}
        </button>
        <button
          onClick={s.duplicate}
          title="Duplicate into a new scenario"
          style={{
            flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
            padding: "6px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700,
            border: `1px solid ${C.border}`, background: C.bgCard, color: C.tealDark,
          }}
        >
          <Copy size={12} /> Copy
        </button>
      </div>
    </div>
  );
}

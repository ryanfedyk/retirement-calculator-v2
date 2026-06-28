"use client";
import { Sparkles, Check, CopyPlus, ChevronRight } from "lucide-react";
import { C } from "@/config/colors";
import { useScenarioSuggestions, type Suggestion } from "@/hooks/useScenarioSuggestions";
import type { LivePrices } from "./FinancialDashboard";

/** "What if…" — moves you can make on the plan. It leads with the three career
 * phases (Sabbatical, Career Jump, Bridge Job), then broader what-ifs (retire a
 * year sooner, trim spending…). Each card offers two moves: clicking it applies
 * the move to the current scenario; the corner button spins it off into a new
 * one. A simple horizontally-scrollable carousel — always shown. */
export function BranchStrip({ livePrices, title = "What if…", subtitle = "· tap to apply · ⧉ opens a copy" }: { livePrices: LivePrices; title?: string; subtitle?: string }) {
  const suggestions = useScenarioSuggestions(livePrices);
  if (!suggestions.length) return null;
  // With more cards than comfortably fit, hint that the row scrolls sideways.
  const scrolls = suggestions.length > 2;
  const fade = scrolls
    ? { WebkitMaskImage: "linear-gradient(to right, #000 86%, transparent)", maskImage: "linear-gradient(to right, #000 86%, transparent)" }
    : {};

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
        <Sparkles size={13} color={C.inkFaint} style={{ flexShrink: 0 }} />
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint }}>{title}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: C.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>
        {scrolls && (
          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.teal }}>
            Swipe <ChevronRight size={12} />
          </span>
        )}
      </div>

      <div className="no-scrollbar" style={{ display: "flex", flexWrap: "nowrap", gap: 10, overflowX: "auto", paddingBottom: 4, marginTop: 10, scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch", ...fade }}>
        {suggestions.map((s, j) => <Card key={j} s={s} />)}
      </div>
    </div>
  );
}

/** A compact "what if" card. The whole card is the primary action — clicking it
 * applies the move to the current scenario (an active phase toggles back off). A
 * small corner button spins it off into a new scenario. */
function Card({ s }: { s: Suggestion }) {
  const isPhase = s.kind === "phase";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => s.apply()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); s.apply(); } }}
      title={s.active ? "Click to remove from this scenario" : "Click to apply to this scenario"}
      style={{
        position: "relative", flex: "0 0 auto", width: 162, textAlign: "left", display: "flex", flexDirection: "column", gap: 5,
        padding: "10px 11px", borderRadius: 9, cursor: "pointer",
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
          position: "absolute", top: 7, right: 7, display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.border}`, background: C.bgCard, color: C.inkSoft, cursor: "pointer",
        }}
      >
        <CopyPlus size={12} />
      </button>

      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 24 }}>{s.title}</span>

      <span style={{ fontSize: 10, color: C.inkSoft, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.detail}</span>

      {/* One-line trade-off: freedom · net worth (or an "active" marker). */}
      {s.active ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: C.tealDark }}>
          <Check size={10} /> In this plan
        </span>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ color: s.timeColor }}>{s.timeDelta}</span>
          <span style={{ color: C.border }}>·</span>
          <span style={{ color: s.nwColor }}>{s.nwDelta}</span>
        </div>
      )}
    </div>
  );
}

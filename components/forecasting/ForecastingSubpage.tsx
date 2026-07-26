"use client";
import { ArrowLeft } from "lucide-react";
import { R, SERIF } from "./reclaimTheme";
import { TOOLS, toolIsFill, ForecastingToolBody, type ToolId } from "./ForecastingHub";

/**
 * A launched forecasting tool as a header-preserving SUBPAGE (desktop). Unlike
 * the mobile ToolStage overlay, this lives in the page under the app header:
 * a slim "back to tools" bar with the tool's name, then the tool filling the
 * rest of the height. Expects to sit in a `flex-1; min-height:0` region so the
 * body can bound its own scroll.
 */
export default function ForecastingSubpage({ id, onBack }: { id: ToolId; onBack: () => void }) {
  const meta = TOOLS.find((t) => t.id === id)!;
  const fill = toolIsFill(id);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: R.ground }}>
      {/* Back + title bar */}
      <div style={{ flexShrink: 0, padding: "16px 32px 12px", borderBottom: `1px solid ${R.lineSoft}` }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 12,
            border: `1px solid ${R.line}`, background: R.card, color: R.inkSoft, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
          }}>
            <ArrowLeft size={15} /> All tools
          </button>
          <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500, color: R.ink, letterSpacing: "-0.01em", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.title}</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: R.inkFaint, flexShrink: 0 }}>{meta.eyebrow}</span>
          </div>
        </div>
      </div>

      {/* Body — fill tools own their scroll; the rest scroll as one column. */}
      <div style={fill
        ? { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", padding: "16px 32px 20px" }
        : { flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "24px 32px 40px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", width: "100%", ...(fill ? { flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" } : {}) }}>
          <ForecastingToolBody id={id} />
        </div>
      </div>
    </div>
  );
}

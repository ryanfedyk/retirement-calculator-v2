"use client";
import { useState } from "react";
import { Anchor, Sparkles, Wind, ArrowUpRight, type LucideIcon } from "lucide-react";
import MacroSeasonsTimeline from "@/components/MacroSeasonsTimeline";
import ReclaimedTimeCalculator from "@/components/ReclaimedTimeCalculator";
import ReclaimJourney from "./ReclaimJourney";
import ToolStage from "./ToolStage";
import { R, SERIF } from "./reclaimTheme";

export type ToolId = "seasons" | "design" | "reclaim";

type Tool = {
  id: ToolId;
  label: string;
  eyebrow: string;
  title: string;        // the name shown on the tool card + stage
  blurb: string;        // one evocative line
  icon: LucideIcon;
  accent: string;       // landscape accent
};

export const TOOLS: Tool[] = [
  { id: "seasons", label: "Wind-down", eyebrow: "Seasons of your life", title: "The Wind-Down", blurb: "How work winds down — the seasons of easing out of the job, and just where you stand today.", icon: Anchor,   accent: R.sea },
  { id: "reclaim", label: "Gains",     eyebrow: "Reclaim your time",    title: "What You Gain",  blurb: "The prime-time weeks you gain back — a clear picture of what stepping away sooner returns to you.", icon: Wind,     accent: R.gold },
  { id: "design",  label: "Retirement life", eyebrow: "Design your life", title: "Your Retirement Life", blurb: "Compose the days, gather the year, and design your retirement life on the far side of work.", icon: Sparkles, accent: R.accent },
];

/** The design tool manages its own height/scroll (pinned footers); the others
 *  are simple scrolling columns. */
export const toolIsFill = (id: ToolId) => id === "design";

/** Render a launched tool's body — shared by the mobile overlay and the desktop
 *  subpage so both stay in sync. */
export function ForecastingToolBody({ id }: { id: ToolId }) {
  if (id === "seasons") return <MacroSeasonsTimeline />;
  if (id === "reclaim") return <ReclaimedTimeCalculator />;
  return <ReclaimJourney framed />;
}

/**
 * The forecasting section as a hub: three tools, each a card that opens a
 * focused experience. On desktop the parent shell owns that experience as a
 * header-preserving subpage (via `onLaunch`); on mobile the hub opens it in a
 * full-screen ToolStage overlay itself.
 */
export default function ForecastingHub({ onLaunch }: { onLaunch?: (id: ToolId) => void } = {}) {
  const [launched, setLaunched] = useState<ToolId | null>(null);
  const open = (id: ToolId) => (onLaunch ? onLaunch(id) : setLaunched(id));

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: R.accentInk, marginBottom: 4 }}>
        Design your next chapter
      </div>
      <h2 style={{ fontFamily: SERIF, fontSize: "clamp(22px, 5.5vw, 30px)", fontWeight: 500, color: R.ink, letterSpacing: "-0.015em", lineHeight: 1.12, margin: "0 0 16px", textWrap: "balance" }}>
        Wind down from work, see what you gain, design what&apos;s next.
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => open(t.id)} style={{
              position: "relative", textAlign: "left", cursor: "pointer",
              display: "flex", flexDirection: "column", gap: 12, minHeight: 152,
              padding: "18px 18px 16px", borderRadius: 20,
              border: `1px solid color-mix(in oklab, ${t.accent} 26%, ${R.line})`,
              background: `linear-gradient(160deg, color-mix(in oklab, ${t.accent} 9%, ${R.card}), ${R.card})`,
              transition: "border-color 0.18s, transform 0.18s",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 13,
                  background: `color-mix(in oklab, ${t.accent} 15%, ${R.card2})`, color: t.accent,
                  border: `1px solid color-mix(in oklab, ${t.accent} 30%, ${R.line})`,
                }}><Icon size={20} strokeWidth={1.9} /></span>
                <ArrowUpRight size={18} color={R.inkFaint} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: t.accent, marginBottom: 4 }}>{t.eyebrow}</div>
                <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: R.ink, letterSpacing: "-0.01em", lineHeight: 1.1 }}>{t.title}</div>
                <div style={{ fontSize: 12.5, color: R.inkSoft, lineHeight: 1.5, marginTop: 6 }}>{t.blurb}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mobile (no onLaunch): open the tool in a full-screen overlay. */}
      {!onLaunch && launched && (
        <ToolStage
          eyebrow={TOOLS.find((t) => t.id === launched)!.eyebrow}
          title={TOOLS.find((t) => t.id === launched)!.title}
          onClose={() => setLaunched(null)}
          fill={toolIsFill(launched)}
        >
          <ForecastingToolBody id={launched} />
        </ToolStage>
      )}
    </div>
  );
}

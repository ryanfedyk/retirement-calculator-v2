"use client";
import { useState } from "react";
import { Anchor, Sparkles, Wind, ArrowUpRight, type LucideIcon } from "lucide-react";
import MacroSeasonsTimeline from "@/components/MacroSeasonsTimeline";
import ReclaimedTimeCalculator from "@/components/ReclaimedTimeCalculator";
import ReclaimJourney from "./ReclaimJourney";
import ToolStage from "./ToolStage";
import { R, SERIF } from "./reclaimTheme";

type ToolId = "seasons" | "design" | "reclaim";

type Tool = {
  id: ToolId;
  label: string;
  eyebrow: string;
  title: string;        // the name shown on the tool card + stage
  blurb: string;        // one evocative line
  icon: LucideIcon;
  accent: string;       // landscape accent
};

const TOOLS: Tool[] = [
  { id: "seasons", label: "Seasons", eyebrow: "The map",     title: "Seasons of your life", blurb: "The chapters ahead — and just where you stand in them right now.", icon: Anchor,   accent: R.sea },
  { id: "design",  label: "Design",  eyebrow: "The studio",  title: "Design your life",     blurb: "Compose the days, gather the year, and watch the whole arc take shape.", icon: Sparkles, accent: R.accent },
  { id: "reclaim", label: "Reclaim", eyebrow: "The river",   title: "Reclaim your time",    blurb: "See the prime-time weeks you win back by stepping away sooner.",   icon: Wind,     accent: R.gold },
];

/**
 * The forecasting section as a hub: three tools, each a card that launches a
 * focused, full-screen experience (ToolStage). Keeps the section calm — a clear
 * choice of where to go — rather than a switcher that stacks everything inline.
 */
export default function ForecastingHub() {
  const [launched, setLaunched] = useState<ToolId | null>(null);
  const close = () => setLaunched(null);

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: R.accentInk, marginBottom: 4 }}>
        Design your next chapter
      </div>
      <h2 style={{ fontFamily: SERIF, fontSize: "clamp(22px, 5.5vw, 30px)", fontWeight: 500, color: R.ink, letterSpacing: "-0.015em", lineHeight: 1.12, margin: "0 0 16px", textWrap: "balance" }}>
        Three ways to picture the life ahead.
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setLaunched(t.id)} style={{
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

      {launched && (
        <ToolStage
          eyebrow={TOOLS.find((t) => t.id === launched)!.eyebrow}
          title={TOOLS.find((t) => t.id === launched)!.title}
          onClose={close}
          fill={launched === "design"}
        >
          {launched === "seasons" && <MacroSeasonsTimeline />}
          {launched === "reclaim" && <ReclaimedTimeCalculator />}
          {launched === "design"  && <ReclaimJourney framed />}
        </ToolStage>
      )}
    </div>
  );
}

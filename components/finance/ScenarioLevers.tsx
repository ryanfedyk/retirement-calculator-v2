"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { C } from "@/config/colors";
import { colTier } from "@/lib/fire/moments";
import { BranchStrip } from "./BranchStrip";
import type { LivePrices } from "./FinancialDashboard";
import type { RetirementWindow } from "@/engine/calculator";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** A concise, plain-language summary of what this scenario is about — exit year,
 * spending, and any career phases in play. Shown atop "Tune this scenario" in
 * place of the old phase chips (phases now live in the "What if…" cards). */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function describeScenario(cp: { exit_year: number; exit_month?: number; use_sabbatical?: boolean; sabbatical_duration?: number; use_jump?: boolean; use_bridge?: boolean }, monthlySpend: number): string {
  const phases: string[] = [];
  if (cp.use_sabbatical) phases.push(cp.sabbatical_duration === 1 ? "a year-long sabbatical" : `a ${cp.sabbatical_duration ?? 1}-year sabbatical`);
  if (cp.use_jump) phases.push("a career jump");
  if (cp.use_bridge) phases.push("a bridge job");
  const when = (cp.exit_month ?? 0) > 0 ? `${MONTHS[cp.exit_month!]} ${cp.exit_year}` : String(cp.exit_year);
  let s = `Leave work in ${when} and live on ${money(monthlySpend)}/mo`;
  if (phases.length) {
    const list = phases.length === 1 ? phases[0]
      : phases.length === 2 ? `${phases[0]} and ${phases[1]}`
      : `${phases.slice(0, -1).join(", ")}, and ${phases[phases.length - 1]}`;
    s += `, with ${list} along the way`;
  }
  return `${s}.`;
}

/** A small chip that reveals an explanatory tooltip on hover/focus. The acronym
 * code is dropped on narrow screens (emoji stays) to protect the layout. */
function TipChip({ emoji, code, tip, color }: { emoji: string; code: string; tip: string; color: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      tabIndex={0}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)} onBlur={() => setShow(false)}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3, cursor: "help", outline: "none",
        fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", color, background: `${color}1a`, borderRadius: 5, padding: "1px 5px" }}
    >
      <span aria-hidden>{emoji}</span>
      {/* Container-query: drop the acronym when the levers row is narrow so the
          slider's value never wraps to a second line (the emoji + tooltip stay). */}
      <span className="hidden @min-[460px]:inline">{code}</span>
      {show && (
        <span role="tooltip" style={{
          position: "absolute", bottom: "calc(100% + 7px)", left: "50%", transform: "translateX(-50%)",
          whiteSpace: "nowrap", zIndex: 20, background: C.ink, color: "#fff", fontSize: 11, fontWeight: 600,
          letterSpacing: 0, padding: "6px 9px", borderRadius: 7, boxShadow: "0 4px 14px rgba(0,0,0,0.22)", pointerEvents: "none",
        }}>
          {tip}
          <span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `5px solid ${C.ink}` }} />
        </span>
      )}
    </span>
  );
}

function Slider({ label, value, display, min, max, step, accent, onChange, badge, caption }: {
  label: string; value: number; display: string; min: number; max: number; step: number; accent: string; onChange: (v: number) => void; badge?: React.ReactNode; caption?: string;
}) {
  return (
    <div style={{ flex: "1 1 150px", minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, whiteSpace: "nowrap", display: "flex", alignItems: "baseline", gap: 5 }}>
          {label}
          {caption && <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: "none", color: C.inkSoft }}>· {caption}</span>}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          {/* Drop the badge before the headline ever wraps when the column is tight. */}
          {badge && <span className="hidden @min-[420px]:inline-flex" style={{ alignItems: "center" }}>{badge}</span>}
          {display}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: accent, cursor: "pointer" }} />
    </div>
  );
}

/**
 * Scenario levers — the headline of the Financial tab. Compact sliders + phase
 * toggles that update the live trajectory instantly. This is the "play with it"
 * surface: a summary plus quick adjustment of the key knobs. Pass `onOpenEditor`
 * to surface a "click in" affordance into the full, more robust editor (mobile
 * uses this to open the config sheet); detailed inputs all live there.
 */
export default function ScenarioLevers({ onOpenEditor, livePrices, retireWindow, bare }: { onOpenEditor?: () => void; livePrices?: LivePrices; retireWindow?: RetirementWindow; bare?: boolean } = {}) {
  const { config, updateNestedConfig } = useFinancialStore();
  const cp = config.career_path;
  const sp = config.spending;
  const ma = config.market_assumptions;
  const currentYear = new Date().getFullYear();
  // Exit-year range: today → the year they turn 70 (guard a pre-set later exit).
  const maxExit = Math.max((config.birth_year || 1985) + 70, cp.exit_year);
  const earliestExit = retireWindow?.earliest ?? null;

  const setExit = (yr: number) => {
    updateNestedConfig("career_path", { exit_year: yr });
    if (config.divestment_strategy.type === "progressive") {
      const w = config.divestment_strategy.end_year - config.divestment_strategy.start_year;
      updateNestedConfig("divestment_strategy", { start_year: yr, end_year: yr + w });
    }
  };

  // `bare` drops the card chrome so the section lives directly on the canvas
  // (mobile uses this to cut visual complexity).
  const shell: React.CSSProperties = bare
    ? { flexShrink: 0, padding: "2px 2px 4px" }
    : { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", boxShadow: `0 1px 3px ${C.border}`, flexShrink: 0 };
  return (
    <div style={shell}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ width: 3, height: 15, borderRadius: 2, background: C.teal }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.ink }}>Tune this scenario</span>
      </div>

      {/* Plain-language gist of the scenario — replaces the old phase chips
          (phases now live as cards in the "What if…" strip below). */}
      <p style={{ fontSize: 13, lineHeight: 1.5, color: C.inkMid, margin: "0 0 14px" }}>
        {describeScenario(cp, sp.monthly_lifestyle)}
      </p>

      <div className="@container" style={{ display: "flex", flexWrap: "wrap", gap: "14px 22px", marginBottom: 14 }}>
        <Slider label="Exit Year" value={cp.exit_year} display={String(cp.exit_year)}
          min={currentYear} max={maxExit} step={1} accent={C.teal} onChange={setExit}
          caption={earliestExit ? `Earliest ${earliestExit}` : undefined} />
        <Slider label="Monthly Spend" value={sp.monthly_lifestyle} display={money(sp.monthly_lifestyle)}
          min={3000} max={20000} step={250} accent={C.warm}
          badge={(() => { const t = colTier(sp.monthly_lifestyle); return (
            <TipChip emoji={t.emoji} code={t.code} tip={t.label} color={t.color} />
          ); })()}
          onChange={v => updateNestedConfig("spending", { monthly_lifestyle: v })} />
        <Slider label="Market Return" value={ma.market_return_rate} display={`${ma.market_return_rate}%`}
          min={2} max={12} step={0.5} accent="#7a6da8"
          onChange={v => updateNestedConfig("market_assumptions", { market_return_rate: v })} />
      </div>

      {/* "What if…" — the three career phases (Sabbatical / Career Jump / Bridge
          Job) plus broader what-ifs, each appliable here or duplicable into a new
          scenario. Embedded as an extension of "Tune this scenario". */}
      {livePrices && (
        <div style={{ paddingTop: 2 }}>
          <BranchStrip livePrices={livePrices} />
        </div>
      )}

      {onOpenEditor && (
        <button onClick={onOpenEditor} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
          marginTop: 14, padding: "10px 14px", borderRadius: 10,
          background: C.bgCard, border: `1px solid ${C.tealLight}`, cursor: "pointer",
          fontSize: 12.5, fontWeight: 600, color: C.tealDark,
        }}>
          Fine-tune every detail <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

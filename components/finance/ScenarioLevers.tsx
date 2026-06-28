"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { C } from "@/config/colors";
import { colTier } from "@/lib/fire/moments";
import { BranchStrip } from "./BranchStrip";
import type { LivePrices } from "./FinancialDashboard";
import type { RetirementWindow } from "@/engine/calculator";

interface Marker { value: number; label: string; color: string }

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

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

function Slider({ label, value, display, min, max, step, accent, onChange, badge, markers }: {
  label: string; value: number; display: string; min: number; max: number; step: number; accent: string; onChange: (v: number) => void; badge?: React.ReactNode; markers?: Marker[];
}) {
  return (
    <div style={{ flex: "1 1 150px", minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          {/* Drop the badge before the headline ever wraps when the column is tight. */}
          {badge && <span className="hidden @min-[420px]:inline-flex" style={{ alignItems: "center" }}>{badge}</span>}
          {display}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: accent, cursor: "pointer" }} />
      {/* Notches on the track — e.g. earliest / recommended retirement years. */}
      {markers && markers.length > 0 && (
        <div style={{ position: "relative", height: 13, marginTop: 1 }}>
          {markers.map((m) => {
            const pct = Math.max(0, Math.min(100, ((m.value - min) / (max - min)) * 100));
            return (
              <div key={m.label} title={`${m.label}: ${m.value}`}
                style={{ position: "absolute", left: `${pct}%`, top: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
                <div style={{ width: 2, height: 5, background: m.color, borderRadius: 1 }} />
                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.02em", color: m.color, whiteSpace: "nowrap" }}>{m.value}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhaseChip({ label, on, color, onClick }: { label: string; on: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${on ? color : C.border}`,
      background: on ? `${color}1a` : C.bgCard,
      color: on ? color : C.inkSoft, transition: "all 0.15s",
    }}>
      {label}
    </button>
  );
}

/**
 * Scenario levers — the headline of the Financial tab. Compact sliders + phase
 * toggles that update the live trajectory instantly. This is the "play with it"
 * surface: a summary plus quick adjustment of the key knobs. Pass `onOpenEditor`
 * to surface a "click in" affordance into the full, more robust editor (mobile
 * uses this to open the config sheet); detailed inputs all live there.
 */
export default function ScenarioLevers({ onOpenEditor, livePrices, retireWindow }: { onOpenEditor?: () => void; livePrices?: LivePrices; retireWindow?: RetirementWindow } = {}) {
  const { config, updateNestedConfig } = useFinancialStore();
  const cp = config.career_path;
  const sp = config.spending;
  const ma = config.market_assumptions;
  const maxExit = Math.max(2040, (config.birth_year || 1985) + 75, cp.exit_year);

  // Earliest fundable & recommended exit years, shown as notches on the slider.
  const exitMarkers: Marker[] = [];
  if (retireWindow?.earliest) exitMarkers.push({ value: retireWindow.earliest, label: "Earliest you could retire", color: C.warm });
  if (retireWindow?.recommended) exitMarkers.push({ value: retireWindow.recommended, label: "Recommended", color: C.tealDark });

  const setExit = (yr: number) => {
    updateNestedConfig("career_path", { exit_year: yr });
    if (config.divestment_strategy.type === "progressive") {
      const w = config.divestment_strategy.end_year - config.divestment_strategy.start_year;
      updateNestedConfig("divestment_strategy", { start_year: yr, end_year: yr + w });
    }
  };

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", boxShadow: `0 1px 3px ${C.border}`, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ width: 3, height: 15, borderRadius: 2, background: C.teal }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.ink }}>Tune this scenario</span>
      </div>

      <div className="@container" style={{ display: "flex", flexWrap: "wrap", gap: "14px 22px", marginBottom: 14 }}>
        <Slider label="Exit Year" value={cp.exit_year} display={String(cp.exit_year)}
          min={2024} max={maxExit} step={1} accent={C.teal} onChange={setExit} markers={exitMarkers} />
        <Slider label="Monthly Spend" value={sp.monthly_lifestyle} display={money(sp.monthly_lifestyle)}
          min={3000} max={35000} step={250} accent={C.warm}
          badge={(() => { const t = colTier(sp.monthly_lifestyle); return (
            <TipChip emoji={t.emoji} code={t.code} tip={t.label} color={t.color} />
          ); })()}
          onChange={v => updateNestedConfig("spending", { monthly_lifestyle: v })} />
        <Slider label="Market Return" value={ma.market_return_rate} display={`${ma.market_return_rate}%`}
          min={2} max={12} step={0.5} accent="#7a6da8"
          onChange={v => updateNestedConfig("market_assumptions", { market_return_rate: v })} />
      </div>

      {/* Legend for the Exit Year notches. */}
      {exitMarkers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", marginBottom: 14, marginTop: -2 }}>
          {exitMarkers.map((m) => (
            <span key={m.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: C.inkSoft }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: m.color }} /> {m.label} <strong style={{ color: m.color }}>{m.value}</strong>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginRight: 2 }}>Phases</span>
        <PhaseChip label="Sabbatical" on={cp.use_sabbatical} color="#d98a3d" onClick={() => updateNestedConfig("career_path", { use_sabbatical: !cp.use_sabbatical })} />
        <PhaseChip label="Career Jump" on={cp.use_jump} color="#2a9d7f" onClick={() => updateNestedConfig("career_path", { use_jump: !cp.use_jump })} />
        <PhaseChip label="Bridge Job" on={cp.use_bridge} color="#3a7d9c" onClick={() => updateNestedConfig("career_path", { use_bridge: !cp.use_bridge })} />
      </div>

      {/* Branch this scenario — embedded as an extension of "Tune this scenario". */}
      {livePrices && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.borderSoft}` }}>
          <BranchStrip livePrices={livePrices} />
        </div>
      )}

      {onOpenEditor && (
        <button onClick={onOpenEditor} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.borderSoft}`,
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.tealDark }}>Fine-tune every detail</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.teal }}>
            Edit full plan <ChevronRight size={15} />
          </span>
        </button>
      )}
    </div>
  );
}

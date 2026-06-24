"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { C } from "@/config/colors";
import { colTier } from "@/lib/fire/moments";

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
      <span className="hidden min-[520px]:inline">{code}</span>
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

function Slider({ label, value, display, min, max, step, accent, onChange, badge }: {
  label: string; value: number; display: string; min: number; max: number; step: number; accent: string; onChange: (v: number) => void; badge?: React.ReactNode;
}) {
  return (
    <div style={{ flex: "1 1 150px", minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: 6 }}>{badge}{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: accent, cursor: "pointer" }} />
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
export default function ScenarioLevers({ onOpenEditor }: { onOpenEditor?: () => void } = {}) {
  const { config, updateNestedConfig } = useFinancialStore();
  const cp = config.career_path;
  const sp = config.spending;
  const ma = config.market_assumptions;
  const maxExit = Math.max(2040, (config.birth_year || 1985) + 75, cp.exit_year);

  const setExit = (yr: number) => {
    updateNestedConfig("career_path", { exit_year: yr });
    if (config.divestment_strategy.type === "progressive") {
      const w = config.divestment_strategy.end_year - config.divestment_strategy.start_year;
      updateNestedConfig("divestment_strategy", { start_year: yr, end_year: yr + w });
    }
  };

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", boxShadow: `0 1px 3px ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ width: 3, height: 15, borderRadius: 2, background: C.teal }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.ink }}>Tune this scenario</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 22px", marginBottom: 14 }}>
        <Slider label="Exit Year" value={cp.exit_year} display={String(cp.exit_year)}
          min={2024} max={maxExit} step={1} accent={C.teal} onChange={setExit} />
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

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginRight: 2 }}>Phases</span>
        <PhaseChip label="Sabbatical" on={cp.use_sabbatical} color="#d98a3d" onClick={() => updateNestedConfig("career_path", { use_sabbatical: !cp.use_sabbatical })} />
        <PhaseChip label="Career Jump" on={cp.use_jump} color="#2a9d7f" onClick={() => updateNestedConfig("career_path", { use_jump: !cp.use_jump })} />
        <PhaseChip label="Bridge Job" on={cp.use_bridge} color="#3a7d9c" onClick={() => updateNestedConfig("career_path", { use_bridge: !cp.use_bridge })} />
      </div>

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

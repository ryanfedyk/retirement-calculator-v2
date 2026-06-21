"use client";
import { useFinancialStore } from "@/store/useFinancialStore";
import { C } from "@/config/colors";
import ScenarioSwitcher from "./ScenarioSwitcher";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Slider({ label, value, display, min, max, step, accent, onChange }: {
  label: string; value: number; display: string; min: number; max: number; step: number; accent: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ flex: "1 1 150px", minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{display}</span>
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
 * toggles that update the live trajectory instantly. Detailed inputs still live
 * in the config panel; this is the "play with it" surface.
 */
export default function ScenarioLevers() {
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
        <ScenarioSwitcher />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 22px", marginBottom: 14 }}>
        <Slider label="Exit Year" value={cp.exit_year} display={String(cp.exit_year)}
          min={2024} max={maxExit} step={1} accent={C.teal} onChange={setExit} />
        <Slider label="Monthly Spend" value={sp.monthly_lifestyle} display={money(sp.monthly_lifestyle)}
          min={3000} max={35000} step={250} accent={C.warm}
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
    </div>
  );
}

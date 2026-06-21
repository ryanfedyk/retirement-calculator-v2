"use client";
import { Plus, Copy, Pencil, Trash2 } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { C } from "@/config/colors";

const iconBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.bgCard, color: C.inkSoft, cursor: "pointer",
};

/** Switch / create / duplicate / rename / delete named scenarios. */
export default function ScenarioSwitcher() {
  const { scenarios, activeScenarioId, setActiveScenario, duplicateScenario, addScenario, renameScenario, deleteScenario } = useFinancialStore();
  const active = scenarios.find((s) => s.id === activeScenarioId);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.ink }}>Scenario</span>
      <select
        value={activeScenarioId}
        onChange={(e) => setActiveScenario(e.target.value)}
        style={{
          flex: "0 1 auto", minWidth: 130, maxWidth: 220, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: "5px 8px", fontSize: 13, fontWeight: 600, color: C.ink, background: C.bg, outline: "none", cursor: "pointer",
        }}
      >
        {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <button style={iconBtn} title="Duplicate this scenario" aria-label="Duplicate scenario" onClick={() => duplicateScenario()}><Copy size={13} /></button>
      <button style={iconBtn} title="New scenario" aria-label="New scenario" onClick={() => addScenario()}><Plus size={14} /></button>
      <button style={iconBtn} title="Rename scenario" aria-label="Rename scenario"
        onClick={() => { const n = window.prompt("Rename scenario", active?.name); if (n && n.trim()) renameScenario(activeScenarioId, n.trim()); }}>
        <Pencil size={12} />
      </button>
      {scenarios.length > 1 && (
        <button style={{ ...iconBtn, color: C.warm }} title="Delete scenario" aria-label="Delete scenario"
          onClick={() => { if (window.confirm(`Delete scenario "${active?.name}"? This can't be undone.`)) deleteScenario(activeScenarioId); }}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

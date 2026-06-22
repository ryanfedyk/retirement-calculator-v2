"use client";
/**
 * ScenariosHub — the top-level landing for scenarios. Lists every scenario as a
 * card (open one to drill into its Financial / Forecasting deep-dive), suggests
 * new ones, and compares them all on a single chart. The scenario you open
 * becomes the active scenario, which drives the countdown and both deep-dive
 * tabs.
 */
import { useMemo } from "react";
import { Plus, Copy, Pencil, Trash2, ArrowRight, Sparkles, Check } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
import { useScenarioSuggestions } from "@/hooks/useScenarioSuggestions";
import { useConfirm, usePrompt } from "@/components/ui/DialogProvider";
import ScenarioCompare from "@/components/finance/ScenarioCompare";
import { C } from "@/config/colors";
import type { LivePrices } from "@/hooks/useLivePrices";

const PALETTE = ["#2a7a68", "#d98a3d", "#3a7d9c", "#7a6da8", "#c45b6b", "#5a9e54", "#b8893a", "#4a8d9c"];
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

const iconBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.border}`,
  background: C.bgCard, color: C.inkSoft, cursor: "pointer",
};

export default function ScenariosHub({ livePrices, onOpen }: { livePrices: LivePrices; onOpen: () => void }) {
  const { scenarios, activeScenarioId, snapshot, setActiveScenario, addScenario, duplicateScenario, renameScenario, deleteScenario } = useFinancialStore();
  const suggestions = useScenarioSuggestions(livePrices);
  const confirm = useConfirm();
  const prompt = usePrompt();

  const liveGoog = livePrices["GOOG"]?.price ?? livePrices["GOOGL"]?.price ?? 0;
  const enriched = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map((inv) => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  const stats = useMemo(() => {
    const map: Record<string, { fiYear?: number; fiAge?: number; finalNW: number }> = {};
    for (const sc of scenarios) {
      const pts = runSimulation(enriched, sc.config, liveGoog);
      const fi = findIndependencePoint(pts);
      const fiYear = fi ? Number((fi.date.match(/\d{4}/) || [])[0]) : undefined;
      map[sc.id] = {
        fiYear,
        fiAge: fiYear ? fiYear - (sc.config.birth_year ?? 1980) : undefined,
        finalNW: pts[pts.length - 1]?.totalNetWorth ?? 0,
      };
    }
    return map;
  }, [scenarios, enriched, liveGoog]);

  const open = (id: string) => { setActiveScenario(id); onOpen(); };

  const rename = async (id: string, current: string) => {
    const n = await prompt({ title: "Rename scenario", defaultValue: current, placeholder: "Scenario name", confirmLabel: "Rename" });
    if (n) renameScenario(id, n);
  };
  const remove = async (id: string, name: string) => {
    if (await confirm({ title: `Delete “${name}”?`, message: "This can't be undone.", confirmLabel: "Delete", danger: true })) deleteScenario(id);
  };

  return (
    <main style={{ flex: 1, overflowY: "auto", background: C.bg }}>
      <div className="max-w-7xl mx-auto" style={{ padding: "28px 32px 48px" }}>

        {/* Heading */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: "-0.01em" }}>Scenarios</h1>
          <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>
            Open one to explore and fine-tune it, spin up a new one, or compare them all. The scenario you open drives your countdown and both tabs.
          </p>
        </div>

        {/* Scenario cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {scenarios.map((sc, i) => {
            const active = sc.id === activeScenarioId;
            const color = PALETTE[i % PALETTE.length];
            const st = stats[sc.id];
            return (
              <div
                key={sc.id}
                onClick={() => open(sc.id)}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") open(sc.id); }}
                style={{
                  position: "relative", cursor: "pointer", background: C.bgCard, borderRadius: 14,
                  border: `1px solid ${active ? C.teal : C.border}`, boxShadow: active ? `0 0 0 1px ${C.teal}` : `0 1px 3px ${C.border}`,
                  padding: 16, display: "flex", flexDirection: "column", gap: 12, transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = C.teal; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = C.border; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sc.name}</span>
                  {active && (
                    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 800, letterSpacing: "0.05em", color: "#fff", background: C.teal, borderRadius: 5, padding: "2px 6px" }}>
                      <Check size={10} /> ACTIVE
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint }}>FI date</div>
                    {st?.fiYear ? (
                      <>
                        <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, lineHeight: 1.05 }}>{st.fiYear}</div>
                        <div style={{ fontSize: 11, color: C.inkSoft }}>at age {st.fiAge}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#a23818", lineHeight: 1.3, marginTop: 2 }}>Off track</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint }}>Exit year</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, lineHeight: 1.05 }}>{sc.config.career_path.exit_year}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{fmtM(st?.finalNW ?? 0)} by horizon</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: C.teal }}>
                    Open <ArrowRight size={14} />
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    <button style={iconBtn} title="Duplicate" aria-label="Duplicate scenario" onClick={() => { setActiveScenario(sc.id); duplicateScenario(); }}><Copy size={13} /></button>
                    <button style={iconBtn} title="Rename" aria-label="Rename scenario" onClick={() => rename(sc.id, sc.name)}><Pencil size={12} /></button>
                    {scenarios.length > 1 && (
                      <button style={{ ...iconBtn, color: C.warm }} title="Delete" aria-label="Delete scenario" onClick={() => remove(sc.id, sc.name)}><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* New scenario card */}
          <button
            onClick={() => { addScenario(); onOpen(); }}
            style={{
              cursor: "pointer", background: "transparent", borderRadius: 14, border: `1.5px dashed ${C.border}`,
              padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, color: C.inkSoft, minHeight: 150, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.color = C.teal; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.inkSoft; }}
          >
            <Plus size={22} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>New scenario</span>
          </button>
        </div>

        {/* Suggested scenarios */}
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
            <Sparkles size={15} color={C.teal} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft }}>Suggested scenarios</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {suggestions.map((s) => (
              <button
                key={s.title}
                onClick={s.build}
                title={`Create a new scenario: ${s.title}`}
                style={{
                  display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                  padding: "10px 14px", borderRadius: 11, border: `1px solid ${C.border}`, background: C.bgCard,
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: C.ink }}>
                  <Plus size={13} color={C.teal} /> {s.title}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: s.fiColor }}>FI {s.fiDelta}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Compare all */}
        {scenarios.length > 1 && (
          <div style={{ marginTop: 28 }}>
            <ScenarioCompare livePrices={livePrices} />
          </div>
        )}
      </div>
    </main>
  );
}

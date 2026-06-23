"use client";
/**
 * ScenariosHub — the top-level landing for scenarios. A single comparison chart
 * sits on top; the scenario cards below double as its legend + controls (toggle
 * a plan on/off with the 👁, rename inline, open to drill in). Suggested tweaks
 * cycle through a turnstile, and a finances snapshot opens the shared balance
 * sheet. The scenario you open becomes the active scenario, which drives the
 * countdown and both deep-dive tabs.
 */
import { useMemo, useState, useRef, useEffect } from "react";
import { Plus, Copy, Trash2, Sparkles, MoreVertical, Wallet, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
import { useScenarioSuggestions, type Suggestion } from "@/hooks/useScenarioSuggestions";
import { useConfirm } from "@/components/ui/DialogProvider";
import ScenarioCompare from "@/components/finance/ScenarioCompare";
import { C } from "@/config/colors";
import type { LivePrices } from "@/hooks/useLivePrices";

const PALETTE = ["#2a7a68", "#d98a3d", "#3a7d9c", "#7a6da8", "#c45b6b", "#5a9e54", "#b8893a", "#4a8d9c"];
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
const fmtBal = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${Math.round(v)}`;
};

const iconBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26,
  borderRadius: 7, border: "none", background: "transparent", color: C.inkSoft, cursor: "pointer", flexShrink: 0,
};

/** Three-dot overflow menu on a scenario card: duplicate / delete.
 * Stops click propagation so using it never opens the scenario. */
function CardMenu({ canDelete, onDuplicate, onDelete }: {
  canDelete: boolean; onDuplicate: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const item = (Icon: typeof Copy, label: string, fn: () => void, danger = false) => (
    <button
      onClick={(e) => { e.stopPropagation(); setOpen(false); fn(); }}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 11px", background: "transparent", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, color: danger ? C.warm : C.inkMid, textAlign: "left" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        aria-label="Scenario options" onClick={() => setOpen((o) => !o)}
        style={iconBtn}
        onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 20, minWidth: 150, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 5 }}>
          {item(Copy, "Duplicate", onDuplicate)}
          {canDelete && item(Trash2, "Delete", onDelete, true)}
        </div>
      )}
    </div>
  );
}

/** Scenario name that becomes editable in place on click (commit on Enter/blur,
 * Esc cancels). Click never bubbles up to open the scenario. */
function EditableName({ name, onCommit }: { name: string; onCommit: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  useEffect(() => { if (!editing) setVal(name); }, [name, editing]);

  if (editing) return (
    <input
      autoFocus
      value={val}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { setEditing(false); const t = val.trim(); if (t && t !== name) onCommit(t); }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { setVal(name); setEditing(false); }
      }}
      style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: C.ink, border: `1px solid ${C.teal}`, borderRadius: 6, padding: "2px 6px", outline: "none", background: C.bg }}
    />
  );

  return (
    <span
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title="Click to rename"
      style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text" }}
    >
      {name}
    </span>
  );
}

/** Suggested tweaks, one at a time — keeps the detail visible without the long
 * horizontal strip. Tap the card to spin the tweak into a real scenario. */
function SuggestionsTurnstile({ suggestions }: { suggestions: Suggestion[] }) {
  const [idx, setIdx] = useState(0);
  if (!suggestions.length) return null;
  const i = idx % suggestions.length;
  const s = suggestions[i];
  const go = (d: number) => setIdx((p) => (p + d + suggestions.length) % suggestions.length);

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <Sparkles size={15} color={C.teal} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft }}>Suggested scenarios</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.inkFaint, fontVariantNumeric: "tabular-nums" }}>{i + 1}/{suggestions.length}</span>
          <button aria-label="Previous suggestion" onClick={() => go(-1)} style={iconBtn} onMouseEnter={(e) => (e.currentTarget.style.background = C.bgCard)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><ChevronLeft size={16} /></button>
          <button aria-label="Next suggestion" onClick={() => go(1)} style={iconBtn} onMouseEnter={(e) => (e.currentTarget.style.background = C.bgCard)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><ChevronRight size={16} /></button>
        </div>
      </div>

      <button
        onClick={s.build}
        title={`Create a new scenario: ${s.title}`}
        style={{
          width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap", padding: "16px 18px", borderRadius: 12, border: `1px solid ${C.border}`,
          background: C.bgCard, cursor: "pointer", transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
      >
        <div style={{ minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 700, color: C.ink }}>
            <Plus size={15} color={C.teal} style={{ flexShrink: 0 }} /> {s.title}
          </span>
          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>Tap to create this scenario</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: s.nwColor, fontVariantNumeric: "tabular-nums" }}>{s.nwDelta}</span>
            <span style={{ fontSize: 11, color: C.inkSoft }}>· FI {s.fiDate}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: s.fiColor, marginTop: 2 }}>{s.fiDelta}</div>
        </div>
      </button>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
        {suggestions.map((_, j) => (
          <button key={j} aria-label={`Suggestion ${j + 1}`} onClick={() => setIdx(j)} style={{
            width: j === i ? 18 : 6, height: 6, borderRadius: 99, border: "none", cursor: "pointer",
            background: j === i ? C.teal : C.border, transition: "all 0.25s", padding: 0,
          }} />
        ))}
      </div>
    </div>
  );
}

export default function ScenariosHub({ livePrices, onOpen }: { livePrices: LivePrices; onOpen: () => void }) {
  const { scenarios, config, snapshot, setActiveScenario, addScenario, duplicateScenario, renameScenario, deleteScenario } = useFinancialStore();
  const setFinancesOpen = useUIStore((s) => s.setFinancesOpen);
  const suggestions = useScenarioSuggestions(livePrices);
  const confirm = useConfirm();

  // Which scenarios are hidden on the comparison chart (toggled via the 👁 on each card).
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const toggleHidden = (id: string) => setHiddenIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

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

  // Net worth today — config-independent (current balances), so any scenario works.
  const currentNW = useMemo(() => runSimulation(enriched, config, liveGoog)[0]?.totalNetWorth ?? 0, [enriched, config, liveGoog]);

  const open = (id: string) => { setActiveScenario(id); onOpen(); };
  const remove = async (id: string, name: string) => {
    if (await confirm({ title: `Delete “${name}”?`, message: "This can't be undone.", confirmLabel: "Delete", danger: true })) deleteScenario(id);
  };

  const multi = scenarios.length > 1;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.bg }}>
      <div className="max-w-7xl mx-auto px-5 min-[700px]:px-8" style={{ paddingTop: 24, paddingBottom: 48 }}>

        {/* Heading */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: "-0.01em" }}>Scenarios</h1>
          <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4, maxWidth: 560 }}>
            Compare your plans, fine-tune one by opening it, or spin up a new one. The scenario you open drives your countdown and both tabs.
          </p>
        </div>

        {/* Your finances snapshot — opens the shared balance sheet */}
        <button
          onClick={() => setFinancesOpen(true)}
          title="Edit your balance sheet — shared across every scenario"
          style={{
            width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap", padding: "14px 18px", borderRadius: 12, border: `1px solid ${C.border}`,
            background: C.bgCard, cursor: "pointer", marginBottom: 20, transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, background: C.tealWash, flexShrink: 0 }}>
              <Wallet size={18} color={C.teal} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.inkFaint }}>Your finances · shared across scenarios</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{fmtBal(currentNW)}</span>
                <span style={{ fontSize: 11, color: C.inkSoft }}>net worth today</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Stat label="Cash" value={fmtBal(snapshot.liquid_assets.cash_savings)} />
            <Stat label="401(k)" value={fmtBal(snapshot.retirement_assets.k401)} />
            <Stat label="Roth IRA" value={fmtBal(snapshot.retirement_assets.roth_ira)} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.teal }}>
              Update <ChevronRight size={14} />
            </span>
          </div>
        </button>

        {/* Comparison chart on top — the cards below are its legend */}
        {multi && (
          <div style={{ marginBottom: 16 }}>
            <ScenarioCompare livePrices={livePrices} hiddenIds={hiddenIds} />
          </div>
        )}

        {/* Scenario cards — legend + controls for the chart */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
          {scenarios.map((sc, i) => {
            const color = PALETTE[i % PALETTE.length];
            const st = stats[sc.id];
            const hidden = hiddenIds.has(sc.id);
            return (
              <div
                key={sc.id}
                onClick={() => open(sc.id)}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") open(sc.id); }}
                style={{
                  position: "relative", cursor: "pointer", background: C.bgCard, borderRadius: 12,
                  border: `1px solid ${C.border}`, boxShadow: `0 1px 3px ${C.border}`,
                  padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 10,
                  opacity: hidden ? 0.55 : 1, transition: "border-color 0.15s, opacity 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <EditableName name={sc.name} onCommit={(n) => renameScenario(sc.id, n)} />
                  {multi && (
                    <button
                      aria-label={hidden ? "Show on chart" : "Hide from chart"}
                      title={hidden ? "Show on chart" : "Hide from chart"}
                      onClick={(e) => { e.stopPropagation(); toggleHidden(sc.id); }}
                      style={iconBtn}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                  <CardMenu
                    canDelete={scenarios.length > 1}
                    onDuplicate={() => { setActiveScenario(sc.id); duplicateScenario(); }}
                    onDelete={() => remove(sc.id, sc.name)}
                  />
                </div>

                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint }}>FI date</div>
                    {st?.fiYear ? (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        <span style={{ fontSize: 19, fontWeight: 800, color: C.ink, lineHeight: 1.1 }}>{st.fiYear}</span>
                        <span style={{ fontSize: 10, color: C.inkSoft }}>age {st.fiAge}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#a23818", lineHeight: 1.4 }}>Off track</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint }}>Exit year</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ fontSize: 19, fontWeight: 800, color: C.ink, lineHeight: 1.1 }}>{sc.config.career_path.exit_year}</span>
                      <span style={{ fontSize: 10, color: C.inkSoft }}>{fmtM(st?.finalNW ?? 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* New scenario card */}
          <button
            onClick={() => { addScenario(); onOpen(); }}
            style={{
              cursor: "pointer", background: "transparent", borderRadius: 12, border: `1.5px dashed ${C.border}`,
              padding: 14, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: 8, color: C.inkSoft, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.color = C.teal; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.inkSoft; }}
          >
            <Plus size={18} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>New scenario</span>
          </button>
        </div>

        {/* Suggested scenarios — turnstile */}
        <SuggestionsTurnstile suggestions={suggestions} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

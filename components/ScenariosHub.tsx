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
import { createPortal } from "react-dom";
import { Plus, Copy, Trash2, Sparkles, MoreVertical, Wallet, Eye, EyeOff, ChevronRight, Pencil, FileText } from "lucide-react";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { runSimulation, findIndependencePoint } from "@/engine/calculator";
import { useScenarioSuggestions, type Suggestion } from "@/hooks/useScenarioSuggestions";
import { useConfirm } from "@/components/ui/DialogProvider";
import ScenarioCompare from "@/components/finance/ScenarioCompare";
import { C, SCENARIO_PALETTE as PALETTE } from "@/config/colors";
import type { LivePrices } from "@/hooks/useLivePrices";

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

/** Three-dot overflow menu on a scenario card: rename / duplicate / delete.
 * Stops click propagation so using it never opens the scenario. Rename is the
 * primary way to edit a name on touch devices (where tap-to-edit is disabled).
 * The menu renders through a portal with fixed positioning so it's never
 * clipped by the card grid / horizontal scroll strip, and flips upward when it
 * would otherwise run off the bottom of the screen. */
function CardMenu({ canDelete, onRename, onDuplicate, onExport, onToggleHidden, hidden, onDelete }: {
  canDelete: boolean; onRename?: () => void; onDuplicate: () => void; onExport: () => void;
  onToggleHidden?: () => void; hidden?: boolean; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemCount = (onRename ? 1 : 0) + 2 + (onToggleHidden ? 1 : 0) + (canDelete ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const menuH = itemCount * 38 + 10;
      const below = r.bottom + 4;
      // Flip up if the menu would run off the bottom of the viewport.
      const top = below + menuH > window.innerHeight ? Math.max(8, r.top - 4 - menuH) : below;
      setCoords({ top, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, itemCount]);

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
    <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        aria-label="Scenario options" onClick={() => setOpen((o) => !o)}
        style={iconBtn}
        onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <MoreVertical size={16} />
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: coords.top, right: coords.right, zIndex: 1000, minWidth: 160, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: 5 }}
        >
          {onRename && item(Pencil, "Rename", onRename)}
          {onToggleHidden && item(hidden ? Eye : EyeOff, hidden ? "Show on chart" : "Hide from chart", onToggleHidden)}
          {item(Copy, "Duplicate", onDuplicate)}
          {item(FileText, "Export for LLM", onExport)}
          {canDelete && item(Trash2, "Delete", onDelete, true)}
        </div>,
        document.body
      )}
    </div>
  );
}

/** Scenario name. Editing is controlled by the parent so it can be triggered
 * either by clicking the name (desktop) or via the overflow "Rename" item
 * (touch). `clickToEdit` is off on touch, where an accidental tap shouldn't put
 * the field into edit mode. Click never bubbles up to open the scenario. */
function EditableName({ name, onCommit, editing, setEditing, clickToEdit }: {
  name: string; onCommit: (n: string) => void;
  editing: boolean; setEditing: (v: boolean) => void; clickToEdit: boolean;
}) {
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
      onClick={clickToEdit ? (e) => { e.stopPropagation(); setEditing(true); } : undefined}
      title={clickToEdit ? "Click to rename" : undefined}
      style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: clickToEdit ? "text" : "default" }}
    >
      {name}
    </span>
  );
}

/** Suggested tweaks as a quiet, secondary strip — visually subordinate to the
 * real scenario cards above (lighter "ghost" cards, muted text, smaller) so
 * suggestions read as optional ideas, not as competing saved plans. */
function SuggestionsStrip({ suggestions }: { suggestions: Suggestion[] }) {
  if (!suggestions.length) return null;

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Sparkles size={13} color={C.inkFaint} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint }}>Ideas to try</span>
        <span style={{ fontSize: 10, color: C.inkFaint }}>· tap to add as a scenario</span>
      </div>

      <div
        className="no-scrollbar"
        style={{
          display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6,
          scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch",
        }}
      >
        {suggestions.map((s, j) => (
          <button
            key={j}
            onClick={s.build}
            title={`Create a new scenario: ${s.title}`}
            style={{
              flex: "0 0 auto", width: 190, scrollSnapAlign: "start", textAlign: "left",
              display: "flex", flexDirection: "column", gap: 6, padding: "11px 13px", borderRadius: 10,
              border: `1px dashed ${C.border}`, background: "transparent", cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.tealLight; e.currentTarget.style.background = C.bgCard; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: C.inkMid, minWidth: 0 }}>
              <Plus size={13} color={C.inkFaint} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: s.nwColor, fontVariantNumeric: "tabular-nums" }}>{s.nwDelta}</span>
              <span style={{ fontSize: 10, color: C.inkFaint }}>· FI {s.fiDate}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface CardStat { fiYear?: number; fiAge?: number; finalNW: number }

/** A saved scenario card — legend + control for the comparison chart, and the
 * entry point into the deep-dive. Owns its own rename-editing state. */
function ScenarioCard({
  sc, color, st, hidden, multi, canDelete, isMobile,
  onOpen, onToggleHidden, onRename, onDuplicate, onExport, onDelete,
}: {
  sc: { id: string; name: string; config: { career_path: { exit_year: number } } };
  color: string; st?: CardStat; hidden: boolean; multi: boolean; canDelete: boolean; isMobile: boolean;
  onOpen: () => void; onToggleHidden: () => void;
  onRename: (n: string) => void; onDuplicate: () => void; onExport: () => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      onClick={() => { if (!editing) onOpen(); }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" && !editing) onOpen(); }}
      style={{
        position: "relative", cursor: "pointer", background: C.bgCard, borderRadius: 12,
        border: `1px solid ${C.border}`, boxShadow: `0 1px 3px ${C.border}`,
        padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 10,
        opacity: hidden ? 0.55 : 1, transition: "border-color 0.15s, opacity 0.15s",
        // On mobile the cards live in a horizontal strip. Size to ~half the
        // viewport MINUS a margin so two cards fit with the next always peeking
        // off the edge — a clear signal the row scrolls.
        ...(isMobile ? { flex: "0 0 auto", width: "calc(50% - 26px)", maxWidth: 220, scrollSnapAlign: "start" } : {}),
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <EditableName name={sc.name} onCommit={onRename} editing={editing} setEditing={setEditing} clickToEdit={!isMobile} />
        {/* Desktop keeps the chart-visibility toggle inline; on mobile it moves
            into the ⋯ menu so it can't be tapped by accident while navigating. */}
        {multi && !isMobile && (
          <button
            aria-label={hidden ? "Show on chart" : "Hide from chart"}
            title={hidden ? "Show on chart" : "Hide from chart"}
            onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
            style={iconBtn}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        <CardMenu
          canDelete={canDelete}
          onRename={isMobile ? () => setEditing(true) : undefined}
          onDuplicate={onDuplicate}
          onExport={onExport}
          onToggleHidden={multi && isMobile ? onToggleHidden : undefined}
          hidden={hidden}
          onDelete={onDelete}
        />
      </div>

      {/* Stat pair — the secondary line (age / final NW) sits under the headline
          number so it never wraps awkwardly in a narrow card. */}
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint }}>FI date</div>
          {st?.fiYear ? (
            <>
              <div style={{ fontSize: 19, fontWeight: 800, color: C.ink, lineHeight: 1.15 }}>{st.fiYear}</div>
              <div style={{ fontSize: 10, color: C.inkSoft, whiteSpace: "nowrap" }}>age {st.fiAge}</div>
            </>
          ) : (
            <div style={{ fontSize: 16, fontWeight: 800, color: C.inkSoft, lineHeight: 1.15 }}>Off track</div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.inkFaint }}>Exit year</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.ink, lineHeight: 1.15 }}>{sc.config.career_path.exit_year}</div>
          <div style={{ fontSize: 10, color: C.inkSoft, whiteSpace: "nowrap" }}>{fmtM(st?.finalNW ?? 0)}</div>
        </div>
      </div>
    </div>
  );
}

export default function ScenariosHub({ livePrices, onOpen }: { livePrices: LivePrices; onOpen: () => void }) {
  const { scenarios, config, snapshot, setActiveScenario, addScenario, duplicateScenario, renameScenario, deleteScenario } = useFinancialStore();
  const setFinancesOpen = useUIStore((s) => s.setFinancesOpen);
  const openReport = useUIStore((s) => s.openReport);
  const dollarMode = useUIStore((s) => s.dollarMode);
  const suggestions = useScenarioSuggestions(livePrices);
  const confirm = useConfirm();
  const isMobile = useIsMobile();

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
      // End-of-horizon net worth is a future value, so honour the global money
      // basis (re-inflate it for "future $", using this scenario's inflation).
      const last = pts[pts.length - 1];
      const infl = sc.config.market_assumptions.inflation_rate || 0;
      const finalNW = last
        ? (dollarMode === "future" && infl
            ? last.totalNetWorth * Math.pow(1 + infl / 100, last.monthIndex / 12)
            : last.totalNetWorth)
        : 0;
      map[sc.id] = {
        fiYear,
        fiAge: fiYear ? fiYear - (sc.config.birth_year ?? 1980) : undefined,
        finalNW,
      };
    }
    return map;
  }, [scenarios, enriched, liveGoog, dollarMode]);

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

        {/* Your finances snapshot — opens the shared balance sheet. Sits above the
            Scenarios heading because it's the shared balance sheet, not a scenario. */}
        <button
          onClick={() => setFinancesOpen(true)}
          title="Edit your balance sheet — shared across every scenario"
          style={{
            width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap", padding: "14px 18px", borderRadius: 12, border: `1px solid ${C.border}`,
            background: C.bgCard, cursor: "pointer", marginBottom: 24, transition: "border-color 0.15s",
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
            {/* A self-contained chip so it reads as a deliberate action, not a
                value floating between the stats' label and number rows. */}
            <span aria-hidden style={{ width: 1, alignSelf: "stretch", minHeight: 30, background: C.border, flexShrink: 0 }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.teal, background: C.tealWash, borderRadius: 8, padding: "7px 12px", flexShrink: 0 }}>
              Update <ChevronRight size={14} />
            </span>
          </div>
        </button>

        {/* Heading */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: "-0.01em" }}>Scenarios</h1>
          <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4, maxWidth: 560 }}>
            Compare your plans, fine-tune one by opening it, or spin up a new one. The scenario you open drives your countdown and both tabs.
          </p>
        </div>

        {/* Comparison chart on top — the cards below are its legend */}
        {multi && (
          <div style={{ marginBottom: 16 }}>
            <ScenarioCompare livePrices={livePrices} hiddenIds={hiddenIds} />
          </div>
        )}

        {/* Scenario cards — legend + controls for the chart. A grid on desktop;
            a horizontal scroll strip on mobile (saves vertical space, and the
            peek of the next card signals the row scrolls). */}
        <div
          className={isMobile ? "no-scrollbar" : undefined}
          style={isMobile
            ? { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" }
            : { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}
        >
          {scenarios.map((sc, i) => (
            <ScenarioCard
              key={sc.id}
              sc={sc}
              color={PALETTE[i % PALETTE.length]}
              st={stats[sc.id]}
              hidden={hiddenIds.has(sc.id)}
              multi={multi}
              canDelete={scenarios.length > 1}
              isMobile={isMobile}
              onOpen={() => open(sc.id)}
              onToggleHidden={() => toggleHidden(sc.id)}
              onRename={(n) => renameScenario(sc.id, n)}
              onDuplicate={() => { setActiveScenario(sc.id); duplicateScenario(); }}
              onExport={() => openReport(sc.id)}
              onDelete={() => remove(sc.id, sc.name)}
            />
          ))}

          {/* New scenario card */}
          <button
            onClick={() => { addScenario(); onOpen(); }}
            style={{
              cursor: "pointer", background: "transparent", borderRadius: 12, border: `1.5px dashed ${C.border}`,
              padding: 14, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: 8, color: C.inkSoft, transition: "all 0.15s",
              ...(isMobile ? { flex: "0 0 auto", width: "40%", maxWidth: 170, scrollSnapAlign: "start" } : {}),
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.color = C.teal; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.inkSoft; }}
          >
            <Plus size={18} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>New scenario</span>
          </button>
        </div>

        {/* Suggested scenarios — sideways-scrolling strip */}
        <SuggestionsStrip suggestions={suggestions} />
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

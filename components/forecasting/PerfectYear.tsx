"use client";
import { useMemo, useState } from "react";
import { Plus, X, Sparkles, RotateCcw, Check, CalendarRange, Wand2, ArrowLeft } from "lucide-react";
import { C } from "@/config/colors";
import { ADVENTURE_SEEDS } from "@/data/adventureSeeds";
import { usePerfectYearStore } from "@/store/usePerfectYearStore";
import { useCustomPursuitStore } from "@/store/useCustomPursuitStore";
import { useFinancialStore } from "@/store/useFinancialStore";
import { seedPerfectYear } from "@/lib/perfectSeed";
import type { AdventureBlueprint, AdventureCategory } from "@/types/horizon";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SEASONS: { name: string; emoji: string; tint: string; months: number[] }[] = [
  { name: "Winter", emoji: "❄️", tint: "#3a7d9c", months: [11, 0, 1] },
  { name: "Spring", emoji: "🌸", tint: "#4aab92", months: [2, 3, 4] },
  { name: "Summer", emoji: "☀️", tint: "#d98a3d", months: [5, 6, 7] },
  { name: "Fall",   emoji: "🍂", tint: "#c4784e", months: [8, 9, 10] },
];

const CAT_META: Record<AdventureCategory, { color: string; icon: string }> = {
  "Immersive Travel": { color: "#2d7a66", icon: "✈️" },
  "Creative Mastery": { color: "#7a5a9e", icon: "🎸" },
  "Endurance/Active": { color: "#4a8a5a", icon: "🏔️" },
  "Slow Living":      { color: "#c4784e", icon: "🌿" },
};
const CATEGORIES = Object.keys(CAT_META) as AdventureCategory[];


/**
 * Perfect Year — a 12-month canvas for the life you're building toward. Drop
 * trips and experiences onto the seasons and watch the year fill in. The
 * adventure catalog (travel, creative mastery, endurance, slow living) is the
 * palette. Replaces the standalone Adventure generator. Desktop + mobile.
 */
export default function PerfectYear({ onExit }: { onExit?: () => void } = {}) {
  const { plan, applySeed, add, remove, clear } = usePerfectYearStore();
  const [picker, setPicker] = useState<number | null>(null); // month index being added to

  const customPursuits = useCustomPursuitStore((s) => s.pursuits);
  const catalog = useMemo(() => [...ADVENTURE_SEEDS, ...customPursuits], [customPursuits]);
  const SEED_BY_ID = useMemo(() => Object.fromEntries(catalog.map((s) => [s.id, s])) as Record<string, AdventureBlueprint>, [catalog]);

  const total = useMemo(() => Object.values(plan).reduce((s, ids) => s + ids.length, 0), [plan]);

  // Auto-draft a starting year from the household (kids vs not) so a new user
  // lands on a filled calendar instead of an empty grid.
  const children = useFinancialStore((s) => s.profile.children);
  const exitMonth = useFinancialStore((s) => s.config.career_path.exit_month);
  const lifeEvents = useFinancialStore((s) => s.config.life_events);
  const seedInputs = useMemo(() => ({
    childNames: (children ?? []).map((c) => c.name).filter(Boolean),
    hasPartner: false, // not used by the year seed
    exitMonth: exitMonth ?? undefined,
    lifeEventTags: (lifeEvents ?? []).map((e) => (e.name ?? "").toLowerCase()),
  }), [children, exitMonth, lifeEvents]);
  const rebuildYear = () => applySeed(seedPerfectYear(seedInputs));

  // "Surprise me" — drop a random unplaced adventure onto a sensible month.
  const placedIds = useMemo(() => new Set(Object.values(plan).flat()), [plan]);
  const surprise = () => {
    const pool = catalog.filter((s) => !placedIds.has(s.id));
    if (!pool.length) return;
    const pick = pool[Math.floor((total * 7 + pool.length) % pool.length)]; // deterministic-ish, no Math.random
    add(new Date().getMonth(), pick.id);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Intro */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          {onExit && (
            <button onClick={onExit} title="Back to the journey" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 99, padding: "6px 12px", cursor: "pointer", color: C.inkMid, fontSize: 11.5, fontWeight: 700 }}>
              <ArrowLeft size={13} /> Back
            </button>
          )}
          <CalendarRange size={18} color={C.teal} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: "-0.01em" }}>Your perfect year</h2>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={rebuildYear} title="Draft a fresh year from your plan" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.tealWash, border: `1px solid ${C.tealLight}`, borderRadius: 99, padding: "6px 12px", cursor: "pointer", color: C.tealDark, fontSize: 11.5, fontWeight: 700 }}>
              <Wand2 size={13} /> Rebuild for me
            </button>
            <button onClick={surprise} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.border}`, borderRadius: 99, padding: "6px 12px", cursor: "pointer", color: C.inkMid, fontSize: 11.5, fontWeight: 700 }}>
              <Sparkles size={13} /> Surprise me
            </button>
            {total > 0 && (
              <button onClick={clear} title="Clear the year" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 11, fontWeight: 600 }}>
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        </div>
        <p style={{ fontSize: 13, color: C.inkSoft, maxWidth: 640, lineHeight: 1.5 }}>
          Map the trips and experiences you want across the year — drop them onto the seasons. It turns "someday" into a calendar you can feel{total > 0 ? ` · ${total} planned` : ""}.
        </p>
      </div>

      {/* Season canvas */}
      {SEASONS.map((season) => (
        <div key={season.name}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <span style={{ width: 3, height: 14, borderRadius: 2, background: season.tint }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{season.emoji} {season.name}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {season.months.map((m) => {
              const ids = plan[m] ?? [];
              return (
                <div key={m} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 12px", display: "flex", flexDirection: "column", gap: 8, minHeight: 116 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.inkMid, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: season.tint }} />
                    {MONTHS[m]}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    {ids.length === 0 && <div style={{ fontSize: 11, color: C.inkFaint, fontStyle: "italic" }}>Open.</div>}
                    {ids.map((id) => {
                      const seed = SEED_BY_ID[id];
                      if (!seed) return null;
                      const cm = CAT_META[seed.category];
                      return (
                        <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, background: `${cm.color}12`, borderRadius: 8, padding: "5px 8px" }}>
                          <span style={{ flexShrink: 0, fontSize: 11 }}>{cm.icon}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: C.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={seed.concept}>{seed.concept}</span>
                          <button onClick={() => remove(m, id)} aria-label="Remove" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 0, flexShrink: 0 }}>
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => setPicker(m)} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%",
                    padding: "7px 0", borderRadius: 8, border: `1px dashed ${C.border}`, background: "transparent",
                    cursor: "pointer", color: C.tealDark, fontSize: 11.5, fontWeight: 700,
                  }}>
                    <Plus size={13} /> Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Picker */}
      {picker !== null && (
        <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,30,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.bgCard, borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "82vh", overflowY: "auto", padding: "18px 18px 22px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: C.ink, margin: 0 }}>Add to {MONTHS[picker]}</h3>
              <button onClick={() => setPicker(null)} aria-label="Close" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 2 }}>
                <X size={18} />
              </button>
            </div>
            {CATEGORIES.map((cat) => {
              const items = catalog.filter((a) => a.category === cat);
              return (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CAT_META[cat].color, marginBottom: 8 }}>{CAT_META[cat].icon} {cat}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {items.map((a) => {
                      const inMonth = (plan[picker] ?? []).includes(a.id);
                      return (
                        <button key={a.id} onClick={() => (inMonth ? remove(picker, a.id) : add(picker, a.id))}
                          style={{
                            display: "flex", alignItems: "flex-start", gap: 8, textAlign: "left", width: "100%",
                            padding: "9px 11px", borderRadius: 10, cursor: "pointer",
                            border: `1px solid ${inMonth ? C.teal : C.border}`,
                            background: inMonth ? C.tealWash : "transparent",
                          }}>
                          <span style={{ flexShrink: 0, marginTop: 1 }}>{inMonth ? <Check size={14} color={C.teal} /> : <Plus size={14} color={C.inkFaint} />}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: inMonth ? C.tealDark : C.inkMid }}>{a.concept}</span>
                            <span style={{ display: "block", fontSize: 10.5, color: C.inkFaint, marginTop: 1 }}>{a.commitment} · {a.whenToStart === "Now" ? "start now" : a.whenToStart.toLowerCase()}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

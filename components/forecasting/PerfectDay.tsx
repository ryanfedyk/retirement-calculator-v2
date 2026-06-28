"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Sparkles, RotateCcw, Check, Loader2, Pencil, CalendarRange, ArrowRight } from "lucide-react";
import { C } from "@/config/colors";
import { useUIStore } from "@/store/useUIStore";
import { useFinancialStore } from "@/store/useFinancialStore";
import { usePerfectDayStore } from "@/store/usePerfectDayStore";
import { usePerfectYearStore } from "@/store/usePerfectYearStore";
import { ADVENTURE_SEEDS } from "@/data/adventureSeeds";
import {
  ACTIVITIES, ACTIVITY_BY_ID, BLOCKS, CATEGORY_COLOR, THOUGHT_STARTERS, analyzeDay,
  type ActivityCategory, type DayBlock, type PerfectDayItem,
} from "@/lib/perfectDay";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const CATEGORIES = Object.keys(CATEGORY_COLOR) as ActivityCategory[];
const SEED_BY_ID = Object.fromEntries(ADVENTURE_SEEDS.map((s) => [s.id, s]));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const allIdsOf = (d: PerfectDayItem) => [...d.blocks.morning, ...d.blocks.afternoon, ...d.blocks.evening];
const uniqueCount = (d: PerfectDayItem) => new Set(allIdsOf(d)).size;

type AiInsight = { headline: string; reflection: string; prepare: string[]; tryAdding: string[] };
type YearSeed = { seedId: string; month: number; why?: string };
type Culmination = { title: string; essence: string; themes: string[]; passions: string[]; yearSeeds: YearSeed[] };

/** Build your ideal days in retirement: sketch several named days, get a warm
 * per-day read, and an AI "culmination" that names what your retirement is
 * really about — then seeds your Perfect Year. Lives in the Reclaim view on
 * desktop and mobile. The AI is proactive: reads surface on their own. */
export default function PerfectDay({ onGoToYear }: { onGoToYear?: () => void } = {}) {
  const { days, activeId, add, remove, clear, addDay, removeDay, renameDay, setActive } = usePerfectDayStore();
  const setFinancesOpen = useUIStore((s) => s.setFinancesOpen);
  const exitYear = useFinancialStore((s) => s.config.career_path.exit_year);
  const yearsToRetirement = exitYear ? Math.max(0, exitYear - new Date().getFullYear()) : null;

  const activeDay = useMemo(() => days.find((d) => d.id === activeId) ?? days[0], [days, activeId]);
  const allIds = useMemo(() => allIdsOf(activeDay), [activeDay]);
  const insights = useMemo(() => analyzeDay(allIds), [allIds]);
  const hasAny = allIds.length > 0;

  const [picker, setPicker] = useState<DayBlock | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameBuf, setNameBuf] = useState("");

  // ── Proactive per-day AI reflection (auto-surfaces; degrades to rules) ──────
  const [aiByDay, setAiByDay] = useState<Record<string, AiInsight>>({});
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  // Once Gemini reports it isn't configured, stop auto-firing (manual still works).
  const aiDisabled = useRef(false);
  const lastDaySig = useRef<Record<string, string>>({});
  const dayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dayPayload = (d: PerfectDayItem) => {
    const ins = analyzeDay(allIdsOf(d));
    return {
      blocks: BLOCKS.map((b) => ({ label: b.label, activities: d.blocks[b.id].map((id) => ACTIVITY_BY_ID[id]?.label).filter(Boolean) })),
      categories: ins.categories.map((c) => c.category),
      monthlyCost: ins.monthlyCost,
      exitYear, yearsToRetirement,
    };
  };

  const generateDayAI = async (d: PerfectDayItem, opts?: { auto?: boolean }) => {
    if (opts?.auto && (aiDisabled.current || aiLoadingId)) return;
    if (!opts?.auto) aiDisabled.current = false; // manual press re-enables a fresh try
    lastDaySig.current[d.id] = JSON.stringify(d.blocks);
    setAiLoadingId(d.id); setAiError(null);
    try {
      const res = await fetch("/api/perfect-day", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dayPayload(d)) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503 || res.status === 401) aiDisabled.current = true; // not configured / bad key
        throw new Error(data.detail || data.error || "Something went wrong.");
      }
      setAiByDay((m) => ({ ...m, [d.id]: data.insight as AiInsight }));
    } catch (e: any) {
      if (!opts?.auto) setAiError(e.message || "Couldn't generate insights.");
    } finally {
      setAiLoadingId((cur) => (cur === d.id ? null : cur));
    }
  };

  // Auto-fire a reflection when a day first becomes rich (≥3 activities) or its
  // content meaningfully changes — no button required.
  useEffect(() => {
    if (dayTimer.current) clearTimeout(dayTimer.current);
    if (uniqueCount(activeDay) < 3) return;
    const sig = JSON.stringify(activeDay.blocks);
    if (lastDaySig.current[activeDay.id] === sig) return;
    dayTimer.current = setTimeout(() => generateDayAI(activeDay, { auto: true }), 1300);
    return () => { if (dayTimer.current) clearTimeout(dayTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, JSON.stringify(activeDay.blocks)]);

  const ai = aiByDay[activeDay.id] ?? null;

  // ── Proactive culmination across all rich days ──────────────────────────────
  const richDays = useMemo(() => days.filter((d) => uniqueCount(d) >= 3), [days]);
  const culmSig = useMemo(() => JSON.stringify(richDays.map((d) => ({ n: d.name, b: d.blocks }))), [richDays]);
  const [culm, setCulm] = useState<Culmination | null>(null);
  const [culmLoading, setCulmLoading] = useState(false);
  const [culmError, setCulmError] = useState<string | null>(null);
  const [seededCount, setSeededCount] = useState<number | null>(null);
  const lastCulmSig = useRef<string>("");
  const culmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateCulmination = async (opts?: { auto?: boolean }) => {
    if (opts?.auto && (aiDisabled.current || culmLoading)) return;
    if (!opts?.auto) aiDisabled.current = false;
    lastCulmSig.current = culmSig;
    setCulmLoading(true); setCulmError(null); setSeededCount(null);
    try {
      const payload = {
        mode: "culmination" as const,
        days: richDays.map((d) => {
          const ins = analyzeDay(allIdsOf(d));
          return {
            name: d.name,
            blocks: BLOCKS.map((b) => ({ label: b.label, activities: d.blocks[b.id].map((id) => ACTIVITY_BY_ID[id]?.label).filter(Boolean) })),
            categories: ins.categories.map((c) => c.category),
          };
        }),
        catalog: ADVENTURE_SEEDS.map((s) => ({ id: s.id, concept: s.concept, category: s.category })),
        exitYear, yearsToRetirement,
      };
      const res = await fetch("/api/perfect-day", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503 || res.status === 401) aiDisabled.current = true;
        throw new Error(data.detail || data.error || "Something went wrong.");
      }
      const c = data.culmination as Culmination;
      // Keep only seeds that map to real catalog entries, with sane months.
      c.yearSeeds = (c.yearSeeds ?? []).filter((s) => SEED_BY_ID[s.seedId]).map((s) => ({ ...s, month: Math.min(11, Math.max(0, Math.round(s.month) || 0)) }));
      setCulm(c);
    } catch (e: any) {
      setCulmError(e.message || "Couldn't synthesize your days.");
    } finally {
      setCulmLoading(false);
    }
  };

  useEffect(() => {
    if (culmTimer.current) clearTimeout(culmTimer.current);
    if (richDays.length < 2) return;
    if (lastCulmSig.current === culmSig) return;
    culmTimer.current = setTimeout(() => generateCulmination({ auto: true }), 1900);
    return () => { if (culmTimer.current) clearTimeout(culmTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [culmSig, richDays.length]);

  const buildYear = () => {
    if (!culm) return;
    const yr = usePerfectYearStore.getState();
    let n = 0;
    for (const s of culm.yearSeeds) { if (SEED_BY_ID[s.seedId]) { yr.add(s.month, s.seedId); n++; } }
    setSeededCount(n);
  };

  const startRename = (d: PerfectDayItem) => { setEditingId(d.id); setNameBuf(d.name); };
  const commitRename = () => {
    if (editingId) { const n = nameBuf.trim(); if (n) renameDay(editingId, n); }
    setEditingId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Intro */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Sparkles size={18} color={C.teal} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: "-0.01em" }}>Your perfect days</h2>
        </div>
        <p style={{ fontSize: 13, color: C.inkSoft, maxWidth: 640, lineHeight: 1.5 }}>
          This is headspace work, not a budget. Sketch a few different days you'd actually want to live — a slow one, an adventurous one, a creative one. The more you add, the more clearly the throughline shows: what your retirement is really about.
        </p>
      </div>

      {/* Day switcher */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {days.map((d) => {
          const isActive = d.id === activeDay.id;
          if (editingId === d.id) {
            return (
              <input key={d.id} autoFocus value={nameBuf}
                onChange={(e) => setNameBuf(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                style={{ fontSize: 13, fontWeight: 700, color: C.ink, padding: "7px 11px", borderRadius: 99, border: `1px solid ${C.teal}`, background: C.bgCard, outline: "none", maxWidth: 200 }}
              />
            );
          }
          return (
            <div key={d.id} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 99,
              border: `1px solid ${isActive ? C.teal : C.border}`, background: isActive ? C.tealWash : C.bgCard,
            }}>
              <button onClick={() => setActive(d.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 700, color: isActive ? C.tealDark : C.inkMid }}>
                {d.name}
                <span style={{ fontWeight: 500, color: C.inkFaint, marginLeft: 6 }}>{uniqueCount(d) || ""}</span>
              </button>
              {isActive && (
                <button onClick={() => startRename(d)} aria-label="Rename day" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 0 }}>
                  <Pencil size={12} />
                </button>
              )}
              {days.length > 1 && (
                <button onClick={() => removeDay(d.id)} aria-label={`Delete ${d.name}`} style={{ display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 0 }}>
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
        <button onClick={addDay} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 99, border: `1px dashed ${C.border}`, background: "transparent", cursor: "pointer", color: C.tealDark, fontSize: 12.5, fontWeight: 700 }}>
          <Plus size={14} /> Add a day
        </button>
        {hasAny && (
          <button onClick={clear} title="Clear this day"
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 11, fontWeight: 600 }}>
            <RotateCcw size={13} /> Clear
          </button>
        )}
      </div>

      {/* Thought starters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {THOUGHT_STARTERS.map((t) => (
          <span key={t} style={{ fontSize: 11.5, color: C.inkMid, background: C.bgCard, border: `1px solid ${C.borderSoft}`, borderRadius: 99, padding: "6px 12px" }}>
            {t}
          </span>
        ))}
      </div>

      {/* The three blocks (for the active day) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {BLOCKS.map((b) => (
          <div key={b.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, minHeight: 150 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{b.emoji} {b.label}</div>
              <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 1 }}>{b.hint}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              {activeDay.blocks[b.id].length === 0 && (
                <div style={{ fontSize: 12, color: C.inkFaint, fontStyle: "italic", padding: "6px 0" }}>Nothing here yet.</div>
              )}
              {activeDay.blocks[b.id].map((id) => {
                const a = ACTIVITY_BY_ID[id];
                if (!a) return null;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, borderRadius: 9, padding: "7px 10px" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: CATEGORY_COLOR[a.category], flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.emoji} {a.label}</span>
                    {a.cost > 0 && <span style={{ fontSize: 10.5, color: C.inkFaint, flexShrink: 0 }}>{money(a.cost)}/mo</span>}
                    <button onClick={() => remove(b.id, id)} aria-label={`Remove ${a.label}`} style={{ display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 0, flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setPicker(b.id)} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
              padding: "9px 0", borderRadius: 9, border: `1px dashed ${C.border}`, background: "transparent",
              cursor: "pointer", color: C.tealDark, fontSize: 12, fontWeight: 700,
            }}>
              <Plus size={14} /> Add to {b.label.toLowerCase()}
            </button>
          </div>
        ))}
      </div>

      {/* Insights for the active day */}
      {hasAny && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint }}>What this day is telling you</div>

          {/* Balance coaching — the emotional read leads */}
          <div style={{ display: "flex", gap: 10, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{insights.gap ? "💡" : "✨"}</span>
            <div>
              <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.55 }}>{insights.balanceNote}</div>
              {insights.categories.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {insights.categories.map(({ category, count }) => (
                    <span key={category} style={{ fontSize: 10.5, fontWeight: 700, color: CATEGORY_COLOR[category], background: `${CATEGORY_COLOR[category]}1a`, borderRadius: 6, padding: "2px 8px" }}>
                      {category} · {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI personalization — proactive; auto-surfaces for a rich day */}
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
            {!ai && aiLoadingId !== activeDay.id && !aiError && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>A personal read on this day</div>
                  <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>{uniqueCount(activeDay) >= 3 ? "Reflecting automatically as you build…" : "Add a few more activities and a warm, tailored reflection appears on its own."}</div>
                </div>
                <button onClick={() => generateDayAI(activeDay)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8,
                  border: "none", background: C.teal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}>
                  <Sparkles size={15} /> Reflect now
                </button>
              </div>
            )}
            {aiLoadingId === activeDay.id && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, color: C.inkSoft, fontSize: 13 }}>
                <Loader2 size={16} color={C.teal} style={{ animation: "spin 1s linear infinite" }} /> Reflecting on this day…
              </div>
            )}
            {aiError && aiLoadingId !== activeDay.id && !ai && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: C.warm, flex: 1, minWidth: 0 }}>Couldn’t generate insights — {aiError}</span>
                <button onClick={() => generateDayAI(activeDay)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, color: C.inkMid, cursor: "pointer" }}>
                  <RotateCcw size={13} /> Try again
                </button>
              </div>
            )}
            {ai && aiLoadingId !== activeDay.id && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <Sparkles size={15} color={C.teal} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{ai.headline}</span>
                </div>
                <p style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6, margin: 0 }}>{ai.reflection}</p>
                {ai.prepare?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 7 }}>To grow into it</div>
                    {ai.prepare.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: 9, marginBottom: 7 }}>
                        <span style={{ flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: 5, background: C.tealWash, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={11} color={C.teal} /></span>
                        <span style={{ fontSize: 12.5, color: C.inkMid, lineHeight: 1.5 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                )}
                {ai.tryAdding?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 7 }}>You might also love</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {ai.tryAdding.map((t, i) => (
                        <span key={i} style={{ fontSize: 12, color: C.tealDark, background: C.tealWash, borderRadius: 8, padding: "5px 10px" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => generateDayAI(activeDay)} style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 11, fontWeight: 600 }}>
                  <RotateCcw size={12} /> Regenerate
                </button>
              </div>
            )}
          </div>

          {/* Cost — a quiet footnote, not the headline. */}
          <div style={{ fontSize: 11.5, color: C.inkFaint, lineHeight: 1.5 }}>
            For reference, a day like this runs about <span style={{ color: C.inkSoft, fontWeight: 600 }}>{money(insights.monthlyCost)}/mo</span> in lifestyle spending.{" "}
            <button onClick={() => setFinancesOpen(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.tealDark, fontSize: 11.5, fontWeight: 600, textDecoration: "underline" }}>
              See it against your plan
            </button>
          </div>
        </div>
      )}

      {/* ── The culmination: what your retirement is really about ── */}
      {(richDays.length >= 2 || culm || culmLoading) && (
        <div style={{ borderRadius: 16, padding: "18px 20px", background: `linear-gradient(135deg, ${C.tealWash}, ${C.bgCard})`, border: `1px solid ${C.tealLight}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Sparkles size={16} color={C.teal} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.tealDark }}>The bigger picture</span>
            {richDays.length >= 2 && !culmLoading && (
              <button onClick={() => generateCulmination()} title="Re-synthesize" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 11, fontWeight: 600 }}>
                <RotateCcw size={12} /> {culm ? "Refresh" : "Synthesize"}
              </button>
            )}
          </div>

          {culmLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, color: C.inkSoft, fontSize: 13, padding: "6px 0" }}>
              <Loader2 size={16} color={C.teal} style={{ animation: "spin 1s linear infinite" }} /> Finding the throughline across your days…
            </div>
          )}

          {culmError && !culmLoading && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, paddingTop: 4 }}>
              <span style={{ fontSize: 12.5, color: C.warm, flex: 1, minWidth: 0 }}>Couldn’t synthesize — {culmError}</span>
              <button onClick={() => generateCulmination()} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, color: C.inkMid, cursor: "pointer" }}>
                <RotateCcw size={13} /> Try again
              </button>
            </div>
          )}

          {!culm && !culmLoading && !culmError && (
            <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.55, margin: "4px 0 0" }}>
              You've sketched {richDays.length} days. A synthesis of what they have in common — your passions and what your retirement is really about — will appear here.
            </p>
          )}

          {culm && !culmLoading && (
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 300, color: C.ink, margin: "6px 0 0", letterSpacing: "-0.01em" }}>{culm.title}</h3>
              <p style={{ fontSize: 13.5, color: C.inkMid, lineHeight: 1.6, margin: "8px 0 0" }}>{culm.essence}</p>

              {culm.passions?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 7 }}>Passions we see</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {culm.passions.map((p, i) => (
                      <span key={i} style={{ fontSize: 12.5, fontWeight: 600, color: C.tealDark, background: "#ffffffcc", border: `1px solid ${C.tealLight}`, borderRadius: 99, padding: "5px 12px" }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {culm.themes?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {culm.themes.map((t, i) => (
                    <span key={i} style={{ fontSize: 11, color: C.inkSoft, background: C.bg, borderRadius: 6, padding: "3px 9px" }}>#{t.replace(/\s+/g, "")}</span>
                  ))}
                </div>
              )}

              {/* Feed the Perfect Year */}
              {culm.yearSeeds?.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.tealLight}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                    <CalendarRange size={14} color={C.teal} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>Experiences to build your year around</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {culm.yearSeeds.map((s, i) => {
                      const seed = SEED_BY_ID[s.seedId];
                      if (!seed) return null;
                      return (
                        <div key={i} style={{ display: "flex", gap: 9, background: "#ffffffcc", borderRadius: 10, padding: "9px 11px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.tealDark, flexShrink: 0, width: 30 }}>{MONTHS[s.month]}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.inkMid }}>{seed.concept}</div>
                            {s.why && <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 1, lineHeight: 1.45 }}>{s.why}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {seededCount === null ? (
                    <button onClick={buildYear} style={{
                      marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10,
                      border: "none", background: C.teal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 14px ${C.teal}44`,
                    }}>
                      <Sparkles size={15} /> Build my Perfect Year from this
                    </button>
                  ) : (
                    <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: C.tealDark }}>
                        <Check size={15} /> Added {seededCount} {seededCount === 1 ? "experience" : "experiences"} to your year
                      </span>
                      {onGoToYear && (
                        <button onClick={onGoToYear} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.tealLight}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, color: C.tealDark, cursor: "pointer" }}>
                          See my Perfect Year <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Activity picker */}
      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,30,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.bgCard, borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "82vh", overflowY: "auto", padding: "18px 18px 22px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: C.ink, margin: 0 }}>Add to {BLOCKS.find((b) => b.id === picker)?.label.toLowerCase()}</h3>
              <button onClick={() => setPicker(null)} aria-label="Close" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 2 }}>
                <X size={18} />
              </button>
            </div>
            {CATEGORIES.map((cat) => {
              const items = ACTIVITIES.filter((a) => a.category === cat);
              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CATEGORY_COLOR[cat], marginBottom: 7 }}>{cat}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {items.map((a) => {
                      const inBlock = activeDay.blocks[picker].includes(a.id);
                      return (
                        <button key={a.id} onClick={() => (inBlock ? remove(picker, a.id) : add(picker, a.id))}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600,
                            padding: "7px 11px", borderRadius: 99, cursor: "pointer",
                            border: `1px solid ${inBlock ? C.teal : C.border}`,
                            background: inBlock ? C.tealWash : "transparent",
                            color: inBlock ? C.tealDark : C.inkMid,
                          }}>
                          <span>{a.emoji} {a.label}</span>
                          {inBlock ? <Check size={13} /> : <Plus size={13} color={C.inkFaint} />}
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

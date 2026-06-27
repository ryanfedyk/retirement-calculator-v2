"use client";
import { useMemo, useState } from "react";
import { Plus, X, Wallet, Sparkles, RotateCcw, Check } from "lucide-react";
import { C } from "@/config/colors";
import { useUIStore } from "@/store/useUIStore";
import { usePerfectDayStore } from "@/store/usePerfectDayStore";
import {
  ACTIVITIES, ACTIVITY_BY_ID, BLOCKS, CATEGORY_COLOR, THOUGHT_STARTERS, analyzeDay,
  type ActivityCategory, type DayBlock,
} from "@/lib/perfectDay";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const CATEGORIES = Object.keys(CATEGORY_COLOR) as ActivityCategory[];

/** Build your ideal day in retirement: assemble activities into morning /
 * afternoon / evening, and get rule-based insights on what it costs and what to
 * start preparing now. Lives in the Reclaim view on desktop and mobile. */
export default function PerfectDay() {
  const { blocks, add, remove, clear } = usePerfectDayStore();
  const setFinancesOpen = useUIStore((s) => s.setFinancesOpen);
  const [picker, setPicker] = useState<DayBlock | null>(null);

  const allIds = useMemo(() => [...blocks.morning, ...blocks.afternoon, ...blocks.evening], [blocks]);
  const insights = useMemo(() => analyzeDay(allIds), [allIds]);
  const hasAny = allIds.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Intro */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Sparkles size={18} color={C.teal} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: "-0.01em" }}>Your perfect day</h2>
          {hasAny && (
            <button onClick={clear} title="Start over"
              style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 11, fontWeight: 600 }}>
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: C.inkSoft, maxWidth: 620, lineHeight: 1.5 }}>
          Retirement isn't an absence of work — it's a day you actually want to live, on repeat. Build one below, and we'll show what it asks of your plan and what to start preparing now.
        </p>
      </div>

      {/* Thought starters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {THOUGHT_STARTERS.map((t) => (
          <span key={t} style={{ fontSize: 11.5, color: C.inkMid, background: C.bgCard, border: `1px solid ${C.borderSoft}`, borderRadius: 99, padding: "6px 12px" }}>
            {t}
          </span>
        ))}
      </div>

      {/* The three blocks */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {BLOCKS.map((b) => (
          <div key={b.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, minHeight: 150 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{b.emoji} {b.label}</div>
              <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 1 }}>{b.hint}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              {blocks[b.id].length === 0 && (
                <div style={{ fontSize: 12, color: C.inkFaint, fontStyle: "italic", padding: "6px 0" }}>Nothing here yet.</div>
              )}
              {blocks[b.id].map((id) => {
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

      {/* Insights */}
      {hasAny && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint }}>What this means for your plan</div>

          {/* Cost */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, background: C.tealWash, border: `1px solid ${C.tealLight}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.tealDark }}>This day costs about</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
                {money(insights.monthlyCost)}/mo <span style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft }}>· {money(insights.annualCost)}/yr</span>
              </div>
            </div>
            <button onClick={() => setFinancesOpen(true)} style={{
              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
              border: "none", background: C.teal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              <Wallet size={15} /> Check my spending
            </button>
          </div>

          {/* Balance coaching */}
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

          {/* Readiness checklist */}
          {insights.prep.length > 0 && (
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Start preparing now</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {insights.prep.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 9 }}>
                    <span style={{ flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: 5, background: C.tealWash, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={11} color={C.teal} />
                    </span>
                    <span style={{ fontSize: 12.5, color: C.inkMid, lineHeight: 1.5 }}>{p}</span>
                  </div>
                ))}
              </div>
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
                      const inBlock = blocks[picker].includes(a.id);
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

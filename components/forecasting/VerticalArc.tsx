"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, X, Sparkles, Loader2 } from "lucide-react";
import type { ArcSeason } from "@/lib/perfectWizard";
import { R, SERIF, SEASON_META } from "./reclaimTheme";

type Key = ArcSeason["key"];

const NOMINAL_EXIT = 55; // layout fallback when the real exit age is unknown
const RAIL = 48;         // width of the left rail the spine runs down

/**
 * The arc as a vertical journey: a spine from your exit at the top to the horizon
 * at the bottom, the three seasons flowing one into the next as you scroll. Zoom
 * (pinch / +- / ⌘-scroll) does two things at once — it stretches the years AND
 * changes the fidelity: zoomed out you see the whole shape of a life as compact
 * bands; zoomed in each pursuit opens into a card with its first step, and you can
 * add your own — which asks the coach to round out the rest of the arc.
 */
export default function VerticalArc({
  arc, exitAge, horizonAge = 90, headline, tail, onAddPursuit, optimizingSeason,
}: {
  arc: ArcSeason[];
  exitAge: number | null;
  horizonAge?: number;
  headline?: string;
  tail?: React.ReactNode;
  onAddPursuit?: (season: Key, text: string) => void;
  optimizingSeason?: Key | null;
}) {
  const showAges = exitAge != null;
  const start = exitAge ?? NOMINAL_EXIT;
  const years = Math.max(9, horizonAge - start);

  const MIN_PX = 6, MAX_PX = 64;
  const [pxPerYear, setPxPerYear] = useState(18);
  const pxRef = useRef(pxPerYear);
  useEffect(() => { pxRef.current = pxPerYear; }, [pxPerYear]);
  const clampPx = (v: number) => Math.min(MAX_PX, Math.max(MIN_PX, v));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fidelity follows the zoom: overview → titles → full detail + add.
  const level: "far" | "mid" | "near" = pxPerYear < 13 ? "far" : pxPerYear < 32 ? "mid" : "near";

  const [adding, setAdding] = useState<Key | null>(null);
  const [addText, setAddText] = useState("");
  const submitAdd = (k: Key) => {
    const t = addText.trim();
    if (t && onAddPursuit) onAddPursuit(k, t);
    setAddText(""); setAdding(null);
  };

  // Resolve each season's age span (equal thirds when real ages are unknown).
  const seasons = useMemo(() => arc.map((s, i) => {
    const from = s.ageFrom ?? Math.round(start + (years / 3) * i);
    const to   = s.ageTo   ?? Math.round(start + (years / 3) * (i + 1));
    return { ...s, from, to, meta: SEASON_META[s.key], span: Math.max(1, to - from) };
  }), [arc, start, years]);

  // Vertical pinch-to-zoom (touch) + trackpad/⌘-wheel, anchored near the top.
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const midY = (t: TouchList) => (t[0].clientY + t[1].clientY) / 2;
    let startDist = 0, startPx = 18, localMid = 0, startScroll = 0, pinching = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinching = true; startDist = dist(e.touches); startPx = pxRef.current;
        localMid = midY(e.touches) - el.getBoundingClientRect().top; startScroll = el.scrollTop;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!pinching || e.touches.length !== 2) return;
      e.preventDefault();
      const np = clampPx(startPx * (dist(e.touches) / Math.max(1, startDist)));
      setPxPerYear(np);
      const ratio = np / startPx;
      const contentY = startScroll + localMid;
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = contentY * ratio - localMid; });
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinching = false; };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setPxPerYear(clampPx(pxRef.current * (e.deltaY < 0 ? 1.1 : 0.9)));
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (dir: 1 | -1) => setPxPerYear((v) => clampPx(v * (dir === 1 ? 1.3 : 1 / 1.3)));

  const spineGrad = `linear-gradient(to bottom, ${SEASON_META.open.color}, ${SEASON_META.roots.color} 52%, ${SEASON_META.still.color})`;
  const dot = (size: number, color: string, ring = R.card2): React.CSSProperties => ({
    position: "absolute", left: RAIL / 2 - size / 2 - RAIL, width: size, height: size, borderRadius: "50%",
    background: color, border: `2.5px solid ${ring}`, boxShadow: `0 2px 6px -2px ${color}`,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative" }}>
      <div ref={scrollRef} style={{ flex: "1 1 auto", overflowY: "auto", overflowX: "hidden", minHeight: 0, WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}>
        {/* Throughline hero */}
        <div style={{ padding: "2px 2px 20px" }}>
          {headline && (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: R.accentInk, marginBottom: 5 }}>Your retirement looks like</div>
              <div style={{ fontFamily: SERIF, fontSize: "clamp(22px, 5vw, 30px)", fontWeight: 500, color: R.ink, lineHeight: 1.15, letterSpacing: "-0.015em" }}>{headline}</div>
            </>
          )}
          <div style={{ fontSize: 12, color: R.inkFaint, marginTop: headline ? 12 : 0, lineHeight: 1.5 }}>
            {showAges ? `Age ${start} → ${horizonAge}` : "Your retirement, start → horizon"} · scroll the years, pinch to zoom{onAddPursuit ? " in to add" : ""}
          </div>
        </div>

        {/* The spine + seasons */}
        <div style={{ position: "relative", paddingLeft: RAIL }}>
          <div style={{ position: "absolute", left: RAIL / 2 - 2, top: 4, bottom: 26, width: 4, borderRadius: 99, background: spineGrad }} />

          {seasons.map((s) => {
            const kc = s.meta.color;
            const optimizing = optimizingSeason === s.key;

            // ── Far: a compact band, the whole life at a glance ──
            if (level === "far") {
              return (
                <div key={s.key} style={{ position: "relative", minHeight: Math.max(46, s.span * pxPerYear), marginBottom: 6, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ ...dot(16, kc), top: 3 }} />
                  <span style={{ fontSize: 19, lineHeight: 1, marginTop: 1 }}>{s.meta.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: R.ink, lineHeight: 1.1 }}>{s.meta.name}</div>
                    <div style={{ fontSize: 11, color: R.inkFaint, marginTop: 2 }}>
                      {showAges && <span style={{ fontWeight: 700, color: kc }}>{s.key === "still" ? `${s.from}+` : `${s.from}–${s.to}`}</span>}
                      {s.pursuits.length > 0 && <span>{showAges ? " · " : ""}{s.pursuits.length} pursuit{s.pursuits.length === 1 ? "" : "s"}</span>}
                    </div>
                  </div>
                </div>
              );
            }

            // ── Mid / Near: header + pursuit cards (+ add, at near) ──
            return (
              <div key={s.key} style={{ position: "relative", minHeight: s.span * pxPerYear, marginBottom: 8 }}>
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <span style={dot(20, kc)} />
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{s.meta.emoji}</span>
                    <div>
                      <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: R.ink, lineHeight: 1.1 }}>{s.meta.name}</div>
                      {showAges && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: kc, letterSpacing: "0.04em" }}>{s.key === "still" ? `${s.from}+` : `Age ${s.from}–${s.to}`}</div>
                      )}
                    </div>
                  </div>
                  {level === "near" && <div style={{ fontSize: 12.5, color: R.inkSoft, lineHeight: 1.5, marginTop: 9 }}>{s.meta.blurb}</div>}
                  {s.themeLabels.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {s.themeLabels.map((t) => (
                        <span key={t} style={{ fontSize: 10.5, fontWeight: 600, color: kc, background: "#ffffffcc", border: `1px solid color-mix(in oklab, ${kc} 30%, transparent)`, borderRadius: 99, padding: "3px 10px" }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {(s.pursuits.length > 0 || level === "near") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: level === "near" ? 10 : 8 }}>
                    {s.pursuits.map((p) => (
                      <div key={p.id} style={{ position: "relative" }}>
                        <span style={dot(11, kc)} />
                        <div style={{ borderRadius: 14, background: R.card2, border: `1px solid color-mix(in oklab, ${kc} 22%, ${R.line})`, borderLeft: `3px solid ${kc}`, padding: level === "near" ? "11px 13px" : "9px 12px", boxShadow: "0 1px 3px rgba(20,30,26,0.06)" }}>
                          <div style={{ fontFamily: SERIF, fontSize: level === "near" ? 15 : 14, fontWeight: 500, color: R.ink, lineHeight: 1.25 }}>{p.concept}</div>
                          {level === "near" && p.microDoseAction && <div style={{ fontSize: 12, color: R.inkSoft, marginTop: 5, lineHeight: 1.45 }}>👉 {p.microDoseAction}</div>}
                        </div>
                      </div>
                    ))}

                    {/* Add affordance — near zoom only */}
                    {level === "near" && onAddPursuit && (
                      <div style={{ position: "relative" }}>
                        <span style={{ ...dot(11, kc), background: R.card2, borderStyle: "dashed" }} />
                        {adding === s.key ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", borderRadius: 14, background: R.card2, border: `1.5px solid ${kc}`, padding: "8px 8px 8px 12px" }}>
                            <input autoFocus value={addText} onChange={(e) => setAddText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") submitAdd(s.key); if (e.key === "Escape") { setAdding(null); setAddText(""); } }}
                              placeholder={`Add to ${s.meta.name}…`}
                              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 14, color: R.ink }} />
                            <button onClick={() => submitAdd(s.key)} disabled={!addText.trim()} style={{ flexShrink: 0, background: addText.trim() ? kc : R.line, color: "#fff", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: addText.trim() ? "pointer" : "default" }}>Add</button>
                            <button onClick={() => { setAdding(null); setAddText(""); }} aria-label="Cancel" style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: R.inkFaint, display: "flex", padding: 4 }}><X size={16} /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setAdding(s.key); setAddText(""); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, borderRadius: 14, background: "transparent", border: `1.5px dashed color-mix(in oklab, ${kc} 45%, ${R.line})`, color: kc, padding: "11px 13px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                            <Plus size={15} /> Add to {s.meta.name}
                          </button>
                        )}
                        {optimizing && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, fontWeight: 600, color: R.accentInk }}>
                            <Loader2 size={13} className="animate-spin" /> optimizing your arc…
                          </div>
                        )}
                      </div>
                    )}

                    {s.pursuits.length === 0 && level !== "near" && (
                      <div style={{ fontSize: 12, color: R.inkFaint, fontStyle: "italic" }}>Open space — room to grow into.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* horizon */}
          <div style={{ position: "relative", paddingTop: 2 }}>
            <span style={dot(14, SEASON_META.still.color)} />
            <div style={{ fontSize: 12, fontWeight: 600, color: R.inkFaint }}>{showAges ? `Age ${horizonAge} · the horizon` : "the horizon"}</div>
          </div>
        </div>

        {tail && <div style={{ padding: "20px 2px 64px" }}>{tail}</div>}
      </div>

      {/* floating zoom controls + fidelity hint */}
      <div style={{ position: "absolute", right: 4, bottom: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
        <button onClick={() => zoom(1)} aria-label="Zoom in" style={zbtn}><Plus size={16} /></button>
        <button onClick={() => zoom(-1)} aria-label="Zoom out" style={zbtn}><Minus size={16} /></button>
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: R.inkFaint, display: "inline-flex", alignItems: "center", gap: 3 }}>
          {level === "near" && <Sparkles size={9} />}{level === "far" ? "overview" : level === "mid" ? "titles" : "detail"}
        </span>
      </div>
    </div>
  );
}

const zbtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: "50%", border: `1px solid ${R.line}`, background: R.card2, color: R.inkSoft,
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px -6px rgba(20,30,26,0.35)",
};

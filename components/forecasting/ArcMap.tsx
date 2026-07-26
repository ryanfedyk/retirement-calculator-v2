"use client";
import { useState } from "react";
import { Plus, X, Loader2, MapPin, Sparkles } from "lucide-react";
import type { ArcSeason } from "@/lib/perfectWizard";
import { R, SERIF, SEASON_META } from "./reclaimTheme";

type Key = ArcSeason["key"];

const NOMINAL_EXIT = 55; // layout fallback when the real exit age is unknown

/**
 * The arc as a BIRD'S-EYE TERRITORY — the retirement laid out as three lands you
 * roam, not a list you scroll. Each season is a soft landscape region with its
 * pursuits dropped in as map markers you tap to open. A journey ribbon up top
 * orients the whole territory (exit → horizon), and you can drop a new marker
 * into any land, which asks the coach to grow the rest of the map around it.
 */
export default function ArcMap({
  arc, exitAge, horizonAge = 90, headline, tail, onAddPursuit, optimizingSeason, building = false,
}: {
  arc: ArcSeason[];
  exitAge: number | null;
  horizonAge?: number;
  headline?: string;
  tail?: React.ReactNode;
  onAddPursuit?: (season: Key, text: string) => void;
  optimizingSeason?: Key | null;
  building?: boolean;
}) {
  const showAges = exitAge != null;
  const start = exitAge ?? NOMINAL_EXIT;
  const years = Math.max(9, horizonAge - start);

  const [openPin, setOpenPin] = useState<string | null>(null);
  const [adding, setAdding] = useState<Key | null>(null);
  const [addText, setAddText] = useState("");
  const submitAdd = (k: Key) => {
    const t = addText.trim();
    if (t && onAddPursuit) onAddPursuit(k, t);
    setAddText(""); setAdding(null);
  };

  // Resolve each land's age span (equal thirds when real ages are unknown).
  const lands = arc.map((s, i) => {
    const from = s.ageFrom ?? Math.round(start + (years / 3) * i);
    const to   = s.ageTo   ?? Math.round(start + (years / 3) * (i + 1));
    return { ...s, from, to, meta: SEASON_META[s.key] };
  });

  const ribbonGrad = `linear-gradient(90deg, ${SEASON_META.open.color}, ${SEASON_META.roots.color} 50%, ${SEASON_META.still.color})`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style>{`
        @keyframes arcmap-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .arcmap-land { animation: arcmap-rise 0.5s ease both; }
        .arcmap-land:hover { box-shadow: 0 20px 44px -22px rgba(20,30,26,0.4); }
        .arcmap-pin { transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease; }
        .arcmap-pin:hover { transform: translateY(-2px); box-shadow: 0 10px 22px -12px rgba(20,30,26,0.45); }
      `}</style>

      <div style={{ flex: "1 1 auto", overflowY: "auto", overflowX: "hidden", minHeight: 0, WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}>
        {/* Throughline hero */}
        <div style={{ padding: "2px 2px 18px" }}>
          {headline && (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: R.accentInk, marginBottom: 5 }}>Your retirement looks like</div>
              <div style={{ fontFamily: SERIF, fontSize: "clamp(22px, 5vw, 32px)", fontWeight: 500, color: R.ink, lineHeight: 1.14, letterSpacing: "-0.015em" }}>{headline}</div>
            </>
          )}
          <div style={{ fontSize: 12, color: R.inkFaint, marginTop: headline ? 10 : 0, lineHeight: 1.5 }}>
            {showAges ? `Age ${start} → ${horizonAge}` : "Your retirement, start → horizon"} · three lands to roam{onAddPursuit ? " · tap a marker, or drop your own" : ""}
          </div>
          {building && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, padding: "9px 14px", borderRadius: 12, background: `color-mix(in oklab, ${R.accent} 9%, ${R.card2})`, border: `1px solid color-mix(in oklab, ${R.accent} 28%, ${R.line})` }}>
              <Loader2 size={14} className="animate-spin" color={R.accentInk} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: R.accentInk }}>Growing your map from your seeds…</span>
            </div>
          )}
        </div>

        {/* Journey ribbon — the whole territory at a glance */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ position: "relative", height: 12, borderRadius: 999, background: ribbonGrad, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)" }}>
            {lands.map((s, i) => (
              <div key={s.key} title={s.meta.name} style={{ position: "absolute", top: -3, left: `calc(${(i / 3) * 100}% + ${i === 0 ? 4 : 0}px)`, width: 18, height: 18, borderRadius: "50%", background: R.card2, border: `3px solid ${s.meta.color}`, transform: i === 0 ? "none" : "translateX(-50%)", boxShadow: "0 2px 5px -1px rgba(0,0,0,0.25)" }} />
            ))}
            <div style={{ position: "absolute", top: -3, right: 0, width: 18, height: 18, borderRadius: "50%", background: SEASON_META.still.color, border: `3px solid ${R.card2}`, boxShadow: "0 2px 5px -1px rgba(0,0,0,0.25)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 10.5, color: R.inkFaint }}>
            <span style={{ fontWeight: 700, color: R.accentInk }}>{showAges ? `${start} · you are here` : "you are here"}</span>
            <span>{showAges ? `${horizonAge} · the horizon` : "the horizon"}</span>
          </div>
        </div>

        {/* The three lands */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(258px, 1fr))", gap: 14, alignItems: "start" }}>
          {lands.map((s, i) => {
            const kc = s.meta.color;
            const optimizing = optimizingSeason === s.key;
            return (
              <div key={s.key} className="arcmap-land" style={{
                animationDelay: `${i * 90}ms`,
                position: "relative", borderRadius: 26, overflow: "hidden",
                border: `1px solid color-mix(in oklab, ${kc} 34%, ${R.line})`,
                background: `
                  radial-gradient(120% 80% at 15% 0%, color-mix(in oklab, ${kc} 20%, ${R.card2}) 0%, transparent 60%),
                  radial-gradient(120% 90% at 90% 100%, color-mix(in oklab, ${kc} 16%, ${R.card2}) 0%, transparent 55%),
                  ${s.meta.tint}`,
                boxShadow: "0 4px 18px -12px rgba(20,30,26,0.3)", transition: "box-shadow 0.2s ease",
                display: "flex", flexDirection: "column", minHeight: 210,
              }}>
                {/* Land header */}
                <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid color-mix(in oklab, ${kc} 18%, transparent)` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                    <span style={{ fontSize: 30, lineHeight: 1, flexShrink: 0, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))" }}>{s.meta.emoji}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: R.ink, lineHeight: 1.08 }}>{s.meta.name}</div>
                      <div style={{ fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: kc }}>{showAges ? (s.key === "still" ? `${s.from}+` : `Age ${s.from}–${s.to}`) : `Chapter ${i + 1}`}</span>
                        <span style={{ color: R.inkFaint }}>· {s.pursuits.length} marker{s.pursuits.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    {i === 0 && showAges && (
                      <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", background: kc, borderRadius: 99, padding: "3px 8px" }}>
                        <MapPin size={9} /> here
                      </span>
                    )}
                  </div>
                  {s.themeLabels.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 11 }}>
                      {s.themeLabels.map((t) => (
                        <span key={t} style={{ fontSize: 10, fontWeight: 600, color: kc, background: "#ffffffcc", border: `1px solid color-mix(in oklab, ${kc} 30%, transparent)`, borderRadius: 99, padding: "2px 9px" }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Markers dropped in this land */}
                <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto" }}>
                  {s.pursuits.length === 0 && (
                    <div style={{ fontSize: 12, color: R.inkFaint, fontStyle: "italic", padding: "6px 2px" }}>Open land — room to grow into.</div>
                  )}
                  {s.pursuits.map((p) => {
                    const open = openPin === p.id;
                    return (
                      <button key={p.id} className="arcmap-pin" onClick={() => setOpenPin(open ? null : p.id)} style={{
                        textAlign: "left", cursor: "pointer", borderRadius: 13, padding: "10px 12px",
                        border: `1px solid ${open ? kc : `color-mix(in oklab, ${kc} 24%, ${R.line})`}`,
                        background: open ? `color-mix(in oklab, ${kc} 10%, ${R.card2})` : R.card2,
                        display: "block", width: "100%",
                      }}>
                        <span style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                          <span style={{ flexShrink: 0, marginTop: 3, width: 10, height: 10, borderRadius: "50%", background: kc, boxShadow: `0 0 0 3px color-mix(in oklab, ${kc} 22%, transparent)` }} />
                          <span style={{ fontFamily: SERIF, fontSize: 14.5, fontWeight: 500, color: R.ink, lineHeight: 1.25 }}>{p.concept}</span>
                        </span>
                        {open && p.microDoseAction && (
                          <span style={{ display: "block", fontSize: 12, color: R.inkSoft, marginTop: 8, paddingLeft: 19, lineHeight: 1.5 }}>👉 {p.microDoseAction}</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Drop a new marker into this land */}
                  {onAddPursuit && (
                    <div style={{ marginTop: 2 }}>
                      {adding === s.key ? (
                        <div style={{ display: "flex", gap: 7, alignItems: "center", borderRadius: 13, background: R.card2, border: `1.5px solid ${kc}`, padding: "6px 6px 6px 11px" }}>
                          <input autoFocus value={addText} onChange={(e) => setAddText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(s.key); if (e.key === "Escape") { setAdding(null); setAddText(""); } }}
                            placeholder={`Drop a marker in ${s.meta.name}…`}
                            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 13.5, color: R.ink }} />
                          <button onClick={() => submitAdd(s.key)} disabled={!addText.trim()} style={{ flexShrink: 0, background: addText.trim() ? kc : R.line, color: "#fff", border: "none", borderRadius: 9, padding: "7px 11px", fontSize: 12, fontWeight: 700, cursor: addText.trim() ? "pointer" : "default" }}>Add</button>
                          <button onClick={() => { setAdding(null); setAddText(""); }} aria-label="Cancel" style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: R.inkFaint, display: "flex", padding: 3 }}><X size={15} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setAdding(s.key); setAddText(""); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 13, background: "transparent", border: `1.5px dashed color-mix(in oklab, ${kc} 45%, ${R.line})`, color: kc, padding: "10px", cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>
                          <Plus size={14} /> Drop a marker
                        </button>
                      )}
                      {optimizing && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, fontWeight: 600, color: R.accentInk }}>
                          <Loader2 size={12} className="animate-spin" /> reshaping the land…
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {tail && <div style={{ padding: "22px 2px 56px" }}>{tail}</div>}
      </div>
    </div>
  );
}

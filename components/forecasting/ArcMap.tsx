"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Minus, X, Loader2, MapPin, Flag, Navigation } from "lucide-react";
import type { ArcSeason } from "@/lib/perfectWizard";
import type { ArcLifeEvent } from "@/lib/arcLifeEvents";
import { R, SERIF, SEASON_META } from "./reclaimTheme";

type Key = ArcSeason["key"];

const NOMINAL_EXIT = 55;       // layout fallback when the real exit age is unknown
const ORDER: Key[] = ["open", "roots", "still"];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * The arc as a winding "board game of life" path. Time runs along a road that
 * snakes left → right, doubles back, and descends row by row from your exit age
 * to the horizon. Your chosen pursuits branch off it as pins; the concrete life
 * events we already plot elsewhere — mortgage payoff, kids into and out of
 * college, the empty nest, Social Security, Medicare — sit as spaces ON the road
 * at the age each happens, so the whole map reads in real time. Drag to roam,
 * pinch/‑buttons to zoom, drop your own pins.
 */
export default function ArcMap({
  arc, exitAge, horizonAge = 90, lifeEvents = [], headline, tail, onAddPursuit, optimizingSeason, building = false,
}: {
  arc: ArcSeason[];
  exitAge: number | null;
  horizonAge?: number;
  lifeEvents?: ArcLifeEvent[];
  headline?: string;
  tail?: React.ReactNode;
  onAddPursuit?: (season: Key, text: string) => void;
  optimizingSeason?: Key | null;
  building?: boolean;
}) {
  const showAges = exitAge != null;
  const start = exitAge ?? NOMINAL_EXIT;
  const years = Math.max(9, horizonAge - start);

  // ── Serpentine layout ──────────────────────────────────────────────────────
  const W = 1240;
  const ROWS = Math.max(3, Math.min(6, Math.round(years / 8)));
  const PAD = 152;                       // ≥ turn radius so U-turns stay on-canvas
  const TOP = 180, BOTTOM = 150, ROWGAP = 230;
  const H = TOP + (ROWS - 1) * ROWGAP + BOTTOM;
  const xL = PAD, xR = W - PAD;
  const rowY = (i: number) => TOP + i * ROWGAP;
  const turnR = ROWGAP / 2;

  const pointAt = (t: number) => {
    const tt = clamp01(t);
    const rf = 1 / ROWS;
    let row = Math.floor(tt / rf); if (row >= ROWS) row = ROWS - 1;
    const inRow = (tt - row * rf) / rf;
    const ltr = row % 2 === 0;
    const x = ltr ? xL + inRow * (xR - xL) : xR - inRow * (xR - xL);
    return { x, y: rowY(row), row, ltr };
  };
  const ageToT = (age: number) => (age - start) / years;

  // The road: straight rows joined by rounded U-turns bulging into the margins.
  const roadD = (() => {
    let d = `M ${xL} ${rowY(0)}`;
    for (let i = 0; i < ROWS; i++) {
      const ltr = i % 2 === 0;
      const y = rowY(i);
      d += ` L ${ltr ? xR : xL} ${y}`;
      if (i < ROWS - 1) {
        const ny = rowY(i + 1);
        const ex = ltr ? xR : xL;
        d += ` A ${turnR} ${turnR} 0 0 ${ltr ? 1 : 0} ${ex} ${ny}`;
      }
    }
    return d;
  })();

  // Seasons → contiguous stretches of the road.
  const byKey = Object.fromEntries(arc.map((s) => [s.key, s])) as Record<Key, ArcSeason>;
  const segs = ORDER.map((key, i) => {
    const s = byKey[key];
    const from = s.ageFrom ?? Math.round(start + (years / 3) * i);
    const to   = s.ageTo   ?? Math.round(start + (years / 3) * (i + 1));
    return { ...s, key, from, to, t0: clamp01(ageToT(from)), t1: clamp01(ageToT(to)), meta: SEASON_META[key], region: i };
  });

  // Decade age ticks along the road, for a sense of real time.
  const tickStep = years > 26 ? 10 : 5;
  const ticks: number[] = [];
  for (let a = Math.ceil((start + 1) / tickStep) * tickStep; a < horizonAge; a += tickStep) ticks.push(a);

  // ── Interaction ────────────────────────────────────────────────────────────
  const [scale, setScale] = useState(0.62);
  const clampScale = (v: number) => Math.min(1.3, Math.max(0.42, v));
  const [openPin, setOpenPin] = useState<string | null>(null);
  const [adding, setAdding] = useState<Key | null>(null);
  const [addText, setAddText] = useState("");
  const submitAdd = (k: Key) => { const t = addText.trim(); if (t && onAddPursuit) onAddPursuit(k, t); setAddText(""); setAdding(null); };

  // Drag-to-pan (plus native wheel/trackpad scroll).
  const scRef = useRef<HTMLDivElement>(null);
  const pan = useRef({ active: false, x: 0, y: 0, sl: 0, st: 0, moved: false });
  useEffect(() => {
    const el = scRef.current; if (!el) return;
    const down = (e: PointerEvent) => { pan.current = { active: true, x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false }; };
    const move = (e: PointerEvent) => {
      const p = pan.current; if (!p.active) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!p.moved && Math.hypot(dx, dy) > 5) { p.moved = true; el.style.cursor = "grabbing"; }
      if (p.moved) { el.scrollLeft = p.sl - dx; el.scrollTop = p.st - dy; }
    };
    const up = () => { pan.current.active = false; el.style.cursor = "grab"; };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);
  const guard = (fn: () => void) => () => { if (!pan.current.moved) fn(); };

  const s0 = pointAt(0), s1 = pointAt(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style>{`
        @keyframes arcmap-pop { from { opacity: 0; transform: translate(-50%, -46%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        .arcmap-pin { animation: arcmap-pop 0.4s ease both; }
        .arcmap-pin:hover .arcmap-dot { transform: scale(1.12); box-shadow: 0 8px 20px -6px rgba(20,30,26,0.5); }
      `}</style>

      {/* Compact hero */}
      <div style={{ flexShrink: 0, padding: "2px 2px 12px" }}>
        {headline && (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: R.accentInk, marginBottom: 4 }}>Your retirement looks like</div>
            <div style={{ fontFamily: SERIF, fontSize: "clamp(21px, 4vw, 30px)", fontWeight: 500, color: R.ink, lineHeight: 1.12, letterSpacing: "-0.015em" }}>{headline}</div>
          </>
        )}
        <div style={{ fontSize: 12, color: R.inkFaint, marginTop: headline ? 8 : 0 }}>
          {showAges ? `Age ${start} → ${horizonAge}` : "Your retirement, start → horizon"} · a winding road through your years — tap a pin to open{onAddPursuit ? ", drop your own" : ""}
          {building && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 10, color: R.accentInk, fontWeight: 600 }}><Loader2 size={12} className="animate-spin" /> drawing the road…</span>}
        </div>
      </div>

      {/* The board viewport — scroll/drag/zoom a canvas bigger than the screen. */}
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 440, borderRadius: 20, overflow: "hidden", border: `1px solid ${R.line}`, boxShadow: "inset 0 2px 14px -8px rgba(20,30,26,0.3)" }}>
        <div ref={scRef} style={{ position: "absolute", inset: 0, overflow: "auto", cursor: "grab", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
          <div style={{ width: W * scale, height: H * scale }}>
            <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
              {/* Terrain + road */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0, display: "block" }}>
                <defs>
                  <linearGradient id="am-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eef4ef" /><stop offset="100%" stopColor="#e7ede4" />
                  </linearGradient>
                  {/* Road colored by TIME: rows descend from exit (open) to horizon (still). */}
                  <linearGradient id="am-road" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={SEASON_META.open.color} />
                    <stop offset="50%" stopColor={SEASON_META.roots.color} />
                    <stop offset="100%" stopColor={SEASON_META.still.color} />
                  </linearGradient>
                  <filter id="am-soft"><feGaussianBlur stdDeviation="24" /></filter>
                </defs>
                <rect width={W} height={H} fill="url(#am-sky)" />
                {/* soft seasonal land washes, one glow per row-band of time */}
                {segs.map((s) => {
                  const c = pointAt((s.t0 + s.t1) / 2);
                  return <ellipse key={s.key} cx={c.x} cy={c.y} rx={360} ry={190} fill={s.meta.color} opacity={0.1} filter="url(#am-soft)" />;
                })}
                {/* the road: a wide soft casing, the colored lane, and a dashed centerline */}
                <path d={roadD} fill="none" stroke="#ffffff" strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
                <path d={roadD} fill="none" stroke="url(#am-road)" strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
                <path d={roadD} fill="none" stroke="#ffffff" strokeWidth={2} strokeDasharray="1 16" strokeLinecap="round" opacity={0.9} />
              </svg>

              {/* Overlay: labels, ticks, life-event spaces, pins */}
              <div style={{ position: "absolute", inset: 0 }}>
                {/* Age ticks on the road */}
                {showAges && ticks.map((a) => {
                  const p = pointAt(ageToT(a));
                  return (
                    <div key={`tick-${a}`} style={{ position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 4 }}>
                      <div style={{ width: 3, height: 15, background: "#ffffffcc", borderRadius: 2, margin: "0 auto" }} />
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#ffffff", opacity: 0.9, marginTop: 2, textShadow: "0 1px 3px rgba(20,30,26,0.4)" }}>{a}</div>
                    </div>
                  );
                })}

                {/* Start "you are here" + horizon flag */}
                <Marker x={s0.x} y={s0.y} align="center" dy={-46}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: R.accentInk, color: "#fff", borderRadius: 99, padding: "6px 12px", fontSize: 12, fontWeight: 700, boxShadow: "0 6px 16px -6px rgba(20,30,26,0.5)", whiteSpace: "nowrap" }}>
                    <Navigation size={12} /> {showAges ? `Age ${start} · you are here` : "you are here"}
                  </span>
                </Marker>
                <Marker x={s1.x} y={s1.y} align="center" dy={46}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: R.card2, color: SEASON_META.still.color, border: `1.5px solid ${SEASON_META.still.color}`, borderRadius: 99, padding: "6px 12px", fontSize: 12, fontWeight: 700, boxShadow: "0 6px 16px -6px rgba(20,30,26,0.4)", whiteSpace: "nowrap" }}>
                    <Flag size={12} /> {showAges ? `Age ${horizonAge} · horizon` : "horizon"}
                  </span>
                </Marker>

                {/* Season names — large, faint region watermarks behind the play */}
                {segs.map((s) => {
                  const c = pointAt((s.t0 + s.t1) / 2);
                  return (
                    <div key={`seg-${s.key}`} style={{ position: "absolute", left: c.x, top: c.y, transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none", zIndex: 3 }}>
                      <div style={{ fontSize: 62, lineHeight: 1, opacity: 0.42, filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.1))" }}>{s.meta.emoji}</div>
                      <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, color: s.meta.color, opacity: 0.5, marginTop: 2, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{s.meta.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: s.meta.color, opacity: 0.6, marginTop: 2 }}>{showAges ? (s.key === "still" ? `Age ${s.from}+` : `Age ${s.from}–${s.to}`) : `Chapter ${s.region + 1}`}</div>
                      {optimizingSeason === s.key && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 11, fontWeight: 600, color: R.accentInk, opacity: 1 }}><Loader2 size={12} className="animate-spin" /> reshaping…</div>
                      )}
                    </div>
                  );
                })}

                {/* Life-event spaces ON the road */}
                {showAges && lifeEvents.map((ev, i) => {
                  const p = pointAt(ageToT(ev.age));
                  return (
                    <div key={`ev-${i}-${ev.age}`} style={{ position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)", zIndex: 16, pointerEvents: "none" }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: R.card2, border: `2px solid ${R.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, boxShadow: "0 6px 14px -6px rgba(20,30,26,0.45)" }}>{ev.icon}</div>
                      {/* label always tucked directly under the space, on a chip so it reads over the road */}
                      <div style={{ position: "absolute", left: "50%", top: "calc(100% + 4px)", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap", background: "#ffffffe8", borderRadius: 7, padding: "2px 7px 3px", boxShadow: "0 2px 6px -3px rgba(20,30,26,0.3)" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: R.ink, lineHeight: 1.15 }}>{ev.label}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: R.gold }}>Age {ev.age} · {ev.year}</div>
                      </div>
                    </div>
                  );
                })}

                {/* Pursuit pins — branch off the road within their season */}
                {segs.map((s) => s.pursuits.map((p, k) => {
                  const n = s.pursuits.length;
                  const frac = n <= 1 ? 0.5 : 0.15 + (k / (n - 1)) * 0.7;
                  const t = s.t0 + frac * (s.t1 - s.t0);
                  const pt = pointAt(t);
                  const up = k % 2 === 0;
                  const off = 84;
                  const dotY = pt.y + (up ? -off : off);
                  const kc = s.meta.color, isOpen = openPin === p.id;
                  return (
                    <div key={p.id}>
                      {/* connector */}
                      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8 }}>
                        <line x1={pt.x} y1={pt.y} x2={pt.x} y2={dotY} stroke={kc} strokeWidth={2} strokeDasharray="2 4" opacity={0.65} />
                        <circle cx={pt.x} cy={pt.y} r={4} fill={kc} />
                      </svg>
                      <div className="arcmap-pin" style={{ position: "absolute", left: pt.x, top: dotY, transform: "translate(-50%,-50%)", zIndex: isOpen ? 30 : 14 }}>
                        <button onClick={guard(() => setOpenPin(isOpen ? null : p.id))} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", width: 150 }}>
                          <span className="arcmap-dot" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: kc, border: "3px solid #fff", boxShadow: "0 5px 12px -4px rgba(20,30,26,0.5)", transition: "transform 0.15s, box-shadow 0.15s" }}>
                            <MapPin size={14} color="#fff" />
                          </span>
                          <span style={{ maxWidth: 150, fontFamily: SERIF, fontSize: 13, fontWeight: 500, color: R.ink, lineHeight: 1.2, textAlign: "center", background: "#ffffffd8", borderRadius: 8, padding: "3px 8px", boxShadow: "0 2px 6px -3px rgba(20,30,26,0.35)" }}>{p.concept}</span>
                        </button>
                        {isOpen && (
                          <div style={{ position: "absolute", left: "50%", top: "calc(100% + 8px)", transform: "translateX(-50%)", width: 236, background: R.card2, border: `1px solid ${kc}`, borderRadius: 14, boxShadow: "0 20px 44px -18px rgba(20,30,26,0.5)", padding: 14, zIndex: 40, textAlign: "left" }}>
                            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 500, color: R.ink, lineHeight: 1.25 }}>{p.concept}</div>
                            {p.microDoseAction && <div style={{ fontSize: 12, color: R.inkSoft, marginTop: 7, lineHeight: 1.5 }}>👉 {p.microDoseAction}</div>}
                            <button onClick={guard(() => setOpenPin(null))} aria-label="Close" style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: R.inkFaint, display: "flex" }}><X size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }))}

                {/* Drop-a-pin node per season (near its entrance) */}
                {onAddPursuit && segs.map((s) => {
                  const c = pointAt(clamp01(s.t0 + (s.t1 - s.t0) * 0.5));
                  const kc = s.meta.color;
                  const y = c.y + 130;
                  return (
                    <div key={`add-${s.key}`} style={{ position: "absolute", left: c.x, top: y, transform: "translate(-50%,-50%)", zIndex: 20 }}>
                      {adding === s.key ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", background: R.card2, border: `1.5px solid ${kc}`, borderRadius: 12, padding: "6px 6px 6px 12px", boxShadow: "0 14px 34px -14px rgba(20,30,26,0.5)", width: 300 }}>
                          <input autoFocus value={addText} onChange={(e) => setAddText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(s.key); if (e.key === "Escape") { setAdding(null); setAddText(""); } }}
                            placeholder={`Add to ${s.meta.name}…`}
                            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 13.5, color: R.ink }} />
                          <button onClick={() => submitAdd(s.key)} disabled={!addText.trim()} style={{ flexShrink: 0, background: addText.trim() ? kc : R.line, color: "#fff", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: addText.trim() ? "pointer" : "default" }}>Add</button>
                          <button onClick={() => { setAdding(null); setAddText(""); }} aria-label="Cancel" style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: R.inkFaint, display: "flex", padding: 3 }}><X size={15} /></button>
                        </div>
                      ) : (
                        <button onClick={guard(() => { setAdding(s.key); setAddText(""); })} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `color-mix(in oklab, ${kc} 10%, ${R.card2})`, border: `1.5px dashed color-mix(in oklab, ${kc} 55%, ${R.line})`, color: kc, borderRadius: 99, padding: "8px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, boxShadow: "0 4px 12px -6px rgba(20,30,26,0.3)" }}>
                          <Plus size={14} /> Add a pin
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Zoom controls */}
        <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 7, zIndex: 50 }}>
          <button onClick={() => setScale((v) => clampScale(v * 1.22))} aria-label="Zoom in" style={zbtn}><Plus size={16} /></button>
          <button onClick={() => setScale((v) => clampScale(v / 1.22))} aria-label="Zoom out" style={zbtn}><Minus size={16} /></button>
        </div>
      </div>

      {tail && <div style={{ flexShrink: 0, padding: "16px 2px 4px" }}>{tail}</div>}
    </div>
  );
}

/** A canvas-anchored label. `dy` nudges it above/below the anchor point. */
function Marker({ x, y, align, dy = 0, children }: { x: number; y: number; align: "left" | "right" | "center"; dy?: number; children: React.ReactNode }) {
  const tx = align === "left" ? "0" : align === "right" ? "-100%" : "-50%";
  return (
    <div style={{ position: "absolute", left: x, top: y + dy, transform: `translate(${tx}, -50%)`, zIndex: 15, pointerEvents: "none" }}>{children}</div>
  );
}

const zbtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: "50%", border: `1px solid ${R.line}`, background: R.card2, color: R.inkSoft,
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px -6px rgba(20,30,26,0.4)",
};

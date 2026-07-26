"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Minus, X, Loader2, MapPin, Flag, Navigation } from "lucide-react";
import type { ArcSeason } from "@/lib/perfectWizard";
import { R, SERIF, SEASON_META } from "./reclaimTheme";

type Key = ArcSeason["key"];

const NOMINAL_EXIT = 55;      // layout fallback when the real exit age is unknown
const W = 1760, H = 940;      // the map canvas — larger than the viewport, so you roam it
const ORDER: Key[] = ["open", "roots", "still"];

// A gentle river winding left → right across the whole territory.
const pathY = (x: number) => H * 0.5 + Math.sin((x / W) * Math.PI * 2.2 + 0.5) * (H * 0.17);

// Deterministic scatter of a land's markers around the river (SSR/resume-safe).
function pinPos(region: number, k: number, count: number) {
  const x0 = region * (W / 3) + 175, x1 = (region + 1) * (W / 3) - 145;
  const x = count <= 1 ? (x0 + x1) / 2 : x0 + (k / (count - 1)) * (x1 - x0);
  const side = k % 2 === 0 ? -1 : 1;
  const mag = 76 + (k % 3) * 52;
  const y = Math.max(150, Math.min(H - 190, pathY(x) + side * mag));
  return { x, y };
}

/**
 * The arc as a real MAP you roam: a wide landscape canvas — larger than the
 * screen — that you drag, scroll and zoom to explore. Three seasonal lands flow
 * left → right along a winding river, each strewn with your pursuits as pins you
 * tap to open. Drop a new pin anywhere and the coach reshapes the territory
 * around it.
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

  const [scale, setScale] = useState(0.78);
  const clampScale = (v: number) => Math.min(1.35, Math.max(0.5, v));
  const [openPin, setOpenPin] = useState<string | null>(null);
  const [adding, setAdding] = useState<Key | null>(null);
  const [addText, setAddText] = useState("");
  const submitAdd = (k: Key) => { const t = addText.trim(); if (t && onAddPursuit) onAddPursuit(k, t); setAddText(""); setAdding(null); };

  const byKey = Object.fromEntries(arc.map((s) => [s.key, s])) as Record<Key, ArcSeason>;
  const lands = ORDER.map((key, i) => {
    const s = byKey[key];
    const from = s.ageFrom ?? Math.round(start + (years / 3) * i);
    const to   = s.ageTo   ?? Math.round(start + (years / 3) * (i + 1));
    return { ...s, key, from, to, meta: SEASON_META[key], region: i };
  });

  // Drag-to-pan the canvas (plus native wheel/trackpad scroll).
  const scRef = useRef<HTMLDivElement>(null);
  const pan = useRef({ active: false, x: 0, y: 0, sl: 0, st: 0, moved: false });
  useEffect(() => {
    const el = scRef.current; if (!el) return;
    const down = (e: PointerEvent) => {
      // let inputs/buttons handle their own taps; still allow pan from them after a move
      pan.current = { active: true, x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false };
    };
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

  const riverD = (() => {
    let d = `M 0 ${pathY(0).toFixed(1)}`;
    for (let x = 40; x <= W; x += 40) d += ` L ${x} ${pathY(x).toFixed(1)}`;
    return d;
  })();

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
          {showAges ? `Age ${start} → ${horizonAge}` : "Your retirement, start → horizon"} · drag to roam the map, tap a pin to open{onAddPursuit ? ", drop your own" : ""}
          {building && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 10, color: R.accentInk, fontWeight: 600 }}><Loader2 size={12} className="animate-spin" /> growing the map…</span>}
        </div>
      </div>

      {/* The map viewport — scroll/drag/zoom a canvas bigger than the screen.
          minHeight keeps it from collapsing when the parent isn't height-bounded. */}
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 440, borderRadius: 20, overflow: "hidden", border: `1px solid ${R.line}`, boxShadow: "inset 0 2px 14px -8px rgba(20,30,26,0.3)" }}>
        <div ref={scRef} style={{ position: "absolute", inset: 0, overflow: "auto", cursor: "grab", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
          {/* scaled footprint so scrollbars match the zoomed canvas */}
          <div style={{ width: W * scale, height: H * scale }}>
            <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
              {/* Terrain */}
              <svg width={W} height={H} style={{ position: "absolute", inset: 0, display: "block" }}>
                <defs>
                  <linearGradient id="am-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eef4ef" /><stop offset="100%" stopColor="#e6ece3" />
                  </linearGradient>
                  <filter id="am-soft"><feGaussianBlur stdDeviation="26" /></filter>
                  <linearGradient id="am-river" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={SEASON_META.open.color} />
                    <stop offset="50%" stopColor={SEASON_META.roots.color} />
                    <stop offset="100%" stopColor={SEASON_META.still.color} />
                  </linearGradient>
                </defs>
                <rect width={W} height={H} fill="url(#am-sky)" />
                {/* land washes + contour rings per region */}
                {lands.map((s) => {
                  const cx = s.region * (W / 3) + W / 6, cy = H / 2, kc = s.meta.color;
                  return (
                    <g key={s.key}>
                      <ellipse cx={cx} cy={cy} rx={W / 6 + 40} ry={H * 0.42} fill={kc} opacity={0.12} filter="url(#am-soft)" />
                      {[0.9, 0.66, 0.42].map((f, j) => (
                        <ellipse key={j} cx={cx} cy={cy} rx={(W / 6 + 40) * f} ry={H * 0.42 * f} fill="none" stroke={kc} strokeOpacity={0.14} strokeWidth={1.5} />
                      ))}
                    </g>
                  );
                })}
                {/* region dividers */}
                {[1, 2].map((i) => (
                  <line key={i} x1={i * (W / 3)} y1={40} x2={i * (W / 3)} y2={H - 40} stroke={R.line} strokeDasharray="2 10" strokeWidth={1.5} />
                ))}
                {/* the river */}
                <path d={riverD} fill="none" stroke="url(#am-river)" strokeWidth={7} strokeLinecap="round" opacity={0.9} />
                <path d={riverD} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="2 12" opacity={0.6} />
              </svg>

              {/* Overlay: labels, pins, markers */}
              <div style={{ position: "absolute", inset: 0 }}>
                {/* Start + horizon */}
                <Marker x={20} y={pathY(20)} align="left">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: R.accentInk, color: "#fff", borderRadius: 99, padding: "5px 11px", fontSize: 12, fontWeight: 700, boxShadow: "0 6px 16px -6px rgba(20,30,26,0.5)" }}>
                    <Navigation size={12} /> {showAges ? `Age ${start} · you are here` : "you are here"}
                  </span>
                </Marker>
                <Marker x={W - 20} y={pathY(W - 20)} align="right">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: R.card2, color: SEASON_META.still.color, border: `1.5px solid ${SEASON_META.still.color}`, borderRadius: 99, padding: "5px 11px", fontSize: 12, fontWeight: 700, boxShadow: "0 6px 16px -6px rgba(20,30,26,0.4)" }}>
                    <Flag size={12} /> {showAges ? `Age ${horizonAge} · horizon` : "horizon"}
                  </span>
                </Marker>

                {/* Land banners */}
                {lands.map((s) => {
                  const cx = s.region * (W / 3) + W / 6, kc = s.meta.color;
                  return (
                    <div key={s.key} style={{ position: "absolute", left: cx, top: 54, transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none" }}>
                      <div style={{ fontSize: 40, lineHeight: 1, filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.18))" }}>{s.meta.emoji}</div>
                      <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 500, color: R.ink, marginTop: 6, letterSpacing: "-0.01em" }}>{s.meta.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: kc, marginTop: 2 }}>{showAges ? (s.key === "still" ? `${s.from}+` : `Age ${s.from}–${s.to}`) : `Chapter ${s.region + 1}`}</div>
                      {optimizingSeason === s.key && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 11, fontWeight: 600, color: R.accentInk }}><Loader2 size={12} className="animate-spin" /> reshaping…</div>
                      )}
                    </div>
                  );
                })}

                {/* Pursuit pins */}
                {lands.map((s) => s.pursuits.map((p, k) => {
                  const { x, y } = pinPos(s.region, k, s.pursuits.length);
                  const kc = s.meta.color, open = openPin === p.id;
                  return (
                    <div key={p.id} className="arcmap-pin" style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", zIndex: open ? 30 : 10 }}>
                      <button onClick={guard(() => setOpenPin(open ? null : p.id))} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", width: 150 }}>
                        <span className="arcmap-dot" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", background: kc, border: "3px solid #fff", boxShadow: "0 5px 12px -4px rgba(20,30,26,0.5)", transition: "transform 0.15s, box-shadow 0.15s" }}>
                          <MapPin size={15} color="#fff" />
                        </span>
                        <span style={{ maxWidth: 150, fontFamily: SERIF, fontSize: 13.5, fontWeight: 500, color: R.ink, lineHeight: 1.2, textAlign: "center", background: "#ffffffcf", borderRadius: 8, padding: "3px 8px", boxShadow: "0 2px 6px -3px rgba(20,30,26,0.35)" }}>{p.concept}</span>
                      </button>
                      {open && (
                        <div style={{ position: "absolute", left: "50%", top: "calc(100% + 8px)", transform: "translateX(-50%)", width: 236, background: R.card2, border: `1px solid ${kc}`, borderRadius: 14, boxShadow: "0 20px 44px -18px rgba(20,30,26,0.5)", padding: 14, zIndex: 40, textAlign: "left" }}>
                          <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 500, color: R.ink, lineHeight: 1.25 }}>{p.concept}</div>
                          {p.microDoseAction && <div style={{ fontSize: 12, color: R.inkSoft, marginTop: 7, lineHeight: 1.5 }}>👉 {p.microDoseAction}</div>}
                          <button onClick={guard(() => setOpenPin(null))} aria-label="Close" style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: R.inkFaint, display: "flex" }}><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  );
                }))}

                {/* Drop-a-marker node per land */}
                {onAddPursuit && lands.map((s) => {
                  const cx = s.region * (W / 3) + W / 6, kc = s.meta.color;
                  const y = H - 108;
                  return (
                    <div key={`add-${s.key}`} style={{ position: "absolute", left: cx, top: y, transform: "translate(-50%,-50%)", zIndex: 20 }}>
                      {adding === s.key ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", background: R.card2, border: `1.5px solid ${kc}`, borderRadius: 12, padding: "6px 6px 6px 12px", boxShadow: "0 14px 34px -14px rgba(20,30,26,0.5)", width: 300 }}>
                          <input autoFocus value={addText} onChange={(e) => setAddText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(s.key); if (e.key === "Escape") { setAdding(null); setAddText(""); } }}
                            placeholder={`Drop a pin in ${s.meta.name}…`}
                            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 13.5, color: R.ink }} />
                          <button onClick={() => submitAdd(s.key)} disabled={!addText.trim()} style={{ flexShrink: 0, background: addText.trim() ? kc : R.line, color: "#fff", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: addText.trim() ? "pointer" : "default" }}>Add</button>
                          <button onClick={() => { setAdding(null); setAddText(""); }} aria-label="Cancel" style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: R.inkFaint, display: "flex", padding: 3 }}><X size={15} /></button>
                        </div>
                      ) : (
                        <button onClick={guard(() => { setAdding(s.key); setAddText(""); })} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `color-mix(in oklab, ${kc} 10%, ${R.card2})`, border: `1.5px dashed color-mix(in oklab, ${kc} 55%, ${R.line})`, color: kc, borderRadius: 99, padding: "9px 15px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, boxShadow: "0 4px 12px -6px rgba(20,30,26,0.3)" }}>
                          <Plus size={14} /> Drop a pin
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

/** A canvas-anchored label, aligned so it doesn't run off the map edge. */
function Marker({ x, y, align, children }: { x: number; y: number; align: "left" | "right"; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(${align === "left" ? "0" : "-100%"}, -50%)`, zIndex: 15, pointerEvents: "none" }}>{children}</div>
  );
}

const zbtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: "50%", border: `1px solid ${R.line}`, background: R.card2, color: R.inkSoft,
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px -6px rgba(20,30,26,0.4)",
};

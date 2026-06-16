"use client";
import { useRef, useEffect, useState, useMemo, useCallback, Fragment } from "react";
import { HORIZON_CONFIG } from "@/config/horizonConfig";
import { C } from "@/config/colors";
import { getLifeEvents } from "@/lib/horizonUtils";
import MosaicOfMonths from "@/components/MosaicOfMonths";
import { useRetirementDate } from "@/hooks/useRetirementDate";
import type { AdventureBlueprint } from "@/types/horizon";

/* ── fixed geometry ──────────────────────────────────────────────────────── */
const W = 1000, H = 210, FLIGHT_Y = 62;
const MOSAIC_H   = 520;
const FLIGHT_PCT = (FLIGHT_Y / H) * 100;
const MAP_START  = new Date(2026, 2, 1); // Mar 2026 — fixed left edge

/* ── coordinate helpers (parameterised by mapEnd) ────────────────────────── */
function makeXOf(mapEnd: Date) {
  const totalMs = Math.max(1, mapEnd.getTime() - MAP_START.getTime());
  return (d: Date) =>
    Math.min(W, Math.max(0, ((d.getTime() - MAP_START.getTime()) / totalMs) * W));
}

/* ── terrain ─────────────────────────────────────────────────────────────── */
const MI: Record<number, number> = {
  0: 0.42, 1: 0.82, 2: 0.90, 3: 0.90, 4: 0.86,
  5: 0.36, 6: 0.28, 7: 0.72, 8: 0.88, 9: 0.85,
  10: 0.48, 11: 0.38,
};
const terrainY = (i: number) => FLIGHT_Y + 7 + (1 - i) * 76;

function buildTerrainPts(mapEnd: Date, xOf: (d: Date) => number): [number, number][] {
  const pts: [number, number][] = [];
  let d = new Date(MAP_START);
  while (d <= mapEnd) {
    pts.push([xOf(d), terrainY(MI[d.getMonth()] ?? 0.5)]);
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return pts;
}

function ptsToPath(pts: [number, number][], bottom?: number): string {
  if (!pts.length) return "";
  let p = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const mx = ((x0 + x1) / 2).toFixed(1);
    p += ` C ${mx} ${y0.toFixed(1)} ${mx} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  if (bottom !== undefined) {
    const [lx] = pts[pts.length - 1];
    p += ` L ${lx.toFixed(1)} ${bottom} L ${pts[0][0].toFixed(1)} ${bottom} Z`;
  }
  return p;
}

/* ── waypoints ───────────────────────────────────────────────────────────── */
interface Waypoint {
  x: number; label: string;
  type: "phase" | "life" | "birthday" | "anchor" | "grad" | "finish";
  color: string; important: boolean; above: boolean;
}

function buildWaypoints(mapEnd: Date, xOf: (d: Date) => number): Waypoint[] {
  const now = new Date();
  const wps: Waypoint[] = [];
  let toggle = true;
  const add = (w: Omit<Waypoint, "above">) => { wps.push({ ...w, above: toggle }); toggle = !toggle; };

  // Phase transitions
  HORIZON_CONFIG.phases.slice(1).forEach(phase => {
    const totalM = mapEnd.getFullYear() * 12 + mapEnd.getMonth() - 48 + phase.startOffset;
    const d = new Date(Math.floor(totalM / 12), totalM % 12, 1);
    if (d > now && d < mapEnd)
      add({ x: xOf(d), label: phase.label, type: "phase", color: C.teal, important: true });
  });

  // Annual anchors — dynamically cover the full map range
  for (let yr = MAP_START.getFullYear() + 1; yr <= mapEnd.getFullYear(); yr++) {
    const d = new Date(yr, 0, 1);
    if (d > now && d <= mapEnd)
      add({ x: xOf(d), label: `Jan '${String(yr).slice(2)}`, type: "anchor", color: C.inkFaint, important: false });
  }

  // Grad cycles — Mar & Sep each year
  for (let yr = MAP_START.getFullYear(); yr <= mapEnd.getFullYear(); yr++) {
    for (const [mo, tag] of [[2, "Mar Grad"], [8, "Sep Grad"]] as const) {
      const d = new Date(yr, mo, 1);
      if (d > now && d <= mapEnd)
        add({ x: xOf(d), label: tag, type: "grad", color: C.warm, important: false });
    }
  }

  // Kids' birthdays
  for (const child of HORIZON_CONFIG.children) {
    const birth = new Date(child.birthDate);
    for (let yr = now.getFullYear(); yr <= mapEnd.getFullYear(); yr++) {
      const d = new Date(yr, birth.getUTCMonth(), 1);
      if (d > now && d <= mapEnd)
        add({ x: xOf(d), label: `🎂 ${child.name}`, type: "birthday", color: C.tealLight, important: false });
    }
  }

  // Kids' life events
  for (const ev of getLifeEvents(mapEnd)) {
    const d = new Date(ev.year, ev.month, 1);
    if (d > now && d <= mapEnd)
      add({ x: xOf(d), label: `${ev.icon} ${ev.childName}`, type: "life", color: C.warm, important: true });
  }

  // Finish flag
  add({ x: W, label: "🏁 Freedom", type: "finish", color: C.teal, important: true });

  return wps.sort((a, b) => a.x - b.x);
}

/* ── phase bands ─────────────────────────────────────────────────────────── */
function buildPhaseBands(mapEnd: Date, xOf: (d: Date) => number) {
  return HORIZON_CONFIG.phases.map(phase => {
    const sm = mapEnd.getFullYear() * 12 + mapEnd.getMonth() - 48 + phase.startOffset;
    const em = mapEnd.getFullYear() * 12 + mapEnd.getMonth() - 48 + phase.endOffset;
    return {
      x1: xOf(new Date(Math.floor(sm / 12), sm % 12, 1)),
      x2: xOf(new Date(Math.floor(em / 12), em % 12, 1)),
      color: phase.color,
    };
  });
}

/* ── views ───────────────────────────────────────────────────────────────── */
interface View { id: string; label: string; sublabel: string; sx: number; tx: number; }

function buildViews(nowX: number, wps: Waypoint[], mapEnd: Date): View[] {
  const snap = (x1: number, x2: number) => ({ sx: W / Math.max(1, x2 - x1), tx: -x1 });
  const cl   = (v: number) => Math.max(-50, Math.min(W + 50, v));
  const nextImp = wps.find(w => w.x > nowX + 20 && w.important);
  const endLabel = mapEnd.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const views: View[] = [
    { id: "journey", label: "Full Journey",   sublabel: `Mar 2026 → ${endLabel}`, sx: 1, tx: 0 },
    { id: "year",    label: "The Year Ahead", sublabel: "Next 12 months",          ...snap(cl(nowX - 20), cl(nowX + 250)) },
    { id: "now",     label: "You Are Here",   sublabel: "Current altitude",        ...snap(cl(nowX - 55), cl(nowX + 70)) },
  ];
  if (nextImp) views.push({ id: "approach", label: "Approaching", sublabel: nextImp.label, ...snap(cl(nowX - 30), cl(nextImp.x + 80)) });
  return views;
}

/* ── component ───────────────────────────────────────────────────────────── */
interface Props { pinnedAdventures?: AdventureBlueprint[]; }

export default function FlightMap({ pinnedAdventures = [] }: Props) {
  // Live retirement date from financial store
  const { retirementDate: mapEnd, exitYear } = useRetirementDate();

  // xOf — recomputed whenever mapEnd changes
  const xOf = useMemo(() => makeXOf(mapEnd), [mapEnd]);
  // Keep a ref for use inside the RAF loop (avoids stale closure)
  const xOfRef = useRef(xOf);
  useEffect(() => { xOfRef.current = xOf; }, [xOf]);

  const terrainPts  = useMemo(() => buildTerrainPts(mapEnd, xOf),  [mapEnd, xOf]);
  const terrainFill = useMemo(() => ptsToPath(terrainPts, H),       [terrainPts]);
  const terrainEdge = useMemo(() => ptsToPath(terrainPts),          [terrainPts]);
  const waypoints   = useMemo(() => buildWaypoints(mapEnd, xOf),    [mapEnd, xOf]);
  const phaseBands  = useMemo(() => buildPhaseBands(mapEnd, xOf),   [mapEnd, xOf]);

  // nowX is client-only to avoid SSR hydration mismatch
  const [nowX, setNowX] = useState(0);
  useEffect(() => { setNowX(xOf(new Date())); }, [xOf]);

  const views = useMemo(() => buildViews(nowX, waypoints, mapEnd), [nowX, waypoints, mapEnd]);

  const [viewIdx,    setViewIdx]    = useState(0);
  const [showMosaic, setShowMosaic] = useState(false);

  const mapGroupRef = useRef<SVGGElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);
  const currentRef  = useRef({ sx: 1, tx: 0 });
  const targetRef   = useRef({ sx: 1, tx: 0 });

  // Reset to view 0 when mapEnd changes (exit year slider moved)
  useEffect(() => {
    setViewIdx(0);
    targetRef.current = { sx: 1, tx: 0 };
  }, [mapEnd]);

  /* RAF animation loop */
  useEffect(() => {
    let raf: number;
    const lerp = (a: number, b: number) => a + (b - a) * 0.055;
    const tick = () => {
      const t = targetRef.current, c = currentRef.current;
      c.sx = lerp(c.sx, t.sx);
      c.tx = lerp(c.tx, t.tx);
      const { sx, tx } = c;
      mapGroupRef.current?.setAttribute("transform", `scale(${sx.toFixed(5)},1) translate(${tx.toFixed(3)},0)`);
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.querySelectorAll<HTMLElement>("[data-wpx]").forEach(el => {
          const wpx = parseFloat(el.dataset.wpx!);
          const pct = (sx * (wpx + tx)) / W * 100;
          el.style.left    = `${pct.toFixed(2)}%`;
          el.style.opacity = pct > -8 && pct < 108 ? "1" : "0";
        });
        const plane = overlay.querySelector<HTMLElement>("[data-plane]");
        if (plane) plane.style.left = `${((sx * (nowX + tx)) / W * 100).toFixed(2)}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nowX]);

  /* Auto-cycle views */
  useEffect(() => {
    const id = setInterval(() => {
      setViewIdx(i => {
        const next = (i + 1) % views.length;
        targetRef.current = { sx: views[next].sx, tx: views[next].tx };
        return next;
      });
    }, 5500);
    return () => clearInterval(id);
  }, [views]);

  const switchView = (i: number) => { setViewIdx(i); targetRef.current = { sx: views[i].sx, tx: views[i].tx }; };
  const view = views[viewIdx] ?? views[0];
  const containerH = showMosaic ? MOSAIC_H : H;

  // Dynamic year labels spanning the map range
  const yearLabels = useMemo(() => {
    const labels: number[] = [];
    for (let yr = MAP_START.getFullYear() + 1; yr <= mapEnd.getFullYear(); yr++) labels.push(yr);
    return labels;
  }, [mapEnd]);

  return (
    <div style={{ background: C.bgHeader, borderBottom: `1px solid ${C.border}` }}>

      {/* ── Control bar ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "5px 16px", borderBottom: `1px solid ${C.borderSoft}`,
      }}>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <span style={{ color: C.inkFaint, fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em" }}>
            {showMosaic ? "Mosaic" : view.label}
          </span>
          <span style={{ color: C.border, fontSize: 8 }}>·</span>
          <span style={{ color: C.inkSoft, fontSize: 8 }}>
            {showMosaic ? "Monthly grid" : view.sublabel}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowMosaic(m => !m)} style={{
            fontSize: 8.5, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "3px 9px", borderRadius: 4,
            border: `1px solid ${showMosaic ? C.teal : C.border}`,
            cursor: "pointer",
            background: showMosaic ? `${C.teal}18` : "transparent",
            color: showMosaic ? C.teal : C.inkSoft,
            transition: "all 0.18s ease",
          }}>
            Mosaic
          </button>
          <div style={{ width: 1, height: 12, background: C.border }} />
          {views.map((v, i) => (
            <button key={v.id} onClick={() => switchView(i)} style={{
              width: i === viewIdx ? 16 : 5, height: 5, borderRadius: 3,
              background: i === viewIdx ? C.teal : C.borderSoft,
              border: "none", cursor: "pointer", padding: 0,
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>
      </div>

      {/* ── Map canvas ── */}
      <div style={{
        position: "relative", height: containerH,
        transition: "height 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
      }}>
        {/* Terrain SVG */}
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
             preserveAspectRatio="none"
             style={{ display: "block", position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 }}>
          <defs>
            <linearGradient id="fm-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C.teal} stopOpacity="0.28" />
              <stop offset="75%"  stopColor={C.teal} stopOpacity="0.06" />
              <stop offset="100%" stopColor={C.teal} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <g ref={mapGroupRef}>
            {phaseBands.map((b, i) => (
              <rect key={i} x={b.x1} y={0} width={b.x2 - b.x1} height={H}
                fill={b.color} fillOpacity={0.05 + i * 0.025} />
            ))}
            {phaseBands.slice(1).map((b, i) => (
              <line key={i} x1={b.x1} y1={0} x2={b.x1} y2={H}
                stroke={C.border} strokeWidth="0.6" strokeDasharray="3 5" strokeOpacity="0.55" />
            ))}
            <path d={terrainFill} fill="url(#fm-fill)" />
            <path d={terrainEdge} fill="none" stroke={C.teal} strokeWidth="0.9" strokeOpacity="0.35" />
            <line x1={0} y1={FLIGHT_Y} x2={W} y2={FLIGHT_Y}
              stroke={C.inkFaint} strokeWidth="0.7" strokeDasharray="5 7" strokeOpacity="0.45" />
            <line x1={0} y1={FLIGHT_Y} x2={nowX} y2={FLIGHT_Y}
              stroke={C.teal} strokeWidth="1.2" strokeOpacity="0.55" />
            {waypoints.map((wp, i) => {
              const imp = wp.important, len = imp ? 22 : 12;
              const y1 = wp.above ? FLIGHT_Y - 3 : FLIGHT_Y + 3;
              const y2 = wp.above ? FLIGHT_Y - len : FLIGHT_Y + len;
              return (
                <line key={i} x1={wp.x} y1={y1} x2={wp.x} y2={y2}
                  stroke={wp.color} strokeWidth={imp ? 0.9 : 0.5}
                  strokeOpacity={imp ? 0.65 : 0.3} />
              );
            })}
            <line x1={W} y1={0} x2={W} y2={H}
              stroke={C.teal} strokeWidth="1.5" strokeOpacity="0.4" />
          </g>
        </svg>

        {/* HTML overlay — circles, labels, plane */}
        <div ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, right: 0, height: H, pointerEvents: "none", zIndex: 2 }}>
          {waypoints.map((wp, i) => {
            const imp = wp.important;
            const size = imp ? 7 : 4;
            const len  = imp ? 22 : 12;
            const stemOffset = ((len + (imp ? 6 : 4)) / H) * 100;
            const topPct = wp.above ? FLIGHT_PCT - stemOffset : FLIGHT_PCT + stemOffset - 1;
            return (
              <Fragment key={i}>
                <div data-wpx={wp.x} style={{
                  position: "absolute", top: `${FLIGHT_PCT}%`,
                  transform: "translate(-50%, -50%)",
                  width: size, height: size, borderRadius: "50%",
                  background: wp.color, opacity: imp ? 0.88 : 0.5,
                }} />
                {/* Show text labels only for important waypoints (phase, life, finish).
                    Birthdays and grad cycles are too dense — dots only. */}
                {imp && wp.type !== "anchor" && (
                  <div data-wpx={wp.x} style={{
                    position: "absolute", top: `${topPct.toFixed(1)}%`,
                    transform: "translateX(-50%)", whiteSpace: "nowrap",
                    fontSize: 9, color: wp.color,
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    fontWeight: 600, letterSpacing: "0.02em", lineHeight: 1.2,
                    background: "rgba(235, 244, 240, 0.92)",
                    padding: "2px 6px", borderRadius: 4,
                    border: `1px solid ${wp.color}44`,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    transition: "opacity 0.15s ease",
                  }}>
                    {wp.label}
                  </div>
                )}
              </Fragment>
            );
          })}
          <div data-plane style={{
            position: "absolute", top: `${FLIGHT_PCT - 9}%`,
            transform: "translate(-50%, -50%)",
            fontSize: 15, lineHeight: 1,
            filter: `drop-shadow(0 1px 4px ${C.teal}99)`,
          }}>✈</div>
          {/* Dynamic year labels based on map range */}
          {yearLabels.map(yr => (
            <div key={yr} data-wpx={xOf(new Date(yr, 0, 1))} style={{
              position: "absolute", bottom: 4, transform: "translateX(-50%)",
              fontSize: 6.5, color: C.inkFaint, letterSpacing: "0.08em",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}>{yr}</div>
          ))}
        </div>

        {/* Mosaic overlay */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10,
          background: `${C.bg}f2`, backdropFilter: "blur(3px)", overflow: "hidden",
          opacity: showMosaic ? 1 : 0, pointerEvents: showMosaic ? "auto" : "none",
          transition: "opacity 0.3s ease", padding: "16px 32px 20px",
        }}>
          {showMosaic && <MosaicOfMonths pinnedAdventures={pinnedAdventures} />}
        </div>
      </div>
    </div>
  );
}

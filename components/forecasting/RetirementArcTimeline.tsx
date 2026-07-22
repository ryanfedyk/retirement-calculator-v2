"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { C } from "@/config/colors";
import type { ArcSeason, ArcSeasonKey } from "@/lib/perfectWizard";

export const SEASON_META: Record<ArcSeasonKey, { name: string; emoji: string; color: string; tint: string; blurb: string }> = {
  open:  { name: "The Open Road", emoji: "🌄", color: "#3f9e86", tint: "#ecf6f2", blurb: "Do the big things while the body's game — travel far, move, say yes to everything." },
  roots: { name: "Deep Roots",    emoji: "🌳", color: "#2d6b58", tint: "#e9f1ed", blurb: "Deepen your craft and the people around you — mastery, mentoring, community." },
  still: { name: "Still Waters",   emoji: "🌅", color: "#c4784e", tint: "#f6ede6", blurb: "Presence and what you pass on — family, giving back, and unhurried days." },
};
export const ARC_ORDER: ArcSeasonKey[] = ["open", "roots", "still"];

const NOMINAL_EXIT = 55; // used only for layout when the real age is unknown

/**
 * A zoomable life timeline for the retirement arc. The horizontal axis is the
 * years from your exit to the horizon; the three seasons are colored regions,
 * and each pursuit is a pin plotted at its place in the arc. Zoom out for the
 * whole-life shape; zoom in (or tap a season) to read the individual pins. Scrolls
 * horizontally when zoomed past the viewport. Framed as a warm progression — the
 * far end is legacy and presence, never a countdown.
 */
export default function RetirementArcTimeline({
  arc, exitAge, horizonAge = 90,
}: { arc: ArcSeason[]; exitAge: number | null; horizonAge?: number }) {
  const showAges = exitAge != null;
  const start = exitAge ?? NOMINAL_EXIT;
  const years = Math.max(9, horizonAge - start);

  const MIN_PX = 6, MAX_PX = 64, PAD = 24;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerYear, setPxPerYear] = useState(20);          // zoom level
  const pxRef = useRef(pxPerYear);
  useEffect(() => { pxRef.current = pxPerYear; }, [pxPerYear]);
  const width = Math.round(years * pxPerYear) + PAD * 2;
  const detailed = pxPerYear >= 34;                         // enough room for pin labels
  const clampPx = (v: number) => Math.min(MAX_PX, Math.max(MIN_PX, v));

  // Fit the whole arc to the current width (overview) — used on mount and by "Fit".
  const fitZoom = () => {
    const w = scrollRef.current?.clientWidth ?? 0;
    setPxPerYear(w > 0 ? Math.max(MIN_PX, Math.min(30, (w - PAD * 2) / years)) : 20);
  };
  useEffect(() => { fitZoom(); /* on mount, once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pinch-to-zoom (touch) + trackpad pinch (ctrl/⌘ + wheel), keeping the focal
  // point roughly under the fingers. Attached once; reads the live zoom via a ref.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const midX = (t: TouchList) => (t[0].clientX + t[1].clientX) / 2;
    let startDist = 0, startPx = 20, localMid = 0, startScroll = 0, pinching = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinching = true; startDist = dist(e.touches); startPx = pxRef.current;
        localMid = midX(e.touches) - el.getBoundingClientRect().left; startScroll = el.scrollLeft;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!pinching || e.touches.length !== 2) return;
      e.preventDefault();
      const np = clampPx(startPx * (dist(e.touches) / Math.max(1, startDist)));
      setPxPerYear(np);
      const ratio = np / startPx;
      const contentX = startScroll + localMid;               // px under fingers at pinch start
      const newContentX = PAD + (contentX - PAD) * ratio;    // same point after scaling
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollLeft = newContentX - localMid; });
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinching = false; };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;                  // trackpad pinch surfaces as ctrl+wheel
      e.preventDefault();
      setPxPerYear(clampPx(pxRef.current * (e.deltaY < 0 ? 1.12 : 0.89)));
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

  const seasons = useMemo(() => arc.map((s) => {
    // Fall back to equal thirds for age spans when ages are unknown.
    const from = s.ageFrom ?? Math.round(start + (years / 3) * ARC_ORDER.indexOf(s.key));
    const to   = s.ageTo   ?? Math.round(start + (years / 3) * (ARC_ORDER.indexOf(s.key) + 1));
    return { ...s, from, to, meta: SEASON_META[s.key] };
  }), [arc, start, years]);

  // Plot each pursuit at a deterministic age spread within its season.
  const pins = useMemo(() => seasons.flatMap((s) => {
    const span = Math.max(1, s.to - s.from);
    return s.pursuits.map((p, i) => ({
      p, color: s.meta.color,
      age: s.from + (span * (i + 1)) / (s.pursuits.length + 1),
    }));
  }), [seasons]);

  const xOf = (age: number) => PAD + (age - start) * pxPerYear;
  const zoom = (dir: 1 | -1) => setPxPerYear((v) => clampPx(v * (dir === 1 ? 1.4 : 1 / 1.4)));
  const focusSeason = (from: number, to: number) => {
    setPxPerYear(44);
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ left: Math.max(0, PAD + ((from + to) / 2 - start) * 44 - el.clientWidth / 2), behavior: "smooth" });
    });
  };

  const ticks = useMemo(() => {
    const stepYears = pxPerYear >= 40 ? 1 : pxPerYear >= 22 ? 5 : 10;
    const out: number[] = [];
    for (let a = Math.ceil(start / stepYears) * stepYears; a <= horizonAge; a += stepYears) out.push(a);
    return out;
  }, [start, horizonAge, pxPerYear]);

  const TRACK_H = 210;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Zoom controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, rowGap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint }}>
          {showAges ? `Age ${start} → ${horizonAge}` : "Your retirement, start → horizon"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {seasons.map((s) => (
            <button key={s.key} onClick={() => focusSeason(s.from, s.to)} title={`Zoom to ${s.meta.name}`}
              style={{ fontSize: 11, fontWeight: 700, color: s.meta.color, background: s.meta.tint, border: `1px solid ${s.meta.color}33`, borderRadius: 99, padding: "4px 10px", cursor: "pointer" }}>
              {s.meta.emoji} {s.meta.name.split(" ")[s.meta.name.split(" ").length - 1]}
            </button>
          ))}
          <button onClick={() => zoom(-1)} aria-label="Zoom out" style={btn}><Minus size={14} /></button>
          <button onClick={() => zoom(1)} aria-label="Zoom in" style={btn}><Plus size={14} /></button>
          <button onClick={fitZoom} aria-label="Fit to width" style={btn}><Maximize2 size={13} /></button>
        </div>
      </div>

      {/* The scrollable timeline — horizontal pan is native; two-finger pinch zooms */}
      <div ref={scrollRef} style={{ overflowX: "auto", overflowY: "hidden", borderRadius: 14, border: `1px solid ${C.borderSoft}`, background: C.bgCard, touchAction: "pan-x", WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}>
        <div style={{ position: "relative", width, minWidth: "100%", height: TRACK_H }}>
          {/* Season bands */}
          {seasons.map((s) => {
            const left = xOf(s.from); const w = Math.max(2, xOf(s.to) - xOf(s.from));
            return (
              <div key={s.key} onClick={() => focusSeason(s.from, s.to)} style={{
                position: "absolute", left, width: w, top: 0, bottom: 0, background: `linear-gradient(180deg, ${s.meta.tint}, ${s.meta.tint}44)`,
                borderRight: `1px dashed ${C.border}`, cursor: "pointer",
              }}>
                <div style={{ position: "sticky", left: 0, padding: "10px 12px", whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: s.meta.color }}>{s.meta.emoji} {s.meta.name}</div>
                  {showAges && <div style={{ fontSize: 10, fontWeight: 700, color: s.meta.color, opacity: 0.8 }}>{s.key === "still" ? `${s.from}+` : `${s.from}–${s.to}`}</div>}
                </div>
              </div>
            );
          })}

          {/* Baseline river */}
          <div style={{ position: "absolute", left: 0, right: 0, top: TRACK_H / 2, height: 3, background: `linear-gradient(90deg, ${SEASON_META.open.color}, ${SEASON_META.roots.color}, ${SEASON_META.still.color})`, opacity: 0.5 }} />

          {/* Pursuit pins */}
          {pins.map(({ p, age, color }, i) => {
            const x = xOf(age);
            const up = i % 2 === 0;
            const lane = (i % 3) * 30; // stagger to reduce overlap
            const chipY = up ? 26 + lane : TRACK_H - 26 - lane;
            return (
              <div key={p.id + i} style={{ position: "absolute", left: x, top: 0, bottom: 0, width: 0 }}>
                <div style={{ position: "absolute", top: chipY, left: 0, transform: "translateX(-50%)", maxWidth: detailed ? 160 : 120 }}>
                  <div title={p.concept} style={{
                    fontSize: 10, fontWeight: 700, color: C.ink, background: "#fff", border: `1px solid ${color}55`, borderLeft: `3px solid ${color}`,
                    borderRadius: 7, padding: "4px 7px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {p.concept}
                    {detailed && p.microDoseAction && (
                      <div style={{ fontSize: 9, fontWeight: 500, color: C.inkSoft, marginTop: 2, whiteSpace: "normal", lineHeight: 1.35 }}>👉 {p.microDoseAction}</div>
                    )}
                  </div>
                </div>
                {/* stalk + dot */}
                <div style={{ position: "absolute", left: 0, top: Math.min(chipY + 16, TRACK_H / 2), height: Math.abs(TRACK_H / 2 - (chipY + 16)), width: 1, background: `${color}66` }} />
                <div style={{ position: "absolute", left: -4, top: TRACK_H / 2 - 4, width: 8, height: 8, borderRadius: "50%", background: color, border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
            );
          })}

          {/* Age ticks */}
          {showAges && ticks.map((a) => (
            <div key={a} style={{ position: "absolute", left: xOf(a), bottom: 6, transform: "translateX(-50%)", fontSize: 9, color: C.inkFaint, fontVariantNumeric: "tabular-nums" }}>
              <div style={{ width: 1, height: 5, background: C.border, margin: "0 auto 2px" }} />{a}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: C.inkFaint, textAlign: "center" }}>
        Drag to pan · pinch or +/− to zoom · zoom in to read each pursuit and its first step
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8,
  border: `1px solid ${C.border}`, background: C.bgCard, color: C.inkMid, cursor: "pointer",
};

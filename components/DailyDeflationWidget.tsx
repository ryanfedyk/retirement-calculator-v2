"use client";
import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Check } from "lucide-react";
import { C } from "@/config/colors";
import { getDailyMantra, getCurrentPhase } from "@/lib/horizonUtils";
import { useRetirementDate } from "@/hooks/useRetirementDate";
import { HORIZON_CONFIG } from "@/config/horizonConfig";

const DURATION = 15 * 60;
const R = 76;
const CIRC = 2 * Math.PI * R;
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const PROTOCOL_STEPS = [
  { id: "a", label: "Close all work tabs and notifications" },
  { id: "b", label: "5 slow breaths — in for 4, out for 6" },
  { id: "c", label: "Name one thing you are leaving at work today" },
];

const PHASE_INTENTIONS: Record<number, string> = {
  1: "You are building the systems that will set you free. Each handoff today is a brick in that foundation.",
  2: "You let go of one decision today that wasn't yours to hold. That is the work.",
  3: "Your presence at home is the point. Everything else is the residue. Let the residue go.",
  4: "The glide slope is working. Walk through the door as yourself — not as your title.",
};

export default function DailyDeflationWidget() {
  const [left,    setLeft]    = useState(DURATION);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const { retirementDate } = useRetirementDate();
  const mantra   = getDailyMantra();
  const phase    = getCurrentPhase(retirementDate);
  const progress = ((DURATION - left) / DURATION) * 100;
  const offset   = CIRC - (CIRC * progress) / 100;

  useEffect(() => {
    if (running && left > 0) {
      ref.current = setInterval(() => {
        setLeft(s => {
          if (s <= 1) { setRunning(false); setComplete(true); return 0; }
          return s - 1;
        });
      }, 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running, left]);

  const reset = () => { setRunning(false); setLeft(DURATION); setComplete(false); };
  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const allChecked = PROTOCOL_STEPS.every(s => checked.has(s.id));

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6">
        <h2 style={{ color: C.ink }} className="text-2xl font-light tracking-tight mb-2">Daily Deflation</h2>
        <p style={{ color: C.inkSoft }} className="text-sm">
          15 minutes. Every evening. The protocol that keeps work at work.
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">

        {/* ── Left column: Timer + Protocol ── */}
        <div className="flex flex-col gap-5">

          {/* Timer card */}
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl border"
               style={{ background: C.bgCard, borderColor: complete ? C.tealLight : C.borderSoft,
                        boxShadow: complete ? `0 0 0 1px ${C.tealLight}` : "none" }}>
            <div className={running ? "breathe" : ""}
                 style={{ position: "relative", width: 184, height: 184, flexShrink: 0, marginBottom: 28 }}>
              <svg width="184" height="184" style={{ transform: "rotate(-90deg)", display: "block" }}>
                <circle cx="92" cy="92" r={R} stroke={C.border} strokeWidth="5" fill="none" />
                <circle cx="92" cy="92" r={R} stroke={complete ? C.teal : C.teal} strokeWidth="5" fill="none"
                        strokeDasharray={CIRC} strokeDashoffset={complete ? 0 : offset}
                        strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                {complete ? (
                  <>
                    <span style={{ fontSize: 32 }}>🌿</span>
                    <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: C.teal, marginTop: 8, fontWeight: 500 }}>Complete</p>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 34, fontWeight: 200, fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace,monospace", color: C.ink, letterSpacing: "0.04em" }}>
                      {fmt(left)}
                    </span>
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.inkSoft, marginTop: 6 }}>
                      {running ? "Decompressing" : left === DURATION ? "Ready" : "Paused"}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {!complete && (
                <button onClick={() => setRunning(r => !r)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 999, background: C.teal, color: "white", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer" }}>
                  {running ? <Pause size={13} /> : <Play size={13} />}
                  {running ? "Pause" : left === DURATION ? "Begin" : "Resume"}
                </button>
              )}
              {(left < DURATION || complete) && (
                <button onClick={reset}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 999, background: "transparent", color: C.inkSoft, fontSize: 13, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>

            {complete && (
              <p style={{ color: C.inkSoft, maxWidth: 220, textAlign: "center", marginTop: 20, fontSize: 13, lineHeight: 1.6, fontStyle: "italic" }}>
                {PHASE_INTENTIONS[phase.id]}
              </p>
            )}
          </div>

          {/* Transition Protocol */}
          <div className="p-5 rounded-2xl border" style={{ background: C.bgCard, borderColor: C.borderSoft }}>
            <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-4">Transition Protocol</p>
            <div className="space-y-3">
              {PROTOCOL_STEPS.map((step, i) => {
                const done = checked.has(step.id);
                return (
                  <button key={step.id} onClick={() => toggle(step.id)}
                          className="w-full flex items-start gap-3 text-left cursor-pointer transition-all duration-150 group"
                          style={{ background: "none", border: "none", padding: 0 }}>
                    <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                         style={{ borderColor: done ? C.teal : C.border, background: done ? C.teal : "transparent" }}>
                      {done && <Check size={10} color="white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] uppercase tracking-widest mb-0.5" style={{ color: C.inkFaint }}>Step {i + 1}</p>
                      <p className="text-sm leading-relaxed" style={{ color: done ? C.inkFaint : C.inkMid, textDecoration: done ? "line-through" : "none" }}>
                        {step.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {allChecked && (
              <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: C.borderSoft }}>
                <p style={{ color: C.teal }} className="text-[11px] uppercase tracking-widest">Protocol complete. You are ready.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: Mantra ── */}
        <div className="flex flex-col gap-5">

          {/* Today's mantra card */}
          <div className="p-7 rounded-2xl" style={{ background: C.tealWash, border: `1px solid ${C.tealLight}` }}>
            <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-4">Today&apos;s Mantra</p>
            <p style={{ color: C.ink }} className="text-lg font-light leading-relaxed italic">
              &ldquo;{mantra}&rdquo;
            </p>
            <div className="mt-5 pt-4 border-t" style={{ borderColor: C.tealLight }}>
              <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-2">
                {phase.name} intention
              </p>
              <p style={{ color: C.inkMid }} className="text-[12px] leading-relaxed">
                {PHASE_INTENTIONS[phase.id]}
              </p>
            </div>
          </div>

          {/* Mantra library */}
          <div className="flex-1 flex flex-col min-h-0">
            <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-3">The Mantra Library</p>
            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 280 }}>
              {HORIZON_CONFIG.mantras.map((m, i) => (
                <div key={i} className="p-3.5 rounded-xl border text-xs leading-relaxed transition-all duration-150"
                     style={{
                       borderColor: m === mantra ? C.tealLight  : C.borderSoft,
                       background:  m === mantra ? C.tealWash   : C.bgCard,
                       color:       m === mantra ? C.inkMid     : C.inkSoft,
                       borderLeft:  m === mantra ? `3px solid ${C.teal}` : `3px solid transparent`,
                     }}>
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

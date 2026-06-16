"use client";
import React, { useState, useCallback, useMemo } from "react";
import { Shuffle, Pin, Trash2, Sparkles } from "lucide-react";
import { C } from "@/config/colors";
import { HORIZON_CONFIG } from "@/config/horizonConfig";
import { ADVENTURE_SEEDS } from "@/data/adventureSeeds";
import { getCurrentPhase } from "@/lib/horizonUtils";
import { useRetirementDate } from "@/hooks/useRetirementDate";
import type { AdventureBlueprint, AdventureCategory, CommitmentLevel, WhenToStart } from "@/types/horizon";

const CATEGORIES: AdventureCategory[] = ["Immersive Travel", "Creative Mastery", "Endurance/Active", "Slow Living"];
const CAT_META: Record<AdventureCategory, { color: string; icon: string }> = {
  "Immersive Travel":  { color: "#2d7a66", icon: "✈️" },
  "Creative Mastery":  { color: "#7a5a9e", icon: "🎸" },
  "Endurance/Active":  { color: "#4a8a5a", icon: "🏔️" },
  "Slow Living":       { color: "#c4784e", icon: "🌿" },
};
const WHEN_META: Record<WhenToStart, { color: string; label: string }> = {
  "Now":             { color: C.teal,    label: "Start now" },
  "Phase 2+":        { color: C.warm,    label: "Phase 2+" },
  "Post-Retirement": { color: C.phase[0], label: "Post-retirement" },
};

const PHASE_WHEN_MAP: Record<number, WhenToStart[]> = {
  1: ["Now"],
  2: ["Now", "Phase 2+"],
  3: ["Now", "Phase 2+"],
  4: ["Now", "Phase 2+", "Post-Retirement"],
};

function DepthDots({ score }: { score: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-1" title={["Light", "Medium", "Deep"][score - 1] + " commitment"}>
      {[1, 2, 3].map(i => (
        <div key={i} className="w-1.5 h-1.5 rounded-full"
             style={{ backgroundColor: i <= score ? C.tealDark : C.border }} />
      ))}
    </div>
  );
}

function Pill({ label, active, onClick, dot }: { label: string; active: boolean; onClick: () => void; dot?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-[11px] px-3.5 py-1.5 rounded-full border transition-all duration-150 cursor-pointer tracking-wide"
            style={{ borderColor: active ? C.teal : C.border, color: active ? C.tealDark : C.inkSoft, background: active ? C.tealWash : "transparent" }}>
      {dot && <span className="text-[10px]">{dot}</span>}
      {label}
    </button>
  );
}

interface Props {
  saved: AdventureBlueprint[];
  setSaved: React.Dispatch<React.SetStateAction<AdventureBlueprint[]>>;
}

export default function AdventureGenerator({ saved, setSaved }: Props) {
  const { retirementDate } = useRetirementDate();
  const currentPhase = getCurrentPhase(retirementDate);
  const [cat,    setCat]    = useState<AdventureCategory | "All">("All");
  const [comm,   setComm]   = useState<CommitmentLevel | "All">("All");
  const [when,   setWhen]   = useState<WhenToStart | "All">("All");
  const [card,   setCard]   = useState<AdventureBlueprint | null>(null);
  const [phaseBoost, setPhaseBoost] = useState(true);

  const pool = useMemo(() => ADVENTURE_SEEDS.filter(a =>
    (cat  === "All" || a.category   === cat)  &&
    (comm === "All" || a.commitment === comm) &&
    (when === "All" || a.whenToStart === when)
  ), [cat, comm, when]);

  const generate = useCallback(() => {
    if (!pool.length) return;
    // Phase-boost: weight seeds matching the current phase's "when" 3×
    const validNow = PHASE_WHEN_MAP[currentPhase.id];
    const weighted = phaseBoost
      ? pool.flatMap(a => validNow.includes(a.whenToStart) ? [a, a, a] : [a])
      : pool;
    const next = weighted[Math.floor(Math.random() * weighted.length)];
    setCard(next);
  }, [pool, phaseBoost, currentPhase.id]);

  const pin   = (bp: AdventureBlueprint) => setSaved(p => p.find(s => s.id === bp.id) ? p : [...p, bp]);
  const unpin = (id: string)             => setSaved(p => p.filter(s => s.id !== id));

  const isPhaseAligned = (a: AdventureBlueprint) => PHASE_WHEN_MAP[currentPhase.id].includes(a.whenToStart);

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-8">
        <h2 style={{ color: C.ink }} className="text-2xl font-light tracking-tight mb-2">Adventure Generator</h2>
        <p style={{ color: C.inkSoft }} className="text-sm">
          Prototype the life waiting on the other side. Filter, generate, and pin blueprints to your ledger.
        </p>
      </div>

      {/* ── Phase context strip ── */}
      <div className="mb-8 p-4 rounded-xl flex items-center justify-between gap-4 flex-wrap"
           style={{ background: C.tealWash, border: `1px solid ${C.tealLight}` }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full pulse-calm" style={{ backgroundColor: C.teal }} />
          <p style={{ color: C.inkMid }} className="text-sm">
            You&apos;re in <span style={{ color: C.ink }} className="font-semibold">{currentPhase.name}</span> —
            adventures marked <span style={{ color: C.teal }} className="font-medium">Start now</span> are accessible today.
          </p>
        </div>
        <button
          onClick={() => setPhaseBoost(b => !b)}
          className="flex items-center gap-1.5 text-[11px] px-3.5 py-1.5 rounded-full border transition-all duration-150 cursor-pointer tracking-wide shrink-0"
          style={{ borderColor: phaseBoost ? C.teal : C.border, color: phaseBoost ? C.tealDark : C.inkSoft, background: phaseBoost ? C.tealWash : "transparent" }}>
          <Sparkles size={10} /> Phase-boost {phaseBoost ? "on" : "off"}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3 mb-8">
        <div className="flex flex-wrap gap-2 items-center">
          <span style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest w-20 shrink-0">Category</span>
          <Pill label="All" active={cat === "All"} onClick={() => setCat("All")} />
          {CATEGORIES.map(c => (
            <Pill key={c} label={c} active={cat === c} onClick={() => setCat(c)} dot={CAT_META[c].icon} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest w-20 shrink-0">Scale</span>
          <Pill label="Any"            active={comm === "All"}             onClick={() => setComm("All")} />
          <Pill label="Micro-Prototype" active={comm === "Micro-Prototype"} onClick={() => setComm("Micro-Prototype")} />
          <Pill label="Macro-Adventure" active={comm === "Macro-Adventure"} onClick={() => setComm("Macro-Adventure")} />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest w-20 shrink-0">When</span>
          <Pill label="Any"             active={when === "All"}              onClick={() => setWhen("All")} />
          <Pill label="Start now"       active={when === "Now"}              onClick={() => setWhen("Now")} />
          <Pill label="Phase 2+"        active={when === "Phase 2+"}         onClick={() => setWhen("Phase 2+")} />
          <Pill label="Post-retirement" active={when === "Post-Retirement"}  onClick={() => setWhen("Post-Retirement")} />
        </div>
      </div>

      {/* ── Generate button ── */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={generate} disabled={pool.length === 0}
                className="flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{ background: pool.length ? C.teal : C.border, color: "white", border: "none", opacity: pool.length ? 1 : 0.5 }}>
          <Shuffle size={14} /> Generate Adventure
        </button>
        <p style={{ color: C.inkFaint }} className="text-[11px]">
          {pool.length} blueprint{pool.length !== 1 ? "s" : ""} in pool
        </p>
      </div>

      {/* ── Blueprint card ── */}
      {card && (
        <div className="p-7 rounded-2xl border mb-10 transition-all duration-300"
             style={{ background: C.bgCard, borderColor: isPhaseAligned(card) ? C.tealLight : C.borderSoft,
                      boxShadow: isPhaseAligned(card) ? "0 2px 24px 0 rgba(58,158,135,0.1)" : "0 2px 12px 0 rgba(0,0,0,0.04)" }}>

          {/* Card header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                {/* Category badge */}
                <span className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full"
                      style={{ background: `${CAT_META[card.category].color}18`, color: CAT_META[card.category].color }}>
                  {CAT_META[card.category].icon} {card.category}
                </span>
                {/* When badge */}
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full"
                      style={{ background: `${WHEN_META[card.whenToStart].color}18`, color: WHEN_META[card.whenToStart].color }}>
                  {WHEN_META[card.whenToStart].label}
                </span>
                {/* Depth */}
                <DepthDots score={card.depthScore} />
                {/* Scale */}
                <span style={{ color: C.inkFaint }} className="text-[10px]">{card.commitment}</span>
              </div>
              <h3 style={{ color: C.ink }} className="text-xl font-medium leading-snug">{card.concept}</h3>
            </div>
            <button onClick={() => pin(card)}
                    className="flex items-center gap-1.5 text-[11px] px-4 py-2 rounded-full border transition-all duration-150 cursor-pointer shrink-0"
                    style={{ borderColor: saved.find(s => s.id === card.id) ? C.teal : C.border,
                             color:       saved.find(s => s.id === card.id) ? C.teal : C.inkSoft,
                             background:  saved.find(s => s.id === card.id) ? C.tealWash : "transparent" }}>
              <Pin size={11} /> {saved.find(s => s.id === card.id) ? "Pinned" : "Pin"}
            </button>
          </div>

          {/* Phase alignment callout */}
          {isPhaseAligned(card) && (
            <div className="mb-5 flex items-center gap-2 py-2.5 px-4 rounded-xl"
                 style={{ background: C.tealWash, border: `1px solid ${C.tealLight}` }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: C.teal }} />
              <p style={{ color: C.tealDark }} className="text-[11px]">
                Aligned with your current phase — you can start this now.
              </p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-2">The Why Factor</p>
              <p style={{ color: C.inkMid }} className="text-sm leading-relaxed">{card.whyFactor}</p>
            </div>
            <div className="p-5 rounded-xl" style={{ background: C.tealWash, border: `1px solid ${C.tealLight}` }}>
              <p style={{ color: C.tealDark }} className="text-[10px] uppercase tracking-widest mb-2">This Weekend →</p>
              <p style={{ color: C.ink }} className="text-sm leading-relaxed font-medium">{card.microDoseAction}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Horizon Ledger ── */}
      {saved.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest">
              Horizon Ledger
            </p>
            <p style={{ color: C.inkFaint }} className="text-[11px]">{saved.length} pinned</p>
          </div>

          {/* Group by category */}
          {CATEGORIES.filter(c => saved.some(s => s.category === c)).map(c => (
            <div key={c} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px]">{CAT_META[c].icon}</span>
                <span style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest">{c}</span>
              </div>
              <div className="space-y-2">
                {saved.filter(s => s.category === c).map(bp => (
                  <div key={bp.id} className="flex items-start gap-4 p-4 rounded-xl border group"
                       style={{ background: C.bgCard, borderColor: C.borderSoft }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p style={{ color: C.ink }} className="text-sm font-medium">{bp.concept}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                              style={{ background: `${WHEN_META[bp.whenToStart].color}18`, color: WHEN_META[bp.whenToStart].color }}>
                          {WHEN_META[bp.whenToStart].label}
                        </span>
                      </div>
                      <p style={{ color: C.inkFaint }} className="text-[11px] leading-relaxed">{bp.microDoseAction}</p>
                    </div>
                    <button onClick={() => unpin(bp.id)} className="shrink-0 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                            style={{ color: C.border, background: "none", border: "none" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#e53e3e"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.border; }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!card && saved.length === 0 && (
        <div className="text-center py-20">
          <Shuffle size={28} className="mx-auto mb-4" style={{ color: C.border, opacity: 0.4 }} />
          <p style={{ color: C.inkFaint }} className="text-sm mb-2">Hit Generate to surface your first blueprint.</p>
          <p style={{ color: C.inkFaint }} className="text-[11px]">
            {pool.length} adventures in pool · {ADVENTURE_SEEDS.filter(a => isPhaseAligned(a)).length} phase-aligned
          </p>
        </div>
      )}

      {pool.length === 0 && (
        <div className="text-center py-12 rounded-2xl border" style={{ borderColor: C.borderSoft }}>
          <p style={{ color: C.inkFaint }} className="text-sm">No adventures match the current filters.</p>
          <button onClick={() => { setCat("All"); setComm("All"); setWhen("All"); }}
                  className="mt-3 text-[11px] cursor-pointer underline"
                  style={{ color: C.teal, background: "none", border: "none" }}>
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}

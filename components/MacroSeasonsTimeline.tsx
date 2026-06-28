"use client";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { C } from "@/config/colors";
import { useMacroSeasons } from "@/hooks/useMacroSeasons";

export default function MacroSeasonsTimeline() {
  const { seasons, currentIndex, source } = useMacroSeasons();
  const current = seasons[currentIndex];
  const [expanded, setExpanded] = useState<number>(current?.id ?? 0);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Keep the expanded card in sync when the timeline changes shape.
  useEffect(() => { setExpanded(current?.id ?? 0); }, [current?.id]);

  // Expand a season's card and smooth-scroll it into view.
  const goToSeason = (id: number) => {
    setExpanded(id);
    requestAnimationFrame(() =>
      cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  };

  if (!seasons.length || !current) return null;

  // ── Time within the current season (month granularity) ────────────────────
  const now       = new Date();
  const nowYear   = now.getFullYear();
  const nowMonth  = now.getMonth();
  const seasonMonths = Math.max(1, (current.endYear - current.startYear) * 12);
  const monthsIn  = Math.max(0, (nowYear - current.startYear) * 12 + nowMonth);
  const next      = seasons[currentIndex + 1];
  const monthsUntilNext = next
    ? Math.max(0, (next.startYear - nowYear) * 12 - nowMonth)
    : 0;
  const phaseProgress = current.type === "retired"
    ? 100
    : Math.min(100, Math.round((monthsIn / seasonMonths) * 100));

  const lastYear = seasons[seasons.length - 1].startYear;

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h2 style={{ color: C.ink }} className="text-2xl font-light tracking-tight">
            Macro-Seasons
          </h2>
          {source === "gemini" && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: C.tealWash, color: C.tealDark }}>
              <Sparkles size={10} /> AI-mapped
            </span>
          )}
        </div>
        <p style={{ color: C.inkSoft }} className="text-sm">
          {seasons.length} seasons from {seasons[0].startYear} to {lastYear} — your full glide path
          from peak intensity to freedom, mapped to your retirement model.
        </p>
      </div>

      {/* ── Phase Roadmap Bar ── */}
      <div className="mb-10 p-6 rounded-2xl border" style={{ background: C.bgCard, borderColor: C.borderSoft }}>
        <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-4">
          The Roadmap
        </p>

        {/* Segmented bar — scrolls horizontally when there are many seasons */}
        <div className="flex rounded-xl h-9 mb-3" style={{ gap: 2, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none" }}>
          {seasons.map((s, i) => {
            const isActive = i === currentIndex;
            const isPast   = i < currentIndex;
            return (
              <div
                key={s.id}
                className="relative flex items-center justify-center cursor-pointer transition-all duration-200"
                style={{
                  flex: "1 0 78px", minWidth: 78,
                  borderRadius: i === 0 ? "10px 0 0 10px" : i === seasons.length - 1 ? "0 10px 10px 0" : 0,
                  backgroundColor: isPast ? `${s.color}55` : isActive ? s.color : `${s.color}33`,
                  borderBottom: isActive ? `3px solid ${s.color}` : "none",
                }}
                onClick={() => goToSeason(s.id)}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1"
                      style={{ color: isPast ? C.inkFaint : isActive ? "white" : C.inkFaint, whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Phase labels row — same horizontal rhythm */}
        <div className="flex" style={{ gap: 2, overflowX: "auto", scrollbarWidth: "none" }}>
          {seasons.map((s, i) => (
            <button key={s.id} onClick={() => goToSeason(s.id)}
                    className="text-center cursor-pointer" style={{ flex: "1 0 78px", minWidth: 78 }}>
              <p className="text-[10px] truncate px-1" style={{ color: i === currentIndex ? s.color : C.inkFaint }}>
                {s.name}
              </p>
            </button>
          ))}
        </div>

        {/* Taper curve — SVG line + HTML dot overlay (dots stay perfectly round) */}
        <div className="mt-6">
          <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-3">
            Intensity Taper
          </p>
          <div className="relative" style={{ height: 64 }}>
            <svg width="100%" height="64" preserveAspectRatio="none" viewBox="0 0 400 64" style={{ display: "block" }}>
              <defs>
                <linearGradient id="taperGrad" x1="0" y1="0" x2="1" y2="0">
                  {seasons.map((s, i) => (
                    <stop key={i} offset={`${seasons.length > 1 ? (i / (seasons.length - 1)) * 100 : 50}%`}
                          stopColor={s.color} stopOpacity="0.22" />
                  ))}
                </linearGradient>
              </defs>
              {(() => {
                const n = seasons.length;
                const xAt = (i: number) => (n > 1 ? (i / (n - 1)) * 400 : 200);
                const yAt = (v: number) => 64 - (v / 100) * 60 - 2;
                const pts = seasons.map((s, i) => `${xAt(i)},${yAt(s.intensity)}`).join(" ");
                const area = `M ${xAt(0)} ${yAt(seasons[0].intensity)} ` +
                  seasons.map((s, i) => `L ${xAt(i)} ${yAt(s.intensity)}`).join(" ") +
                  ` L ${xAt(n - 1)} 64 L ${xAt(0)} 64 Z`;
                return (
                  <>
                    <path d={area} fill="url(#taperGrad)" />
                    <polyline points={pts} fill="none" stroke={C.teal} strokeWidth="2"
                      strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </>
                );
              })()}
            </svg>

            {/* Dots as HTML — fixed pixel size, so always circular */}
            {seasons.map((s, i) => {
              const n = seasons.length;
              const leftPct = n > 1 ? (i / (n - 1)) * 100 : 50;
              const topPx   = 64 - (s.intensity / 100) * 60 - 2;
              const isActive = i === currentIndex;
              return (
                <div key={s.id}
                  title={`${s.name} · ${s.intensity}%`}
                  style={{
                    position: "absolute", left: `${leftPct}%`, top: topPx,
                    width: 9, height: 9, borderRadius: "50%",
                    background: isActive ? C.teal : "white",
                    border: `2px solid ${isActive ? C.teal : s.color}`,
                    transform: "translate(-50%, -50%)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                  }}
                />
              );
            })}

            {/* Y-axis labels */}
            <div className="absolute top-0 left-0 flex flex-col justify-between h-full" style={{ pointerEvents: "none" }}>
              <span className="text-[9px]" style={{ color: C.inkFaint }}>100%</span>
              <span className="text-[9px]" style={{ color: C.inkFaint }}>50%</span>
              <span className="text-[9px]" style={{ color: C.inkFaint }}>0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Season Cards — expandable (the current season opens by default and
          carries the "you are here" detail, so there's no separate callout) ── */}
      <div className="space-y-3">
        {seasons.map((s, i) => {
          const isActive   = i === currentIndex;
          const isPast     = i < currentIndex;
          const isExpanded = expanded === s.id;
          const color      = s.color;

          return (
            <div
              key={s.id}
              ref={(el) => { cardRefs.current[s.id] = el; }}
              className="rounded-2xl border transition-all duration-300 overflow-hidden"
              style={{
                scrollMarginTop: 80,
                background:  isExpanded ? C.bgCard : "transparent",
                borderColor: C.borderSoft,
                opacity:     isPast && !isExpanded ? 0.45 : 1,
                boxShadow:   isExpanded && isActive ? "0 2px 20px 0 rgba(58,158,135,0.1)" : "none",
              }}
            >
              <button
                className="w-full text-left p-5 flex items-center justify-between gap-4 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? -1 : s.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
                      <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${color}22`, color }}>
                        {s.label}
                      </span>
                      {isActive && (
                        <span style={{ color: C.teal }} className="text-[10px] uppercase tracking-widest font-medium">
                          ← You are here
                        </span>
                      )}
                    </div>
                    <h3 style={{ color: C.ink }} className="text-base font-medium">{s.name}</h3>
                    {!isExpanded && (
                      <p style={{ color: C.inkSoft }} className="text-xs italic truncate">{s.tagline}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p style={{ color }} className="text-lg font-extralight tabular-nums">{s.intensity}%</p>
                    <div className="w-16 h-0.5 rounded-full mt-1 ml-auto" style={{ background: C.border }}>
                      <div className="h-full rounded-full" style={{ width: `${s.intensity}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  <div style={{ color: C.inkFaint }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-6 border-t" style={{ borderColor: C.borderSoft }}>
                  <p style={{ color: C.inkSoft }} className="text-sm italic mt-4 mb-5">{s.tagline}</p>

                  <div className="mb-5 p-4 rounded-xl flex items-start gap-3"
                       style={{ background: `${color}12`, border: `1px solid ${color}33` }}>
                    <div className="w-1 rounded-full shrink-0 mt-0.5" style={{ background: color, alignSelf: "stretch", minHeight: 16 }} />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color }}>This Season's Focus</p>
                      <p style={{ color: C.ink }} className="text-sm font-medium leading-relaxed">{s.focus}</p>
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {s.actions.map((action, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm" style={{ color: C.inkMid }}>
                        <span className="shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-semibold mt-0.5"
                              style={{ borderColor: color, color }}>
                          {j + 1}
                        </span>
                        {action}
                      </li>
                    ))}
                  </ul>

                  {/* Permission — the "you are here" line, now folded into the card. */}
                  <div className="mt-5 flex items-start gap-2 p-3 rounded-xl" style={{ background: `${color}10`, border: `1px solid ${color}33` }}>
                    <div className="w-1 rounded-full shrink-0" style={{ background: color, alignSelf: "stretch", minHeight: 18 }} />
                    <p style={{ color: C.inkMid }} className="text-sm leading-relaxed">
                      <span style={{ color }} className="font-semibold">Permission: </span>{s.permission}
                    </p>
                  </div>

                  {/* For the season you're in, the live "where am I" stats. */}
                  {isActive && (
                    <div className="mt-4 flex gap-6 flex-wrap">
                      <div>
                        <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-1">Months in</p>
                        <p style={{ color: C.ink }} className="text-2xl font-extralight tabular-nums">{monthsIn}</p>
                        <div className="w-16 h-0.5 rounded-full mt-1.5" style={{ background: C.border }}>
                          <div className="h-full rounded-full" style={{ width: `${phaseProgress}%`, background: color }} />
                        </div>
                      </div>
                      {next && (
                        <div>
                          <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-1">Next season in</p>
                          <p style={{ color: C.ink }} className="text-2xl font-extralight tabular-nums">{monthsUntilNext}<span className="text-sm"> mo</span></p>
                        </div>
                      )}
                      <div>
                        <p style={{ color: C.inkFaint }} className="text-[10px] uppercase tracking-widest mb-1">Throttle</p>
                        <p style={{ color }} className="text-2xl font-extralight tabular-nums">{current.intensity}%</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

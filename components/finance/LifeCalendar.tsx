"use client";
import { useState } from "react";
import { Info, Calendar, Briefcase, Home, Star } from "lucide-react";
import type { TrajectoryPoint, SimulationConfiguration } from "@/engine/calculator";
import { C } from "@/config/colors";

interface Props {
  data:   TrajectoryPoint[];
  config: SimulationConfiguration;
}

const PHASE_COLORS: Record<string, string> = {
  GOOGLE:     "#3a9e87",  // C.teal
  SABBATICAL: "#c4784e",  // C.warm
  JUMP:       "#4aab92",  // lighter teal
  BRIDGE:     "#2a7a68",  // C.tealDark
  RETIRED:    "#a6d4c8",  // C.tealLight
};

const PHASE_LABELS: Record<string, string> = {
  GOOGLE: "Career", SABBATICAL: "Sab.", JUMP: "Jump",
  BRIDGE: "Bridge", RETIRED: "Ret.",
};

const MONTHS = ["J","F","M","A","M","J","J","A","S","O","N","D"] as const;
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

export default function LifeCalendar({ data, config }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Group by year
  const yearsMap = new Map<number, TrajectoryPoint[]>();
  data.forEach(pt => {
    const parts = pt.date.split(" ");
    if (parts.length === 2) {
      const yr = parseInt(parts[1]);
      if (!yearsMap.has(yr)) yearsMap.set(yr, []);
      yearsMap.get(yr)!.push(pt);
    }
  });
  const years = Array.from(yearsMap.keys()).sort();

  // Build event map
  const monthEventsMap = new Map<number, string[]>();
  data.forEach((pt, i) => {
    const events: string[] = [];
    const [monthStr, yearStr] = pt.date.split(" ");
    const ptYear = parseInt(yearStr);

    if (monthStr === "Jan") {
      config.life_events?.forEach(e => {
        const isCollege = e.name.toLowerCase().includes("college");
        const isHit = isCollege ? (ptYear >= e.year && ptYear < e.year + 4) : ptYear === e.year;
        if (isHit) {
          events.push(`${e.name}${isCollege ? ` (Yr ${ptYear - e.year + 1}/4)` : ""}`);
        }
      });
    }
    if (i > 0 && data[i-1].currentPhase !== pt.currentPhase) {
      events.push(`→ ${pt.currentPhase}`);
    }
    if (i > 0 && !data[i-1].isIndependent && pt.isIndependent) {
      events.push("FIRE Target Achieved");
    }
    if (pt.socialSecurityIncome > 0 && (i === 0 || data[i-1].socialSecurityIncome === 0)) {
      events.push("Social Security Starts");
    }
    if (pt.date === "Jun 2051") events.push("Mortgage Paid Off");
    if (events.length > 0) monthEventsMap.set(pt.monthIndex, events);
  });

  const hoveredPoint  = hoveredIndex !== null ? data.find(d => d.monthIndex === hoveredIndex) : null;
  const hoveredEvents = hoveredIndex !== null ? monthEventsMap.get(hoveredIndex) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "8px 0" }}>
      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 10, flexShrink: 0 }}>
        {Object.entries(PHASE_COLORS).map(([phase, color]) => (
          <div key={phase} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: C.inkFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            {PHASE_LABELS[phase]}
          </div>
        ))}
      </div>

      {/* Grid + hover panel */}
      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
        {/* Scrollable grid */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "2.5rem repeat(12, minmax(0, 1fr))", gap: 3, marginBottom: 4 }}>
            <div />
            {MONTHS.map((m, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: C.inkFaint }}>{m}</div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {years.map(year => {
              const months = yearsMap.get(year) || [];
              return (
                <div key={year} style={{ display: "grid", gridTemplateColumns: "2.5rem repeat(12, minmax(0, 1fr))", gap: 3, alignItems: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textAlign: "right", paddingRight: 6, fontVariantNumeric: "tabular-nums" }}>
                    {year}
                  </div>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const pt = months.find(m => m.date.startsWith(MONTH_NAMES[i]));
                    if (!pt) return (
                      <div key={i} style={{ width: "100%", paddingBottom: "100%", background: C.borderSoft, borderRadius: 2 }} />
                    );
                    const color = PHASE_COLORS[pt.currentPhase] ?? C.borderSoft;
                    const hasEvents = monthEventsMap.has(pt.monthIndex);
                    const isHovered = hoveredIndex === pt.monthIndex;
                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredIndex(pt.monthIndex)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        style={{
                          width: "100%",
                          paddingBottom: "100%",
                          position: "relative",
                          borderRadius: 2,
                          background: color,
                          cursor: "pointer",
                          outline: pt.isIndependent ? `1px solid rgba(255,255,255,0.5)` : "none",
                          transform: isHovered ? "scale(1.3)" : "scale(1)",
                          transition: "transform 0.1s",
                          zIndex: isHovered ? 10 : 1,
                        }}
                        title={`${pt.date} — ${pt.currentPhase}`}
                      >
                        {hasEvents && (
                          <div style={{
                            position: "absolute", top: "50%", left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.9)",
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hover detail panel */}
        <div style={{
          width: 220, flexShrink: 0, background: C.bgCard, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "14px 16px", alignSelf: "flex-start",
          position: "sticky", top: 0, minHeight: 260,
        }}>
          {hoveredPoint ? (
            <div>
              {/* Date + phase */}
              <div style={{ paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${C.borderSoft}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Calendar size={12} color={C.teal} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{hoveredPoint.date}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 2, background: PHASE_COLORS[hoveredPoint.currentPhase] }} />
                  <span style={{ fontSize: 10, color: C.inkSoft }}>{hoveredPoint.currentPhase}</span>
                  {hoveredPoint.isIndependent && (
                    <span style={{ fontSize: 8, background: C.tealWash, color: C.teal, padding: "1px 5px", borderRadius: 99, fontWeight: 700, marginLeft: 4 }}>FI ✓</span>
                  )}
                </div>
              </div>

              {/* Events */}
              {hoveredEvents?.length ? (
                <div style={{ background: C.tealWash, border: `1px solid ${C.tealLight}`, borderRadius: 6, padding: "7px 10px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 8, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                    <Star size={8} fill={C.teal} /> Key events
                  </div>
                  {hoveredEvents.map((e, i) => (
                    <div key={i} style={{ fontSize: 10, color: C.inkMid, display: "flex", gap: 5, marginBottom: 2 }}>
                      <span style={{ color: C.teal }}>·</span> {e}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Total wealth */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: C.inkFaint, letterSpacing: "0.08em", marginBottom: 2 }}>Total Wealth</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: C.ink }}>
                  ${Math.round(hoveredPoint.totalNetWorth).toLocaleString()}
                </div>
              </div>

              {/* Sub-breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px", marginBottom: 10 }}>
                {[
                  ["Liquid",      hoveredPoint.liquidCash],
                  ["Retirement",  hoveredPoint.retirement],
                  ["Employer Stock", hoveredPoint.googValue],
                  ["Target NW",   hoveredPoint.swrTarget],
                ].map(([label, val]) => (
                  <div key={label as string}>
                    <div style={{ fontSize: 8, color: C.inkFaint, marginBottom: 1 }}>{label}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
                      ${((val as number) / 1000).toFixed(0)}k
                    </div>
                  </div>
                ))}
              </div>

              {/* Flows */}
              <div style={{ paddingTop: 8, borderTop: `1px solid ${C.borderSoft}` }}>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: C.inkFaint, letterSpacing: "0.08em", marginBottom: 6 }}>Flows (Ann.)</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
                  <span style={{ color: C.inkSoft, display: "flex", alignItems: "center", gap: 4 }}>
                    <Briefcase size={9} /> Income
                  </span>
                  <span style={{ fontWeight: 600, color: C.teal }}>+${(hoveredPoint.totalCompensation / 1000).toFixed(0)}k</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                  <span style={{ color: C.inkSoft, display: "flex", alignItems: "center", gap: 4 }}>
                    <Home size={9} /> Expense
                  </span>
                  <span style={{ fontWeight: 600, color: C.warm }}>
                    −${((hoveredPoint.lifestyleExpense + hoveredPoint.healthcareCost + hoveredPoint.mortgagePayment) / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, color: C.inkFaint, textAlign: "center" }}>
              <Info size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p style={{ fontSize: 10, lineHeight: 1.5 }}>Hover a cell to see monthly details</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .fin-grid-scroll::-webkit-scrollbar { width: 5px; }
        .fin-grid-scroll::-webkit-scrollbar-track { background: ${C.bg}; border-radius: 4px; }
        .fin-grid-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      `}</style>
    </div>
  );
}

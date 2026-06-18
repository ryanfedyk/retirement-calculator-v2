"use client";
import { useState } from "react";
import { CalendarPlus, X, Trash2, Plus } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";

/**
 * Floating action button for entering Life Events (config.life_events).
 * Events appear on the forecasting flight map and the financial trajectory,
 * making the forecast reflect the user's real plans (weddings, home purchases,
 * sabbaticals, big trips, etc.).
 */
export default function LifeEventsFab({ bottomOffset = 24 }: { bottomOffset?: number }) {
  const events = useFinancialStore((s) => s.config.life_events) ?? [];
  const updateNestedConfig = useFinancialStore((s) => s.updateNestedConfig);

  const thisYear = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState<string>(String(thisYear + 1));
  const [cost, setCost] = useState<string>("");

  const add = () => {
    if (!name.trim()) return;
    const next = [
      ...events,
      { name: name.trim(), year: Number(year) || thisYear, cost: Math.max(0, Number(cost) || 0) },
    ].sort((a, b) => a.year - b.year);
    updateNestedConfig("life_events", next as typeof events);
    setName("");
    setYear(String(thisYear + 1));
    setCost("");
  };

  const remove = (idx: number) => {
    const next = [...events];
    next.splice(idx, 1);
    updateNestedConfig("life_events", next as typeof events);
  };

  const input: React.CSSProperties = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "9px 11px", fontSize: 13, color: C.ink, outline: "none", width: "100%",
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Add life event"
        style={{
          position: "fixed", right: 24, bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 60, width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
          background: C.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 6px 20px ${C.teal}66`,
        }}
      >
        <CalendarPlus size={24} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 70, background: "rgba(26,46,37,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto",
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 18,
              boxShadow: `0 20px 60px rgba(26,46,37,0.3)`, padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: C.ink, margin: 0 }}>Life Events</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, display: "flex" }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 16px" }}>
              Big planned costs — they show up on your forecast timeline.
            </p>

            {/* Existing events */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {events.length === 0 && (
                <div style={{ fontSize: 13, color: C.inkFaint, textAlign: "center", padding: "12px 0" }}>
                  No life events yet.
                </div>
              )}
              {events.map((ev, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{ev.name}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{ev.year} · ${ev.cost.toLocaleString()}</div>
                  </div>
                  <button onClick={() => remove(idx)} aria-label="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, display: "flex" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add form */}
            <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={input} placeholder="Event name (e.g. Buy a house)" value={name}
                     onChange={(e) => setName(e.target.value)} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input style={input} type="number" inputMode="numeric" placeholder="Year" value={year}
                       onChange={(e) => setYear(e.target.value)} />
                <input style={input} type="number" inputMode="numeric" placeholder="Cost $" value={cost}
                       onChange={(e) => setCost(e.target.value)} />
              </div>
              <button
                onClick={add}
                disabled={!name.trim()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: C.teal, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0",
                  fontSize: 14, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed",
                  opacity: name.trim() ? 1 : 0.5,
                }}
              >
                <Plus size={16} /> Add event
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Sparkles, CalendarRange, Plus } from "lucide-react";
import { C } from "@/config/colors";
import { usePerfectYearStore } from "@/store/usePerfectYearStore";
import { adventuresByCategory, groupPursuits, shortWhy, placeAdventures } from "@/lib/perfectWizard";
import type { AdventureCategory } from "@/types/horizon";
import WizardShell from "./WizardShell";

const CAT_COLOR: Record<AdventureCategory, string> = {
  "Immersive Travel": "#2d7a66",
  "Creative Mastery": "#7a5a9e",
  "Endurance/Active": "#4a8a5a",
  "Slow Living":      "#c4784e",
};

/**
 * The guided way into Perfect Year — its own flow, distinct from Perfect Day.
 * Rather than a blank calendar, it's about the hobbies and one-of-a-kind
 * pursuits you want your next chapter built around: browse a catalog of vivid
 * ideas, pick the ones that pull at you, and see them collected as a portfolio
 * (with a first small step for each), not a grid of months. The calendar still
 * lives in the editor for anyone who wants to time things out.
 */
export default function PerfectYearWizard({ onDone }: { onDone: () => void }) {
  const plan = usePerfectYearStore((s) => s.plan);
  const applySeed = usePerfectYearStore((s) => s.applySeed);

  const groups = useMemo(() => adventuresByCategory(), []);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<0 | 1 | 2 | null>(null);

  // Returning users: reconstruct their picks from the saved year and land on the
  // portfolio; newcomers start at the hook.
  useEffect(() => {
    const placed = Object.values(usePerfectYearStore.getState().plan).flat();
    setSelected(placed);
    setStep(placed.length ? 2 : 0);
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Persist picks into the year plan (so the editor + return visits reflect them).
  const commit = (ids: string[]) => applySeed(placeAdventures(ids));

  const goReveal = () => { commit(selected); setStep(2); };
  const portfolio = useMemo(() => groupPursuits(selected), [selected]);

  if (step === null) return <div style={{ minHeight: 180 }} />;

  // ── Step 0 · Hook ───────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <WizardShell
        step={1} total={3} eyebrow="Perfect Year"
        title="What will you build your next chapter around?"
        subtitle="The trips, crafts, and one-of-a-kind pursuits you never had time for. Pick the ones that pull at you and we'll gather them into a portfolio for your year — with a small first step for each."
        onNext={() => setStep(1)} nextLabel="Show me ideas"
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { icon: "🎸", t: "Real pursuits, not tasks", d: "Learn fingerstyle guitar, produce an EP, walk Patagonia." },
            { icon: "🧭", t: "Pick what excites you", d: "Browse vivid ideas across four kinds of adventure." },
            { icon: "🌱", t: "Start small, now", d: "Each one comes with a first step you can take this week." },
          ].map((c) => (
            <div key={c.t} style={{ flex: "1 1 150px", background: C.bgCard, border: `1px solid ${C.borderSoft}`, borderRadius: 14, padding: "14px 15px" }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>{c.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 9 }}>{c.t}</div>
              <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{c.d}</div>
            </div>
          ))}
        </div>
      </WizardShell>
    );
  }

  // ── Step 1 · Pick pursuits ─────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <WizardShell
        step={2} total={3} eyebrow="Step 2 of 3"
        title="Which of these pull at you?"
        subtitle="Pick anything that sparks something — a few is plenty. You can add or drop pursuits anytime."
        onBack={() => setStep(0)}
        onNext={goReveal} nextLabel={`Gather ${selected.length || ""} pursuit${selected.length === 1 ? "" : "s"}`.replace("  ", " ")}
        nextDisabled={selected.length === 0}
        nextHint={selected.length === 0 ? "Pick at least one to continue." : undefined}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((g) => (
            <div key={g.category}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                <span style={{ fontSize: 16 }}>{g.icon}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: CAT_COLOR[g.category] }}>{g.category}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                {g.items.map((s) => {
                  const on = selected.includes(s.id);
                  const tint = CAT_COLOR[g.category];
                  return (
                    <button key={s.id} onClick={() => toggle(s.id)} style={{
                      textAlign: "left", cursor: "pointer", padding: "12px 13px", borderRadius: 13,
                      border: `1.5px solid ${on ? tint : C.border}`, background: on ? `${tint}10` : C.bgCard,
                      display: "flex", gap: 10, alignItems: "flex-start", transition: "border-color 0.15s, background 0.15s",
                    }}>
                      <span style={{
                        flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: 6,
                        border: `1.5px solid ${on ? tint : C.border}`, background: on ? tint : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {on && <Check size={13} color="#fff" />}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: on ? tint : C.ink, lineHeight: 1.3 }}>{s.concept}</span>
                        <span style={{ display: "block", fontSize: 11, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{shortWhy(s)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </WizardShell>
    );
  }

  // ── Step 2 · Portfolio reveal ──────────────────────────────────────────────────
  const count = selected.length;
  return (
    <WizardShell
      step={3} total={3} eyebrow="Step 3 of 3"
      title="The pursuits your year is built around"
      subtitle={`${count} pursuit${count === 1 ? "" : "s"} to grow into — here's a first step for each. Time them out on the calendar whenever you like.`}
      onBack={() => setStep(1)}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {portfolio.length === 0 ? (
          <div style={{ fontSize: 13, color: C.inkSoft }}>No pursuits yet — add a few to see your portfolio.</div>
        ) : (
          portfolio.map((g) => (
            <div key={g.category}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                <span style={{ fontSize: 15 }}>{g.icon}</span>
                <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.04em", color: CAT_COLOR[g.category] }}>{g.category}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
                {g.items.map((s) => {
                  const tint = CAT_COLOR[g.category];
                  return (
                    <div key={s.id} style={{ borderRadius: 13, padding: "13px 14px", background: `${tint}0d`, border: `1px solid ${tint}33` }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{s.concept}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: tint, background: `${tint}1a`, borderRadius: 6, padding: "2px 8px" }}>{s.commitment}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, background: C.bg, borderRadius: 6, padding: "2px 8px" }}>Start {s.whenToStart === "Now" ? "now" : s.whenToStart.toLowerCase()}</span>
                      </div>
                      <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                        <span style={{ flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: 5, background: "#ffffffcc", border: `1px solid ${tint}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>👉</span>
                        <span style={{ fontSize: 11.5, color: C.inkMid, lineHeight: 1.5 }}>{s.microDoseAction}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
          <button onClick={() => setStep(1)} style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "13px 18px", borderRadius: 13, border: "none",
            background: C.teal, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: `0 5px 18px ${C.teal}44`,
          }}>
            <Plus size={16} /> Add or change pursuits
          </button>
          <button onClick={onDone} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 16px", borderRadius: 12,
            border: `1px solid ${C.border}`, background: C.bgCard, color: C.inkMid, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            <CalendarRange size={15} /> Time them out on a calendar
          </button>
        </div>
      </div>
    </WizardShell>
  );
}

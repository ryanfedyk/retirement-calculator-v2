"use client";
import { useMemo, useState } from "react";
import { Check, Shuffle, CalendarRange, Pencil } from "lucide-react";
import { C } from "@/config/colors";
import { usePerfectYearStore } from "@/store/usePerfectYearStore";
import { ADVENTURE_SEEDS } from "@/data/adventureSeeds";
import { YEAR_CATEGORIES, adventuresForCategories, placeAdventures } from "@/lib/perfectWizard";
import type { AdventureBlueprint, AdventureCategory } from "@/types/horizon";
import WizardShell from "./WizardShell";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CAT_COLOR: Record<AdventureCategory, string> = {
  "Immersive Travel": "#2d7a66",
  "Creative Mastery": "#7a5a9e",
  "Endurance/Active": "#4a8a5a",
  "Slow Living":      "#c4784e",
};
const SEED_BY_ID: Record<string, AdventureBlueprint> = Object.fromEntries(ADVENTURE_SEEDS.map((s) => [s.id, s]));

/**
 * The guided way into Perfect Year. A one-line hook, a tap-to-choose menu of the
 * kinds of experiences that pull at you, and a reveal of a year already taking
 * shape across the seasons — then straight into the editor to refine. Categories
 * over catalogs keeps the reading light; the placed calendar is the payoff.
 */
export default function PerfectYearWizard({ onDone }: { onDone: () => void }) {
  const applySeed = usePerfectYearStore((s) => s.applySeed);

  const [step, setStep] = useState(0); // 0 hook · 1 pick · 2 reveal
  const [cats, setCats] = useState<AdventureCategory[]>([]);
  const [shuffleN, setShuffleN] = useState(0);

  const toggle = (id: AdventureCategory) =>
    setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  // Chosen seeds → placed months. `shuffleN` rotates the selection for variety.
  const plan = useMemo(() => {
    if (cats.length === 0) return {};
    const perCat = cats.length <= 2 ? 3 : 2;
    const seeds = cats.flatMap((cat) => {
      const items = adventuresForCategories([cat], perCat + 1); // one extra to allow rotation
      const start = shuffleN % Math.max(1, items.length);
      return [...items.slice(start), ...items.slice(0, start)].slice(0, perCat).map((s) => s.id);
    });
    return placeAdventures(seeds);
  }, [cats, shuffleN]);

  const placedCount = useMemo(() => Object.values(plan).reduce((s, ids) => s + ids.length, 0), [plan]);

  const commit = () => { applySeed(plan); onDone(); };
  const skipToEditor = () => {
    // Seed a broad default so the editor opens on a filled year, not a blank grid.
    applySeed(placeAdventures(adventuresForCategories(YEAR_CATEGORIES.map((c) => c.id), 2).map((s) => s.id)));
    onDone();
  };

  // ── Step 0 · Hook ───────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <WizardShell
        step={1} total={3} eyebrow="Perfect Year"
        title="Turn &ldquo;someday&rdquo; into a year you can see"
        subtitle="Pick the kinds of experiences that pull at you and we'll lay a year out across the seasons — a calendar you can feel, not a someday list. Everything's editable after."
        onNext={() => setStep(1)} nextLabel="Start"
        onSkip={skipToEditor}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { icon: "🧭", t: "Choose what excites you", d: "A few kinds of experiences — no catalogs to read." },
            { icon: "🗓️", t: "See your year fill in", d: "Trips and projects spread across the seasons." },
            { icon: "🌿", t: "Refine at your pace", d: "Swap, add, or move anything afterward." },
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

  // ── Step 1 · Pick kinds ───────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <WizardShell
        step={2} total={3} eyebrow="Step 2 of 3"
        title="What kind of year pulls at you?"
        subtitle="Pick the experiences that light you up. We'll draft a full year around them — you'll shape the details next."
        onBack={() => setStep(0)}
        onNext={() => setStep(2)} nextLabel="Draft my year"
        nextDisabled={cats.length === 0}
        nextHint={cats.length === 0 ? "Pick at least one to continue." : undefined}
        onSkip={skipToEditor}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {YEAR_CATEGORIES.map((c) => {
            const on = cats.includes(c.id);
            const tint = CAT_COLOR[c.id];
            return (
              <button key={c.id} onClick={() => toggle(c.id)} style={{
                textAlign: "left", cursor: "pointer", padding: "15px 16px", borderRadius: 14,
                border: `1.5px solid ${on ? tint : C.border}`, background: on ? `${tint}10` : C.bgCard,
                display: "flex", gap: 12, alignItems: "flex-start", transition: "border-color 0.15s, background 0.15s",
              }}>
                <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: on ? tint : C.ink }}>{c.id}</span>
                    {on && <Check size={14} color={tint} />}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{c.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </WizardShell>
    );
  }

  // ── Step 2 · Reveal (mini calendar) ────────────────────────────────────────────
  return (
    <WizardShell
      step={3} total={3} eyebrow="Step 3 of 3"
      title="Your year, already taking shape"
      subtitle={`${placedCount} experience${placedCount === 1 ? "" : "s"} placed across your seasons. Open the year to move, swap, or add more.`}
      onBack={() => setStep(1)}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {Array.from({ length: 12 }).map((_, m) => {
            const ids = plan[m] ?? [];
            return (
              <div key={m} style={{
                background: C.bgCard, border: `1px solid ${ids.length ? C.tealLight : C.borderSoft}`, borderRadius: 11,
                padding: "9px 10px", minHeight: 62,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint }}>{MONTHS[m]}</div>
                {ids.length === 0 ? (
                  <div style={{ fontSize: 10.5, color: C.inkFaint, fontStyle: "italic", marginTop: 5 }}>open</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 5 }}>
                    {ids.map((id) => {
                      const seed = SEED_BY_ID[id];
                      if (!seed) return null;
                      const tint = CAT_COLOR[seed.category];
                      return (
                        <div key={id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: tint, flexShrink: 0 }} />
                          <span style={{ fontSize: 10.5, color: C.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={seed.concept}>{seed.concept}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={commit} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 20px", borderRadius: 14, border: "none",
            background: C.teal, color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 20px ${C.teal}44`,
          }}>
            <CalendarRange size={17} /> Open my year to refine
          </button>
          <button onClick={() => setShuffleN((n) => n + 1)} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 16px", borderRadius: 12,
            border: `1px solid ${C.border}`, background: C.bgCard, color: C.inkMid, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            <Shuffle size={14} /> Shuffle
          </button>
          <button onClick={commit} style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
            cursor: "pointer", color: C.inkMid, fontSize: 12.5, fontWeight: 600,
          }}>
            <Pencil size={13} /> Edit the details
          </button>
        </div>
      </div>
    </WizardShell>
  );
}

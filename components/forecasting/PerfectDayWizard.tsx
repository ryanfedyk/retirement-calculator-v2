"use client";
import { useMemo, useState } from "react";
import { Check, Sparkles, CalendarRange, ArrowRight, Pencil } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { usePerfectDayStore } from "@/store/usePerfectDayStore";
import { usePerfectYearStore } from "@/store/usePerfectYearStore";
import { seedPerfectYear, type SeedInputs } from "@/lib/perfectSeed";
import { dayArchetypes, dayVignette, synthesizeDays } from "@/lib/perfectWizard";
import type { PerfectDayItem } from "@/lib/perfectDay";
import WizardShell from "./WizardShell";

/**
 * The guided way into Perfect Day. Three quiet steps — a one-line hook, a
 * tap-to-choose menu of days that sound like you, and an instant reveal of what
 * your retirement is really about — ending in a single clear next move (build the
 * matching year, or open the full editor to refine). No pickers, no forms, no
 * waiting on AI; the reveal is rules-based and appears at once.
 */
export default function PerfectDayWizard({ onDone, onGoToYear }: { onDone: () => void; onGoToYear?: () => void }) {
  const applySeed = usePerfectDayStore((s) => s.applySeed);
  const seedYear = usePerfectYearStore((s) => s.applySeed);

  const children = useFinancialStore((s) => s.profile.children);
  const filingStatus = useFinancialStore((s) => s.config.tax_assumptions.filing_status);
  const usePartnerIncome = useFinancialStore((s) => s.config.income_profile.use_partner_income);
  const exitMonth = useFinancialStore((s) => s.config.career_path.exit_month);
  const lifeEvents = useFinancialStore((s) => s.config.life_events);

  const seedInputs: SeedInputs = useMemo(() => ({
    childNames: (children ?? []).map((c) => c.name).filter(Boolean),
    hasPartner: filingStatus === "married_joint" || !!usePartnerIncome,
    exitMonth: exitMonth ?? undefined,
    lifeEventTags: (lifeEvents ?? []).map((e) => (e.name ?? "").toLowerCase()),
  }), [children, filingStatus, usePartnerIncome, exitMonth, lifeEvents]);

  const archetypes = useMemo(() => dayArchetypes(seedInputs), [seedInputs]);

  const [step, setStep] = useState(0); // 0 hook · 1 pick · 2 reveal
  const [picked, setPicked] = useState<string[]>([archetypes[0].id]);

  const chosenDays: PerfectDayItem[] = useMemo(
    () => archetypes.filter((a) => picked.includes(a.id)),
    [archetypes, picked],
  );
  const synthesis = useMemo(() => synthesizeDays(chosenDays), [chosenDays]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Persist the chosen days as the user's Perfect Days, then hand off.
  const commitDays = () => {
    if (chosenDays.length) applySeed(chosenDays.map((d) => ({ ...d })), chosenDays[0].id);
  };
  const finishToEditor = () => { commitDays(); onDone(); };
  const buildYearAndGo = () => {
    commitDays();
    seedYear(seedPerfectYear(seedInputs));
    onDone();
    onGoToYear?.();
  };
  // "Do it myself" from any step: drop in a sensible default so the editor isn't
  // blank, then open it.
  const skipToEditor = () => {
    applySeed(archetypes.slice(0, 3).map((d) => ({ ...d })), archetypes[0].id);
    onDone();
  };

  // ── Step 0 · Hook ───────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <WizardShell
        step={1} total={3} eyebrow="Perfect Day"
        title="What is your retirement really about?"
        subtitle="Not a budget — headspace. Pick a couple of days that sound like you, and in under a minute you'll see the throughline that ties them together: what you're actually retiring toward."
        onNext={() => setStep(1)} nextLabel="Let's find out"
        onSkip={skipToEditor}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { icon: "🌅", t: "Days that sound like you", d: "Tap a few — no building from scratch." },
            { icon: "✨", t: "An instant read", d: "See what your days have in common." },
            { icon: "🗓️", t: "A year to match", d: "Turn it into experiences across the seasons." },
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

  // ── Step 1 · Pick days ────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <WizardShell
        step={2} total={3} eyebrow="Step 2 of 3"
        title="Which of these days sound like you?"
        subtitle="Choose the ones that feel right — pick two or three for the best read. You can fine-tune every activity later."
        onBack={() => setStep(0)}
        onNext={() => setStep(2)} nextLabel="See what it says"
        nextDisabled={picked.length === 0}
        nextHint={picked.length === 0 ? "Pick at least one day to continue." : picked.length === 1 ? "Pick one more for a richer read." : undefined}
        onSkip={skipToEditor}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {archetypes.map((a) => {
            const on = picked.includes(a.id);
            return (
              <button key={a.id} onClick={() => toggle(a.id)} style={{
                textAlign: "left", cursor: "pointer", padding: "14px 15px", borderRadius: 14,
                border: `1.5px solid ${on ? C.teal : C.border}`, background: on ? C.tealWash : C.bgCard,
                display: "flex", gap: 11, alignItems: "flex-start", transition: "border-color 0.15s, background 0.15s",
              }}>
                <span style={{
                  flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: 6,
                  border: `1.5px solid ${on ? C.teal : C.border}`, background: on ? C.teal : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {on && <Check size={13} color="#fff" />}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: on ? C.tealDark : C.ink }}>{a.name}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{dayVignette(a)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </WizardShell>
    );
  }

  // ── Step 2 · Reveal ───────────────────────────────────────────────────────────
  return (
    <WizardShell
      step={3} total={3} eyebrow="Step 3 of 3"
      title="Here's what your days are telling you"
      onBack={() => setStep(1)}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ borderRadius: 18, padding: "22px 22px 24px", background: `linear-gradient(135deg, ${C.tealWash}, ${C.bgCard})`, border: `1px solid ${C.tealLight}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={16} color={C.teal} />
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tealDark }}>What your retirement is about</span>
          </div>
          <h3 style={{ fontSize: 26, fontWeight: 300, color: C.ink, letterSpacing: "-0.02em", margin: "2px 0 0", lineHeight: 1.15 }}>{synthesis.title}</h3>
          <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.6, margin: "12px 0 0" }}>{synthesis.essence}</p>

          {synthesis.passions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 8 }}>The threads we see</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {synthesis.passions.map((p) => (
                  <span key={p} style={{ fontSize: 12.5, fontWeight: 600, color: C.tealDark, background: "#ffffffcc", border: `1px solid ${C.tealLight}`, borderRadius: 99, padding: "5px 12px" }}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Primary next move */}
        <button onClick={buildYearAndGo} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
          padding: "15px", borderRadius: 14, border: "none", background: C.teal, color: "#fff",
          fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 20px ${C.teal}44`,
        }}>
          <CalendarRange size={17} /> Build my Perfect Year from this
        </button>
        <button onClick={finishToEditor} style={{
          display: "inline-flex", alignSelf: "center", alignItems: "center", gap: 6, background: "none", border: "none",
          cursor: "pointer", color: C.inkMid, fontSize: 12.5, fontWeight: 600,
        }}>
          <Pencil size={13} /> Refine my days first
        </button>
      </div>
    </WizardShell>
  );
}

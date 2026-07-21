"use client";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, CalendarRange, Pencil } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { usePerfectDayStore } from "@/store/usePerfectDayStore";
import { useReclaimWizardStore } from "@/store/useReclaimWizardStore";
import { type SeedInputs } from "@/lib/perfectSeed";
import {
  dayArchetypes, dayVignette, themeMixFromWeights, synthesizeFromWeights, DAY_WEIGHT_LABELS,
} from "@/lib/perfectWizard";
import type { PerfectDayItem } from "@/lib/perfectDay";
import WizardShell from "./WizardShell";

/**
 * The guided way into Perfect Day. Retirement isn't one kind of day — it's a
 * blend — so instead of a binary "which days are you?", the wizard asks how much
 * of your weeks each kind of day makes up, shows the mix take shape live, and
 * reveals the throughline it points to. No pickers, no waiting on AI; the read is
 * rules-based and appears at once.
 */
export default function PerfectDayWizard({ onDone, onGoToYear }: { onDone: () => void; onGoToYear?: () => void }) {
  const applySeed = usePerfectDayStore((s) => s.applySeed);
  const dayWeights = useReclaimWizardStore((s) => s.dayWeights);
  const setDayWeight = useReclaimWizardStore((s) => s.setDayWeight);

  const children = useFinancialStore((s) => s.profile.children);
  const filingStatus = useFinancialStore((s) => s.config.tax_assumptions.filing_status);
  const usePartnerIncome = useFinancialStore((s) => s.config.income_profile.use_partner_income);

  const seedInputs: SeedInputs = useMemo(() => ({
    childNames: (children ?? []).map((c) => c.name).filter(Boolean),
    hasPartner: filingStatus === "married_joint" || !!usePartnerIncome,
  }), [children, filingStatus, usePartnerIncome]);

  const archetypes = useMemo(() => dayArchetypes(seedInputs), [seedInputs]);

  const totalWeight = archetypes.reduce((s, a) => s + (dayWeights[a.id] ?? 0), 0);

  // Land on the reveal if a blend already exists; otherwise start at the hook.
  const [step, setStep] = useState<0 | 1 | 2 | null>(null);
  useEffect(() => {
    const w = useReclaimWizardStore.getState().dayWeights;
    const any = Object.values(w).some((v) => v > 0);
    setStep(any ? 2 : 0);
  }, []);

  const mix = useMemo(() => themeMixFromWeights(archetypes, dayWeights), [archetypes, dayWeights]);
  const synthesis = useMemo(() => synthesizeFromWeights(archetypes, dayWeights), [archetypes, dayWeights]);

  // Materialize the weighted archetypes into the editor's days (those with any
  // weight), so opening the detailed editor reflects the blend.
  const commitDays = () => {
    const chosen: PerfectDayItem[] = archetypes.filter((a) => (dayWeights[a.id] ?? 0) > 0);
    const list = chosen.length ? chosen : archetypes.slice(0, 2);
    applySeed(list.map((d) => ({ ...d })), list[0].id);
  };
  const toEditor = () => { commitDays(); onDone(); };
  const toYear = () => { commitDays(); onGoToYear?.(); };

  if (step === null) return <div style={{ minHeight: 180 }} />;

  // ── Step 0 · Hook ───────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <WizardShell
        step={1} total={3} eyebrow="Perfect Day"
        title="What is your retirement really about?"
        subtitle="Not a budget — headspace. Your weeks won't be one kind of day; they'll be a blend. Dial in that mix and you'll see the throughline it points to: what you're actually retiring toward."
        onNext={() => setStep(1)} nextLabel="Let's find out"
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { icon: "🎚️", t: "Set your blend", d: "How much of each kind of day feels right." },
            { icon: "✨", t: "An instant read", d: "See the throughline your mix points to." },
            { icon: "🗓️", t: "A year to match", d: "Then design the pursuits to build it around." },
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

  // ── Step 1 · Weighting ────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <WizardShell
        step={2} total={3} eyebrow="Step 2 of 3"
        title="How would your weeks actually feel?"
        subtitle="Retirement is a mix. For each kind of day, set how much of your weeks it makes up — the blend below updates as you go."
        onBack={() => setStep(0)}
        onNext={() => setStep(2)} nextLabel="See what it says"
        nextDisabled={totalWeight === 0}
        nextHint={totalWeight === 0 ? "Give at least one kind of day some weight to continue." : undefined}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {archetypes.map((a) => {
            const w = dayWeights[a.id] ?? 0;
            return (
              <div key={a.id} style={{ background: C.bgCard, border: `1px solid ${w > 0 ? C.tealLight : C.border}`, borderRadius: 14, padding: "13px 14px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: w > 0 ? C.tealDark : C.ink }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2, marginBottom: 10, lineHeight: 1.4 }}>{dayVignette(a)}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {DAY_WEIGHT_LABELS.map((label, i) => {
                    const on = w === i;
                    return (
                      <button key={label} onClick={() => setDayWeight(a.id, i)} style={{
                        flex: 1, padding: "8px 4px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 700,
                        border: `1px solid ${on ? C.teal : C.border}`, background: on ? C.teal : C.bg,
                        color: on ? "#fff" : C.inkMid, transition: "all 0.12s",
                      }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live blend bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 8 }}>Your blend</div>
          {mix.length === 0 ? (
            <div style={{ fontSize: 12, color: C.inkFaint, fontStyle: "italic" }}>Set a few weights above to see your mix.</div>
          ) : (
            <>
              <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", border: `1px solid ${C.borderSoft}` }}>
                {mix.map((s) => (
                  <div key={s.category} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.label} · ${s.pct}%`} />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 9 }}>
                {mix.map((s) => (
                  <span key={s.category} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C.inkMid }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} /> {s.label} · {s.pct}%
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </WizardShell>
    );
  }

  // ── Step 2 · Reveal ───────────────────────────────────────────────────────────
  return (
    <WizardShell
      step={3} total={3} eyebrow="Step 3 of 3"
      title="Here's what your weeks are telling you"
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

          {mix.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden" }}>
                {mix.map((s) => <div key={s.category} style={{ width: `${s.pct}%`, background: s.color }} />)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {mix.slice(0, 4).map((s) => (
                  <span key={s.category} style={{ fontSize: 12, fontWeight: 600, color: C.tealDark, background: "#ffffffcc", border: `1px solid ${C.tealLight}`, borderRadius: 99, padding: "5px 12px" }}>{s.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={toYear} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
          padding: "15px", borderRadius: 14, border: "none", background: C.teal, color: "#fff",
          fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 20px ${C.teal}44`,
        }}>
          <CalendarRange size={17} /> Design my Perfect Year
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <button onClick={() => setStep(1)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkMid, fontSize: 12.5, fontWeight: 600 }}>
            Adjust my blend
          </button>
          <button onClick={toEditor} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkMid, fontSize: 12.5, fontWeight: 600 }}>
            <Pencil size={13} /> Fine-tune the details
          </button>
        </div>
      </div>
    </WizardShell>
  );
}

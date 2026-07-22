"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, ArrowLeft, Pencil, ArrowRight, Search, Wand2, Loader2, X, RotateCcw } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { usePerfectYearStore } from "@/store/usePerfectYearStore";
import { useReclaimWizardStore } from "@/store/useReclaimWizardStore";
import { useCustomPursuitStore } from "@/store/useCustomPursuitStore";
import { usePerfectDayStore } from "@/store/usePerfectDayStore";
import { type SeedInputs } from "@/lib/perfectSeed";
import { ADVENTURE_SEEDS } from "@/data/adventureSeeds";
import {
  dayArchetypes, dayVignette, themeMixFromWeights, synthesizeFromWeights,
  adventuresByCategory, shortWhy, placeAdventures, retirementArc, blendGapNote,
  filterPursuits, YEAR_CATEGORIES,
} from "@/lib/perfectWizard";
import type { AdventureBlueprint, AdventureCategory, CommitmentLevel, WhenToStart } from "@/types/horizon";
import WizardShell from "./WizardShell";
import PerfectDay from "./PerfectDay";
import PerfectYear from "./PerfectYear";
import RetirementArcTimeline, { SEASON_META } from "./RetirementArcTimeline";

const VALID_CATS: AdventureCategory[] = ["Immersive Travel", "Creative Mastery", "Endurance/Active", "Slow Living"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

/** Coerce raw AI JSON into safe AdventureBlueprints (validate the enums). */
function normalizeIdeas(raw: unknown): AdventureBlueprint[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>, i) => {
    const category = (VALID_CATS as string[]).includes(String(r.category)) ? (r.category as AdventureCategory) : "Slow Living";
    const commitment: CommitmentLevel = r.commitment === "Macro-Adventure" ? "Macro-Adventure" : "Micro-Prototype";
    const whenToStart: WhenToStart = r.whenToStart === "Now" || r.whenToStart === "Phase 2+" || r.whenToStart === "Post-Retirement" ? (r.whenToStart as WhenToStart) : "Now";
    const depth = Math.min(3, Math.max(1, Math.round(Number(r.depthScore) || 1))) as 1 | 2 | 3;
    const concept = String(r.concept || "").trim();
    return {
      id: `ai-${slug(concept) || i}`,
      concept, category, commitment, whenToStart, depthScore: depth,
      whyFactor: String(r.whyFactor || "").trim(),
      microDoseAction: String(r.microDoseAction || "").trim(),
      tags: Array.isArray(r.tags) ? (r.tags as unknown[]).map(String).slice(0, 6) : [],
    };
  }).filter((p) => p.concept);
}

const CAT_COLOR: Record<AdventureCategory, string> = {
  "Immersive Travel": "#2d7a66",
  "Creative Mastery": "#7a5a9e",
  "Endurance/Active": "#4a8a5a",
  "Slow Living":      "#c4784e",
};

type Stage = "intro" | "days" | "year" | "arc";

/**
 * One guided journey for the whole Reclaim tab: shape the *days* you want (a
 * weighted blend, not one kind of day), gather the *pursuits* for your year, and
 * then see the *arc* — how it all flows across the seasons of your retirement.
 * The arc is framed as a warm progression (adventure → mastery & connection →
 * presence & legacy), never a countdown; the detailed editors are one tap away
 * for anyone who wants to fine-tune.
 */
export default function ReclaimJourney() {
  // Smart start: returning users (who already shaped a blend or picked pursuits)
  // land straight on their arc, not the intro. Decided once, post-hydration.
  const [stage, setStage] = useState<Stage | null>(null);
  const [fineTune, setFineTune] = useState<null | "days" | "year">(null);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    const anyW = Object.values(useReclaimWizardStore.getState().dayWeights).some((v) => v > 0);
    const anyP = Object.values(usePerfectYearStore.getState().plan).flat().length > 0;
    setStage(anyW || anyP ? "arc" : "intro");
  }, []);

  // Day blend
  const dayWeights = useReclaimWizardStore((s) => s.dayWeights);
  const setDayWeight = useReclaimWizardStore((s) => s.setDayWeight);
  const resetDayWeights = useReclaimWizardStore((s) => s.resetDayWeights);
  const children = useFinancialStore((s) => s.profile.children);
  const filingStatus = useFinancialStore((s) => s.config.tax_assumptions.filing_status);
  const usePartnerIncome = useFinancialStore((s) => s.config.income_profile.use_partner_income);
  const birthYear = useFinancialStore((s) => s.config.birth_year);
  const exitYear = useFinancialStore((s) => s.config.career_path.exit_year);

  const seedInputs: SeedInputs = useMemo(() => ({
    childNames: (children ?? []).map((c) => c.name).filter(Boolean),
    hasPartner: filingStatus === "married_joint" || !!usePartnerIncome,
  }), [children, filingStatus, usePartnerIncome]);
  const archetypes = useMemo(() => dayArchetypes(seedInputs), [seedInputs]);
  const totalWeight = archetypes.reduce((s, a) => s + (dayWeights[a.id] ?? 0), 0);
  const mix = useMemo(() => themeMixFromWeights(archetypes, dayWeights), [archetypes, dayWeights]);
  const synthesis = useMemo(() => synthesizeFromWeights(archetypes, dayWeights), [archetypes, dayWeights]);

  // Year pursuits + merged catalog (curated + AI-generated)
  const applySeed = usePerfectYearStore((s) => s.applySeed);
  const clearYear = usePerfectYearStore((s) => s.clear);
  const customPursuits = useCustomPursuitStore((s) => s.pursuits);
  const addCustom = useCustomPursuitStore((s) => s.addMany);
  const clearCustom = useCustomPursuitStore((s) => s.clear);
  const resetDays = usePerfectDayStore((s) => s.reset);
  const catalog = useMemo(() => [...ADVENTURE_SEEDS, ...customPursuits], [customPursuits]);
  const [pursuits, setPursuits] = useState<string[]>(() => Object.values(usePerfectYearStore.getState().plan).flat());
  const togglePursuit = (id: string) => setPursuits((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const commitPursuits = (ids: string[]) => applySeed(placeAdventures(ids));

  // Explorer — progressive: pick broad interests first, then the pursuits within
  // them appear (search is a global escape hatch). Seeded from any already-chosen
  // pursuits so returning editors see relevant kinds expanded.
  const [query, setQuery] = useState("");
  const [interests, setInterests] = useState<AdventureCategory[]>(() => {
    const byId = Object.fromEntries(ADVENTURE_SEEDS.map((s) => [s.id, s]));
    const chosen = Object.values(usePerfectYearStore.getState().plan).flat();
    return [...new Set(chosen.map((id) => byId[id]?.category).filter(Boolean))] as AdventureCategory[];
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDisabled, setAiDisabled] = useState(false);
  const grouped = useMemo(() => adventuresByCategory(catalog), [catalog]);
  const searchResults = useMemo(() => filterPursuits(catalog, { query }), [catalog, query]);
  const toggleInterest = (c: AdventureCategory) => setInterests((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]));

  const generateIdeas = async () => {
    if (aiGenerating) return;
    setAiGenerating(true); setAiError(null);
    try {
      const res = await fetch("/api/perfect-day", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ideas", themes: mix.map((m) => m.label), interest: query.trim() || undefined, exclude: catalog.map((c) => c.concept) }),
      });
      const data = await res.json();
      if (!res.ok) { if (res.status === 503 || res.status === 401) setAiDisabled(true); throw new Error(data.detail || data.error || "Couldn't generate ideas."); }
      const ideas = normalizeIdeas(data.ideas);
      if (ideas.length) addCustom(ideas);
      else setAiError("No new ideas came back — try again.");
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Couldn't generate ideas.");
    } finally { setAiGenerating(false); }
  };

  // Draft a whole starter journey to react to — a gentle default blend + one
  // pursuit from each kind — so the arc is meaningful in a single tap.
  const draftForMe = () => {
    setDayWeight("arch-connected", 4);
    setDayWeight("arch-adventure", 3);
    setDayWeight("arch-restful", 3);
    const ids = grouped.map((g) => g.items[0]?.id).filter(Boolean) as string[];
    setPursuits(ids); commitPursuits(ids);
    setStage("arc");
  };

  // Reset the whole day / year / arc feature back to a blank slate.
  const resetAll = () => {
    resetDayWeights(); clearYear(); clearCustom(); resetDays();
    setPursuits([]); setQuery(""); setInterests([]); setAiError(null); setAiDisabled(false);
    setConfirmReset(false); setStage("intro");
  };

  // A persistent reset control, shown on every step of the flow.
  const resetRow = (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 6, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 12 }}>
      {confirmReset ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12, color: C.inkSoft, flexWrap: "wrap", justifyContent: "center" }}>
          Clear your days, pursuits &amp; arc and design from scratch?
          <button onClick={resetAll} style={{ background: C.warm, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Yes, reset</button>
          <button onClick={() => setConfirmReset(false)} style={{ background: "none", border: "none", color: C.inkFaint, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmReset(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 11.5, fontWeight: 600 }}>
          <RotateCcw size={12} /> Reset my design
        </button>
      )}
    </div>
  );

  // Arc
  const exitAge = birthYear && exitYear ? Math.max(40, exitYear - birthYear) : null;
  const arc = useMemo(() => retirementArc({ exitAge, mix, pursuitIds: pursuits, catalog }), [exitAge, mix, pursuits, catalog]);

  // ── Fine-tune: full editors, one tap away ──────────────────────────────────
  if (fineTune === "days") {
    return <PerfectDay onExit={() => setFineTune(null)} onGoToYear={() => { setFineTune(null); setStage("year"); }} />;
  }
  if (fineTune === "year") {
    return <PerfectYear onExit={() => setFineTune(null)} />;
  }

  if (stage === null) return <div style={{ minHeight: 200 }} />;

  // ── Intro ───────────────────────────────────────────────────────────────────
  if (stage === "intro") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.tealDark, marginBottom: 8 }}>Design your retirement</div>
          <h2 style={{ fontSize: 24, fontWeight: 300, color: C.ink, letterSpacing: "-0.015em", lineHeight: 1.2, margin: 0 }}>
            Let's shape the life, not just the number.
          </h2>
          <p style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.55, margin: "10px 0 0", maxWidth: 560 }}>
            Three quiet steps — no budgets, no forms. We'll shape the <strong style={{ color: C.inkMid }}>days</strong> you want, gather the <strong style={{ color: C.inkMid }}>pursuits</strong> for your year, and then see the whole <strong style={{ color: C.inkMid }}>arc</strong> of it across the seasons ahead.
          </p>
        </div>
        {/* The path ahead — a quiet numbered stepper, not tappable cards. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            { n: 1, icon: "🎚️", t: "Your days", d: "Set the blend of days that feels like you." },
            { n: 2, icon: "🎸", t: "Your year", d: "Pick the pursuits to build it around." },
            { n: 3, icon: "🌅", t: "Your arc", d: "See it flow across the seasons ahead." },
          ].map((c, i) => (
            <div key={c.n} style={{ display: "flex", gap: 14 }}>
              {/* number + connector rail */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: C.tealWash, border: `1.5px solid ${C.tealLight}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: C.tealDark,
                }}>{c.n}</div>
                {i < 2 && <div style={{ flex: 1, width: 2, minHeight: 20, background: C.borderSoft, margin: "4px 0" }} />}
              </div>
              <div style={{ paddingBottom: i < 2 ? 18 : 0, paddingTop: 3 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>
                  <span style={{ marginRight: 7 }}>{c.icon}</span>{c.t}
                </div>
                <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2, lineHeight: 1.45 }}>{c.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button onClick={() => setStage("days")} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 13, border: "none",
            background: C.teal, color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 5px 18px ${C.teal}44`,
          }}>
            Begin <ArrowRight size={16} />
          </button>
          <button onClick={draftForMe} style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "13px 18px", borderRadius: 13,
            border: `1px solid ${C.tealLight}`, background: C.tealWash, color: C.tealDark, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
          }}>
            <Wand2 size={15} /> Draft one for me
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: -6 }}>New here? &ldquo;Draft one for me&rdquo; fills a starting arc you can shape — nothing to lose.</div>
      </div>
    );
  }

  // ── Step 1 · Days (spread your week's blocks) ─────────────────────────────────
  if (stage === "days") {
    const BUDGET = 10;
    const placed = totalWeight;
    const remaining = Math.max(0, BUDGET - placed);
    return (
      <WizardShell
        step={1} total={3} eyebrow="Step 1 · Your days"
        title="How would your weeks actually feel?"
        subtitle="A day can hold a few of these, so picture a whole week's worth of time — about ten blocks. Lean harder on what matters most; it's fine to leave some unplaced."
        onBack={() => setStage("intro")}
        onNext={() => setStage("year")} nextLabel="Next: your year"
        nextDisabled={placed === 0}
        nextHint={placed === 0 ? "Give at least one kind some emphasis to continue." : undefined}
        onSkip={() => setFineTune("days")} skipLabel="Fine-tune day by day"
        resetSlot={resetRow}
      >
        {/* Emphasis budget */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: remaining === 0 ? C.tealWash : C.bgCard, border: `1px solid ${remaining === 0 ? C.tealLight : C.border}` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: remaining === 0 ? C.tealDark : C.inkMid }}>
            {remaining === 0 ? `Your week is richly shaped — ${BUDGET} of ${BUDGET} placed` : `${placed} of ${BUDGET} placed${placed > 0 ? ` · ${remaining} left` : ""}`}
          </span>
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: BUDGET }).map((_, i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < placed ? C.teal : C.borderSoft }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {archetypes.map((a) => {
            const w = dayWeights[a.id] ?? 0;
            const stepBtn = (dir: 1 | -1, disabled: boolean) => ({
              width: 32, height: 32, borderRadius: 9, cursor: disabled ? "default" : "pointer",
              border: `1px solid ${C.border}`, background: disabled ? C.bg : C.bgCard, color: disabled ? C.inkFaint : C.inkMid,
              fontSize: 18, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
            } as React.CSSProperties);
            return (
              <div key={a.id} style={{ background: C.bgCard, border: `1px solid ${w > 0 ? C.tealLight : C.border}`, borderRadius: 14, padding: "13px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: w > 0 ? C.tealDark : C.ink }}>{a.name}</div>
                    <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2, lineHeight: 1.4 }}>{dayVignette(a)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button aria-label={`Fewer ${a.name}`} onClick={() => w > 0 && setDayWeight(a.id, w - 1)} disabled={w <= 0} style={stepBtn(-1, w <= 0)}>−</button>
                    <div style={{ width: 52, textAlign: "center" }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: w > 0 ? C.tealDark : C.inkFaint, fontVariantNumeric: "tabular-nums" }}>{w}</span>
                      <span style={{ fontSize: 10.5, color: C.inkFaint, display: "block", marginTop: -2 }}>{w === 1 ? "block" : "blocks"}</span>
                    </div>
                    <button aria-label={`More ${a.name}`} onClick={() => remaining > 0 && setDayWeight(a.id, w + 1)} disabled={remaining <= 0} style={stepBtn(1, remaining <= 0)}>+</button>
                  </div>
                </div>
                {/* emphasis bar for this kind */}
                <div style={{ display: "flex", gap: 3, marginTop: 11 }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i < w ? C.teal : C.borderSoft }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live blend + throughline */}
        {mix.length > 0 && (
          <div style={{ marginTop: 16, borderRadius: 14, padding: "14px 16px", background: `linear-gradient(135deg, ${C.tealWash}, ${C.bgCard})`, border: `1px solid ${C.tealLight}` }}>
            <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden" }}>
              {mix.map((s) => <div key={s.category} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.label} · ${s.pct}%`} />)}
            </div>
            <div style={{ fontSize: 13.5, color: C.inkMid, marginTop: 11, lineHeight: 1.5 }}>
              This points to <strong style={{ color: C.tealDark }}>{synthesis.title.replace(/^A life of /, "a life of ")}</strong>.
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
              <span style={{ fontSize: 14, lineHeight: 1.4 }}>💡</span>
              <span style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>{blendGapNote(mix)}</span>
            </div>
          </div>
        )}
      </WizardShell>
    );
  }

  // ── Step 2 · Year (pursuit explorer) ──────────────────────────────────────────
  if (stage === "year") {
    const card = (s: AdventureBlueprint) => {
      const on = pursuits.includes(s.id);
      const tint = CAT_COLOR[s.category];
      const isAI = s.id.startsWith("ai-");
      return (
        <button key={s.id} onClick={() => togglePursuit(s.id)} style={{
          textAlign: "left", cursor: "pointer", padding: "12px 13px", borderRadius: 13,
          border: `1.5px solid ${on ? tint : C.border}`, background: on ? `${tint}10` : C.bgCard,
          display: "flex", gap: 10, alignItems: "flex-start", transition: "border-color 0.15s, background 0.15s",
        }}>
          <span style={{
            flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: 6,
            border: `1.5px solid ${on ? tint : C.border}`, background: on ? tint : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{on && <Check size={13} color="#fff" />}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: on ? tint : C.ink, lineHeight: 1.3 }}>
              {s.concept}
              {isAI && <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.04em", color: "#7a5a9e", background: "#7a5a9e18", borderRadius: 5, padding: "1px 5px", verticalAlign: "middle" }}>AI</span>}
            </span>
            <span style={{ display: "block", fontSize: 11, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{shortWhy(s)}</span>
          </span>
        </button>
      );
    };

    return (
      <WizardShell
        step={2} total={3} eyebrow="Step 2 · Your year"
        title="What will you build your year around?"
        subtitle="Start with the kinds of experience that pull at you — the pursuits inside them appear as you choose. Search anytime, or have the AI dream one up."
        onBack={() => setStage("days")}
        onNext={() => { commitPursuits(pursuits); setStage("arc"); }} nextLabel="Next: your arc"
        nextDisabled={pursuits.length === 0}
        nextHint={pursuits.length === 0 ? "Pick at least one pursuit to continue." : `${pursuits.length} chosen`}
        onSkip={() => { commitPursuits(pursuits); setFineTune("year"); }} skipLabel="Time them on a calendar"
        resetSlot={resetRow}
      >
        {/* 1 · Broad interests — the entry point */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 9 }}>Which kinds pull at you?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, marginBottom: 16 }}>
          {YEAR_CATEGORIES.map((c) => {
            const on = interests.includes(c.id);
            const tint = CAT_COLOR[c.id];
            const chosenIn = pursuits.filter((id) => (catalog.find((s) => s.id === id)?.category) === c.id).length;
            return (
              <button key={c.id} onClick={() => toggleInterest(c.id)} style={{
                textAlign: "left", cursor: "pointer", padding: "13px 14px", borderRadius: 14,
                border: `1.5px solid ${on ? tint : C.border}`, background: on ? `${tint}12` : C.bgCard,
                display: "flex", gap: 11, alignItems: "flex-start", transition: "border-color 0.15s, background 0.15s",
              }}>
                <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: on ? tint : C.ink }}>{c.id}</span>
                    {chosenIn > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: tint, borderRadius: 99, padding: "0 6px", lineHeight: "16px" }}>{chosenIn}</span>}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: C.inkSoft, marginTop: 3, lineHeight: 1.4 }}>{c.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* 2 · Search + AI (a global escape hatch, always available) */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: "1 1 220px", position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={15} color={C.inkFaint} style={{ position: "absolute", left: 11 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Or search everything…"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 32px 10px 32px", borderRadius: 11, border: `1px solid ${C.border}`, background: C.bgCard, color: C.ink, fontSize: 13, outline: "none" }} />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear" style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: C.inkFaint, display: "flex" }}><X size={14} /></button>
            )}
          </div>
          {!aiDisabled && (
            <button onClick={generateIdeas} disabled={aiGenerating} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 11, border: `1px solid ${C.tealLight}`,
              background: C.tealWash, color: C.tealDark, fontSize: 12.5, fontWeight: 700, cursor: aiGenerating ? "default" : "pointer", whiteSpace: "nowrap",
            }}>
              {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {aiGenerating ? "Dreaming up ideas…" : "Generate ideas for me"}
            </button>
          )}
        </div>
        {aiError && <div style={{ fontSize: 11.5, color: C.warm, marginBottom: 8 }}>{aiError}</div>}
        {aiDisabled && <div style={{ fontSize: 11.5, color: C.inkFaint, marginBottom: 8 }}>AI idea generation isn&apos;t configured — pick a kind above to explore the catalog.</div>}

        {/* 3 · Results — only what the user asked to see (progressive disclosure) */}
        {query.trim() ? (
          searchResults.length === 0 ? (
            <div style={{ fontSize: 13, color: C.inkSoft, padding: "8px 0" }}>No pursuits match &ldquo;{query.trim()}&rdquo;{aiDisabled ? "." : " — try the AI above."}</div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 8 }}>{searchResults.length} match{searchResults.length === 1 ? "" : "es"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>{searchResults.map(card)}</div>
            </>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Fresh AI ideas surface at the top so they're never buried */}
            {customPursuits.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                  <Wand2 size={15} color="#7a5a9e" />
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: "#7a5a9e" }}>Fresh ideas for you</span>
                  <span style={{ fontSize: 10.5, color: C.inkFaint }}>{customPursuits.length}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>{customPursuits.map(card)}</div>
              </div>
            )}

            {interests.length === 0 ? (
              <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6, padding: "10px 14px", borderRadius: 12, background: C.bgCard, border: `1px dashed ${C.border}`, textAlign: "center" }}>
                Pick a kind above to see its pursuits — or search everything.
              </div>
            ) : (
              grouped.filter((g) => interests.includes(g.category)).map((g) => {
                const items = g.items.filter((it) => !it.id.startsWith("ai-"));
                return (
                  <div key={g.category}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                      <span style={{ fontSize: 16 }}>{g.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: CAT_COLOR[g.category] }}>{g.category}</span>
                      <span style={{ fontSize: 10.5, color: C.inkFaint }}>{items.length}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>{items.map(card)}</div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </WizardShell>
    );
  }

  // ── Step 3 · Arc (finale) ─────────────────────────────────────────────────────
  const anyContent = mix.length > 0 || pursuits.length > 0;
  return (
    <WizardShell
      step={3} total={3} eyebrow="Step 3 · Your arc"
      title="Your retirement, one arc"
      subtitle="It won't be one long flat stretch — energy and focus shift. Here's how your days and pursuits flow across the seasons ahead."
      onBack={() => setStage("year")}
      resetSlot={resetRow}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Throughline headline — ties the arc back to what the days revealed */}
        {mix.length > 0 && (
          <div style={{ borderRadius: 14, padding: "14px 18px", background: `linear-gradient(135deg, ${C.tealWash}, ${C.bgCard})`, border: `1px solid ${C.tealLight}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tealDark, marginBottom: 3 }}>Your retirement looks like</div>
            <div style={{ fontSize: 20, fontWeight: 300, color: C.ink, letterSpacing: "-0.015em" }}>{synthesis.title}</div>
          </div>
        )}

        {/* The zoomable life timeline */}
        <RetirementArcTimeline arc={arc} exitAge={exitAge} horizonAge={90} />

        {/* Season cards — the readable detail beneath the timeline */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {arc.map((s) => {
            const m = SEASON_META[s.key];
            return (
              <div key={s.key} style={{ borderRadius: 15, padding: "15px 16px", background: m.tint, border: `1px solid ${m.color}33`, display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink, letterSpacing: "-0.01em" }}>{m.name}</div>
                    {s.ageFrom != null && (
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: m.color, letterSpacing: "0.03em" }}>
                        {s.key === "still" ? `${s.ageFrom}+` : `Age ${s.ageFrom}–${s.ageTo}`}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: C.inkMid, lineHeight: 1.5 }}>{m.blurb}</div>

                {s.themeLabels.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {s.themeLabels.map((t) => (
                      <span key={t} style={{ fontSize: 10.5, fontWeight: 600, color: m.color, background: "#ffffffcc", border: `1px solid ${m.color}33`, borderRadius: 99, padding: "3px 9px" }}>{t}</span>
                    ))}
                  </div>
                )}

                {s.pursuits.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 1 }}>
                    {s.pursuits.map((p) => (
                      <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, flexShrink: 0, marginTop: 6 }} />
                        <span style={{ fontSize: 11.5, color: C.inkMid, lineHeight: 1.4 }}>{p.concept}</span>
                      </div>
                    ))}
                  </div>
                )}

                {s.themeLabels.length === 0 && s.pursuits.length === 0 && (
                  <div style={{ fontSize: 11, color: C.inkFaint, fontStyle: "italic" }}>Open space — room to grow into.</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Warm close */}
        {anyContent && (
          <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6, textAlign: "center", padding: "4px 8px" }}>
            However far the road runs, this is a life with room for what matters most — and it starts with the very next season.
          </div>
        )}

        {/* Fine-tune handoffs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 2 }}>
          <button onClick={() => setStage("days")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.inkMid, fontSize: 12.5, fontWeight: 600 }}>
            <ArrowLeft size={13} /> Adjust my blend
          </button>
          <button onClick={() => setFineTune("days")} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkMid, fontSize: 12.5, fontWeight: 600 }}>
            <Pencil size={13} /> Fine-tune days
          </button>
          <button onClick={() => { commitPursuits(pursuits); setFineTune("year"); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkMid, fontSize: 12.5, fontWeight: 600 }}>
            <Pencil size={13} /> Fine-tune year
          </button>
        </div>
      </div>
    </WizardShell>
  );
}

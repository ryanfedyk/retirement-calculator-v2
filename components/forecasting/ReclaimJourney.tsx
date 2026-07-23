"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ArrowLeft, Pencil, ArrowRight, Search, Wand2, Loader2, X, RotateCcw, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  filterPursuits, YEAR_CATEGORIES, SUBTHEMES, subthemePursuits,
} from "@/lib/perfectWizard";
import type { AdventureBlueprint, AdventureCategory, CommitmentLevel, WhenToStart } from "@/types/horizon";
import WizardShell from "./WizardShell";
import PerfectDay from "./PerfectDay";
import PerfectYear from "./PerfectYear";
import RetirementArcTimeline, { SEASON_META } from "./RetirementArcTimeline";
import { R, SERIF, DAY_COLOR, YEAR_COLOR, presenceWord } from "./reclaimTheme";

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

type Stage = "intro" | "days" | "year" | "arc";

/**
 * One guided journey for the whole Reclaim tab: shape the *days* you want (a
 * weighted blend, not one kind of day), gather the *pursuits* for your year, and
 * then see the *arc* — how it all flows across the seasons of your retirement.
 * The arc is framed as a warm progression (adventure → mastery & connection →
 * presence & legacy), never a countdown; the detailed editors are one tap away
 * for anyone who wants to fine-tune.
 */
export default function ReclaimJourney({ framed = false }: { framed?: boolean } = {}) {
  // Smart start: returning users (who already shaped a blend or picked pursuits)
  // land straight on their arc, not the intro. Decided once, post-hydration.
  const [stage, setStage] = useState<Stage | null>(null);
  const [fineTune, setFineTune] = useState<null | "days" | "year">(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const dragRef = useRef<{ id: string; rect: DOMRect } | null>(null); // day drag-to-weight
  useEffect(() => {
    const anyW = Object.values(useReclaimWizardStore.getState().dayWeights).some((v) => v > 0);
    const anyP = Object.values(usePerfectYearStore.getState().plan).flat().length > 0;
    setStage(anyW || anyP ? "arc" : "intro");
  }, []);

  // The three movements become immersive full-screen sub-pages: on mobile
  // standalone, and always when `framed` (launched from the hub inside ToolStage,
  // which supplies the outer frame). The landing/editors scroll; a movement pins
  // its footer and fills the height. When framed, ToolStage owns the fixed
  // overlay and the page-scroll lock, so we don't add our own.
  const isMobile = useIsMobile();
  const immersive = (framed || isMobile) && !fineTune && (stage === "days" || stage === "year" || stage === "arc");
  useEffect(() => {
    if (!immersive || framed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [immersive, framed]);

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

  // Explorer — an in-place accordion: open a kind and its types expand right
  // there; tapping a type fills in matching pursuits. Search is a global escape
  // hatch. Opens the kind of an already-chosen pursuit for returning editors.
  const [query, setQuery] = useState("");
  const [expandedKind, setExpandedKind] = useState<AdventureCategory | null>(() => {
    const byId = Object.fromEntries(ADVENTURE_SEEDS.map((s) => [s.id, s]));
    const chosen = Object.values(usePerfectYearStore.getState().plan).flat();
    return (chosen.map((id) => byId[id]?.category).filter(Boolean)[0] as AdventureCategory) ?? null;
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDisabled, setAiDisabled] = useState(false);
  const grouped = useMemo(() => adventuresByCategory(catalog), [catalog]);
  const searchResults = useMemo(() => filterPursuits(catalog, { query }), [catalog, query]);

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
    setDayWeight("arch-connected", 85);
    setDayWeight("arch-adventure", 55);
    setDayWeight("arch-restful", 65);
    const ids = grouped.map((g) => g.items[0]?.id).filter(Boolean) as string[];
    setPursuits(ids); commitPursuits(ids);
    setStage("arc");
  };

  // Reset the whole day / year / arc feature back to a blank slate.
  const resetAll = () => {
    resetDayWeights(); clearYear(); clearCustom(); resetDays();
    setPursuits([]); setQuery(""); setExpandedKind(null); setAiError(null); setAiDisabled(false);
    setConfirmReset(false); setStage("intro");
  };

  // Reset control — a quiet item in the movement's overflow menu.
  const resetRow = (
    <div style={{ borderTop: `1px solid ${R.lineSoft}`, marginTop: 4, paddingTop: 4 }}>
      {confirmReset ? (
        <div style={{ padding: "8px 12px" }}>
          <div style={{ fontSize: 12.5, color: R.inkSoft, lineHeight: 1.45, marginBottom: 9 }}>Clear your days, pursuits &amp; arc and design from scratch?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={resetAll} style={{ background: R.clay, color: "#fff", border: "none", borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Yes, reset</button>
            <button onClick={() => setConfirmReset(false)} style={{ background: "none", border: "none", color: R.inkFaint, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmReset(true)} style={{ width: "100%", textAlign: "left", display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", color: R.clay, fontSize: 13.5, fontWeight: 600, padding: "10px 12px", borderRadius: 9 }}>
          <RotateCcw size={14} /> Reset my design
        </button>
      )}
    </div>
  );

  // Arc
  const exitAge = birthYear && exitYear ? Math.max(40, exitYear - birthYear) : null;
  const arc = useMemo(() => retirementArc({ exitAge, mix, pursuitIds: pursuits, catalog }), [exitAge, mix, pursuits, catalog]);

  // In immersive mode a movement takes over the whole screen. Standalone
  // (mobile) that's a fixed canvas on the warm-grey ground, sized to the dynamic
  // viewport with safe-area padding. When `framed`, ToolStage already supplies
  // that canvas, so we just fill the height it hands us. Inline elsewhere.
  const shell = (node: React.ReactNode) => {
    if (framed) return <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>{node}</div>;
    return immersive ? (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1500, background: R.ground,
        height: "100dvh", display: "flex", flexDirection: "column",
        padding: "max(14px, env(safe-area-inset-top)) 18px calc(14px + env(safe-area-inset-bottom))",
        animation: "reclaim-rise 0.28s ease",
      }}>
        <style>{"@keyframes reclaim-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"}</style>
        {node}
      </div>
    ) : node;
  };

  // The non-immersive stages (intro, fine-tune editors) are plain content. When
  // framed they still need to scroll within ToolStage's fixed-height body.
  const framedScroll = (node: React.ReactNode) =>
    framed ? (
      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", margin: "0 -2px", padding: "2px 2px 8px", WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}>{node}</div>
    ) : node;

  // ── Fine-tune: full editors, one tap away ──────────────────────────────────
  if (fineTune === "days") {
    return framedScroll(<PerfectDay onExit={() => setFineTune(null)} onGoToYear={() => { setFineTune(null); setStage("year"); }} />);
  }
  if (fineTune === "year") {
    return framedScroll(<PerfectYear onExit={() => setFineTune(null)} />);
  }

  if (stage === null) return <div style={{ minHeight: 200 }} />;

  // ── Intro ───────────────────────────────────────────────────────────────────
  if (stage === "intro") {
    return framedScroll(
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: R.accentInk, marginBottom: 12 }}>A studio for your next chapter</div>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(30px, 7vw, 44px)", fontWeight: 500, color: R.ink, letterSpacing: "-0.015em", lineHeight: 1.06, margin: 0, textWrap: "balance" }}>
            Let&apos;s compose the life, not just the number.
          </h2>
          <p style={{ fontSize: 15, color: R.inkSoft, lineHeight: 1.6, margin: "16px 0 0", maxWidth: "50ch" }}>
            No budgets, no forms — three quiet movements. Shape the <strong style={{ color: R.ink, fontWeight: 600 }}>days</strong> that feel like you, gather the <strong style={{ color: R.ink, fontWeight: 600 }}>pursuits</strong> for your year, then watch the whole <strong style={{ color: R.ink, fontWeight: 600 }}>arc</strong> of it settle across the seasons ahead.
          </p>
        </div>

        {/* The three movements — a quiet numbered path, not tappable cards. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            { n: 1, t: "Your days", d: "How a good week actually feels." },
            { n: 2, t: "Your year", d: "The pursuits worth reaching for." },
            { n: 3, t: "Your arc", d: "The shape of it, across the seasons." },
          ].map((c, i) => (
            <div key={c.n} style={{ display: "flex", gap: 15 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: R.card, border: `1.5px solid ${R.accent}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: R.accentInk,
                }}>{c.n}</div>
                {i < 2 && <div style={{ flex: 1, width: 2, minHeight: 22, background: R.line, margin: "5px 0" }} />}
              </div>
              <div style={{ paddingBottom: i < 2 ? 20 : 0, paddingTop: 4 }}>
                <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: R.ink }}>{c.t}</div>
                <div style={{ fontSize: 13, color: R.inkFaint, marginTop: 2, lineHeight: 1.45 }}>{c.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => setStage("days")} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", borderRadius: 14, border: "none",
            background: R.accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 16px 32px -16px ${R.accent}`,
          }}>
            Begin <ArrowRight size={16} />
          </button>
          <button onClick={draftForMe} style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "14px 18px", borderRadius: 14,
            border: `1px solid ${R.line}`, background: R.card, color: R.accentInk, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
          }}>
            <Wand2 size={15} /> Draft one for me
          </button>
        </div>
        <div style={{ fontSize: 12, color: R.inkFaint, marginTop: -10 }}>New here? &ldquo;Draft one for me&rdquo; composes a starting arc you can shape — nothing to lose.</div>
      </div>
    );
  }

  // ── Movement one · Your days (drag-to-weight) ─────────────────────────────────
  if (stage === "days") {
    const total = archetypes.reduce((s, a) => s + (dayWeights[a.id] ?? 0), 0);
    const weightFromX = (clientX: number, rect: DOMRect) => Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 100);
    return shell(
      <WizardShell
        immersive={immersive} onExit={framed ? undefined : () => setStage("intro")}
        step={1} total={3} eyebrow="Movement one · your days"
        title="What does a good week feel like?"
        subtitle="Not a schedule — a feeling. Drag to give each kind of day as much presence as it deserves. There's no wrong mix; the point is to notice where your heart leans."
        onBack={() => setStage("intro")}
        onNext={() => setStage("year")} nextLabel="Next: your year"
        nextDisabled={total === 0}
        nextHint={total === 0 ? "Give at least one kind of day some presence to continue." : undefined}
        onSkip={() => setFineTune("days")} skipLabel="Fine-tune day by day"
        resetSlot={resetRow}
      >
        {/* Week ribbon — the blend as one band of light */}
        <div style={{ display: "flex", height: 18, borderRadius: 999, overflow: "hidden", marginBottom: 8, background: R.card, boxShadow: `inset 0 0 0 1px ${R.lineSoft}` }}>
          {total === 0
            ? <div style={{ width: "100%", background: R.lineSoft }} />
            : archetypes.filter((a) => (dayWeights[a.id] ?? 0) > 0).map((a) => (
                <div key={a.id} title={a.name} style={{ width: `${(dayWeights[a.id] ?? 0) / total * 100}%`, background: DAY_COLOR[a.id] ?? R.accent, transition: "width 0.15s linear" }} />
              ))}
        </div>
        <div style={{ minHeight: "1.4em", marginBottom: total === 0 ? 6 : 2 }}>
          {mix.length > 0
            ? <span style={{ fontFamily: SERIF, fontSize: "clamp(19px, 3.6vw, 24px)", color: R.ink, lineHeight: 1.3 }}>A life of {synthesis.title.replace(/^A life of /, "").split(" and ").map((n, i, arr) => <span key={n}><em style={{ fontStyle: "normal", color: R.accentInk }}>{n}</em>{i < arr.length - 1 ? " and " : ""}</span>)}.</span>
            : <span style={{ fontFamily: SERIF, fontSize: "clamp(18px, 3.4vw, 22px)", color: R.inkFaint, lineHeight: 1.3 }}>Reach for the kinds of day that feel like you.</span>}
        </div>
        {mix.length > 0 && <div style={{ fontSize: 12.5, color: R.inkFaint, lineHeight: 1.5, marginBottom: 22 }}>{blendGapNote(mix)}</div>}

        {/* Presence sliders */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {archetypes.map((a) => {
            const w = dayWeights[a.id] ?? 0;
            const kc = DAY_COLOR[a.id] ?? R.accent;
            return (
              <div key={a.id} style={{ background: R.card, border: `1px solid ${w > 0 ? `color-mix(in oklab, ${kc} 45%, ${R.line})` : R.line}`, borderRadius: 18, padding: "15px 16px 16px", transition: "border-color 0.2s" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: R.ink }}>{a.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: w > 0 ? kc : R.inkFaint, whiteSpace: "nowrap" }}>{presenceWord(w)}</div>
                </div>
                <div style={{ fontSize: 12, color: R.inkFaint, margin: "3px 0 12px", lineHeight: 1.4 }}>{dayVignette(a)}</div>
                <div
                  role="slider" aria-label={`Presence of ${a.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={w} tabIndex={0}
                  onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); const rect = e.currentTarget.getBoundingClientRect(); dragRef.current = { id: a.id, rect }; setDayWeight(a.id, weightFromX(e.clientX, rect)); }}
                  onPointerMove={(e) => { const d = dragRef.current; if (d && d.id === a.id) setDayWeight(a.id, weightFromX(e.clientX, d.rect)); }}
                  onPointerUp={() => { dragRef.current = null; }}
                  onPointerCancel={() => { dragRef.current = null; }}
                  onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setDayWeight(a.id, Math.min(100, w + 10)); } if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setDayWeight(a.id, Math.max(0, w - 10)); } }}
                  style={{ position: "relative", height: 16, borderRadius: 999, background: R.ground2, cursor: "ew-resize", touchAction: "none", outline: "none", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)" }}
                >
                  <div style={{ position: "absolute", inset: 0, width: `${w}%`, borderRadius: 999, background: `linear-gradient(90deg, color-mix(in oklab, ${kc} 72%, #fff 10%), ${kc})`, transition: "width 0.1s linear" }} />
                  <div style={{ position: "absolute", top: "50%", left: `${w}%`, width: 22, height: 22, borderRadius: "50%", background: R.card2, border: `2px solid ${kc}`, transform: "translate(-50%,-50%)", transition: "left 0.1s linear", boxShadow: "0 4px 10px -4px rgba(0,0,0,0.4)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </WizardShell>
    );
  }

  // ── Movement two · Your year (worlds unfurl and gather) ───────────────────────
  if (stage === "year") {
    const card = (s: AdventureBlueprint) => {
      const on = pursuits.includes(s.id);
      const tint = YEAR_COLOR[s.category] ?? R.accent;
      const isAI = s.id.startsWith("ai-");
      return (
        <button key={s.id} onClick={() => togglePursuit(s.id)} style={{
          textAlign: "left", cursor: "pointer", padding: "12px 13px", borderRadius: 14,
          border: `1px solid ${on ? `color-mix(in oklab, ${tint} 55%, ${R.line})` : R.line}`,
          background: on ? `color-mix(in oklab, ${tint} 8%, ${R.card})` : R.card,
          display: "flex", gap: 10, alignItems: "flex-start", transition: "border-color 0.15s, background 0.15s",
        }}>
          <span style={{
            flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: 7,
            border: `1.5px solid ${on ? tint : R.line}`, background: on ? tint : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
          }}>{on && <Check size={13} color="#fff" />}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: SERIF, fontSize: 15, fontWeight: 500, color: on ? R.accentInk : R.ink, lineHeight: 1.25 }}>
              {s.concept}
              {isAI && <span style={{ marginLeft: 6, fontFamily: "inherit", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.04em", color: R.plum, background: `color-mix(in oklab, ${R.plum} 12%, transparent)`, borderRadius: 5, padding: "1px 5px", verticalAlign: "middle" }}>AI</span>}
            </span>
            <span style={{ display: "block", fontSize: 11.5, color: R.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{shortWhy(s)}</span>
          </span>
        </button>
      );
    };

    // Toggle a whole set of pursuits at once (a path gathers several at once).
    const toggleSet = (ids: string[]) => {
      if (!ids.length) return;
      const anyOn = ids.some((id) => pursuits.includes(id));
      setPursuits((p) => (anyOn ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]));
    };
    const byId = Object.fromEntries(catalog.map((s) => [s.id, s]));
    const pickChip = (id: string) => {
      const s = byId[id]; if (!s) return null;
      const tint = YEAR_COLOR[s.category] ?? R.accent;
      return (
        <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 8px 6px 12px", borderRadius: 99, background: `color-mix(in oklab, ${tint} 12%, ${R.card})`, border: `1px solid color-mix(in oklab, ${tint} 40%, ${R.line})`, fontSize: 12, fontWeight: 600, color: R.ink, maxWidth: "100%" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }} title={s.concept}>{s.concept}</span>
          <button onClick={() => togglePursuit(id)} aria-label={`Remove ${s.concept}`} style={{ flexShrink: 0, display: "flex", background: "none", border: "none", cursor: "pointer", color: tint, padding: 0 }}><X size={13} /></button>
        </span>
      );
    };

    return shell(
      <WizardShell
        immersive={immersive} onExit={framed ? undefined : () => setStage("intro")}
        step={2} total={3} eyebrow="Movement two · your year"
        title="Which worlds will your year hold?"
        subtitle="Open a world and its paths unfold right there — tap one and its pursuits gather below to keep or set down. Search or ask for fresh ideas anytime."
        onBack={() => setStage("days")}
        onNext={() => { commitPursuits(pursuits); setStage("arc"); }} nextLabel="Next: your arc"
        nextDisabled={pursuits.length === 0}
        nextHint={pursuits.length === 0 ? "Open a world and tap a path to continue." : `${pursuits.length} gathered`}
        onSkip={() => { commitPursuits(pursuits); setFineTune("year"); }} skipLabel="Time them on a calendar"
        resetSlot={resetRow}
      >
        {/* Search + AI (a global escape hatch, always available) */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: "1 1 220px", position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={15} color={R.inkFaint} style={{ position: "absolute", left: 12 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Or search every world…"
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 32px 11px 34px", borderRadius: 13, border: `1px solid ${R.line}`, background: R.card, color: R.ink, fontSize: 13.5, outline: "none" }} />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear" style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: R.inkFaint, display: "flex" }}><X size={14} /></button>
            )}
          </div>
          {!aiDisabled && (
            <button onClick={generateIdeas} disabled={aiGenerating} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 15px", borderRadius: 13, border: `1px solid color-mix(in oklab, ${R.accent} 35%, ${R.line})`,
              background: `color-mix(in oklab, ${R.accent} 9%, ${R.card})`, color: R.accentInk, fontSize: 12.5, fontWeight: 700, cursor: aiGenerating ? "default" : "pointer", whiteSpace: "nowrap",
            }}>
              {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {aiGenerating ? "Dreaming up ideas…" : "Dream some up"}
            </button>
          )}
        </div>
        {aiError && <div style={{ fontSize: 11.5, color: R.clay, marginBottom: 8 }}>{aiError}</div>}
        {aiDisabled && <div style={{ fontSize: 11.5, color: R.inkFaint, marginBottom: 8 }}>Idea generation isn&apos;t configured — open a world below to explore its pursuits.</div>}

        {/* Search overrides the worlds with a flat, global result set */}
        {query.trim() ? (
          searchResults.length === 0 ? (
            <div style={{ fontSize: 13, color: R.inkSoft, padding: "8px 0" }}>Nothing matches &ldquo;{query.trim()}&rdquo;{aiDisabled ? "." : " — try dreaming some up above."}</div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: R.inkFaint, marginBottom: 8 }}>{searchResults.length} match{searchResults.length === 1 ? "" : "es"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>{searchResults.map(card)}</div>
            </>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Fresh AI ideas, when present, ride at the top */}
            {customPursuits.length > 0 && (
              <div style={{ borderRadius: 16, border: `1px solid color-mix(in oklab, ${R.plum} 30%, ${R.line})`, background: `color-mix(in oklab, ${R.plum} 6%, ${R.card})`, padding: "13px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                  <Wand2 size={14} color={R.plum} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: R.plum }}>Dreamed up for you</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>{customPursuits.map(card)}</div>
              </div>
            )}

            {/* Worlds — each expands in place; its paths appear as large tiles */}
            {YEAR_CATEGORIES.map((c) => {
              const tint = YEAR_COLOR[c.id] ?? R.accent;
              const open = expandedKind === c.id;
              const chosenIds = pursuits.filter((id) => byId[id]?.category === c.id);
              return (
                <div key={c.id} style={{ borderRadius: 18, border: `1px solid ${open ? `color-mix(in oklab, ${tint} 50%, ${R.line})` : R.line}`, background: open ? `color-mix(in oklab, ${tint} 6%, ${R.card})` : R.card, overflow: "hidden", transition: "border-color 0.2s, background 0.2s" }}>
                  <button onClick={() => setExpandedKind(open ? null : c.id)} style={{ width: "100%", display: "flex", gap: 13, alignItems: "center", padding: "15px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontSize: 23, lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: open ? R.accentInk : R.ink }}>{c.id}</span>
                        {chosenIds.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: tint, borderRadius: 99, padding: "1px 7px", lineHeight: "16px" }}>{chosenIds.length}</span>}
                      </span>
                      {!open && <span style={{ display: "block", fontSize: 12, color: R.inkFaint, marginTop: 3, lineHeight: 1.45 }}>{c.blurb}</span>}
                    </span>
                    <ChevronDown size={19} color={open ? tint : R.inkFaint} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </button>

                  {open && (
                    <div style={{ padding: "0 16px 16px" }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: R.inkFaint, marginBottom: 10 }}>Tap a path to gather its pursuits</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                        {SUBTHEMES[c.id].map((st) => {
                          const ids = subthemePursuits(catalog, c.id, st.tags);
                          if (!ids.length) return null;
                          const chosen = ids.filter((id) => pursuits.includes(id)).length;
                          const on = chosen > 0;
                          return (
                            <button key={st.label} onClick={() => toggleSet(ids)} style={{
                              position: "relative", aspectRatio: "1 / 1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 9, padding: "12px 10px", borderRadius: 16, cursor: "pointer",
                              border: `1.5px solid ${on ? tint : R.line}`, background: on ? `color-mix(in oklab, ${tint} 14%, ${R.card2})` : R.card2, color: on ? R.accentInk : R.ink,
                              boxShadow: on ? `0 4px 12px -6px ${tint}` : "0 1px 2px rgba(20,30,26,0.05)", transition: "all 0.12s",
                            }}>
                              <span style={{ position: "absolute", top: 8, right: 8, fontSize: 10, fontWeight: 800, color: on ? "#fff" : R.inkFaint, background: on ? tint : R.lineSoft, borderRadius: 99, minWidth: 18, textAlign: "center", padding: "1px 5px", lineHeight: "16px" }}>{on ? chosen : `+${ids.length}`}</span>
                              <span style={{ fontSize: 28, lineHeight: 1 }}>{st.emoji}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{st.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {chosenIds.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: tint, marginBottom: 8 }}>Gathered · {chosenIds.length}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{chosenIds.map(pickChip)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </WizardShell>
    );
  }

  // ── Movement three · Arc (finale) ─────────────────────────────────────────────
  const anyContent = mix.length > 0 || pursuits.length > 0;
  return shell(
    <WizardShell
      immersive={immersive} onExit={framed ? undefined : () => setStage("intro")}
      step={3} total={3} eyebrow="Movement three · your arc"
      title="The whole arc, across the seasons"
      subtitle="It won't be one long flat stretch — energy and focus shift. Here's how your days and pursuits flow across the seasons ahead."
      onBack={() => setStage("year")}
      resetSlot={resetRow}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Throughline headline — ties the arc back to what the days revealed */}
        {mix.length > 0 && (
          <div style={{ borderRadius: 16, padding: "16px 18px", background: `linear-gradient(135deg, color-mix(in oklab, ${R.accent} 10%, ${R.card}), ${R.card})`, border: `1px solid color-mix(in oklab, ${R.accent} 28%, ${R.line})` }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: R.accentInk, marginBottom: 5 }}>Your retirement looks like</div>
            <div style={{ fontFamily: SERIF, fontSize: "clamp(21px, 4.4vw, 27px)", fontWeight: 500, color: R.ink, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{synthesis.title}</div>
          </div>
        )}

        {/* The zoomable life timeline (fullscreen = an immersive, all-on-canvas view) */}
        <RetirementArcTimeline arc={arc} exitAge={exitAge} horizonAge={90} headline={mix.length > 0 ? synthesis.title : undefined} />

        {/* Season cards — the readable detail beneath the timeline */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {arc.map((s) => {
            const m = SEASON_META[s.key];
            return (
              <div key={s.key} style={{ borderRadius: 18, padding: "16px 17px", background: m.tint, border: `1px solid color-mix(in oklab, ${m.color} 26%, ${R.line})`, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 21, lineHeight: 1 }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: R.ink, letterSpacing: "-0.005em" }}>{m.name}</div>
                    {s.ageFrom != null && (
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: m.color, letterSpacing: "0.04em" }}>
                        {s.key === "still" ? `${s.ageFrom}+` : `Age ${s.ageFrom}–${s.ageTo}`}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: R.inkSoft, lineHeight: 1.55 }}>{m.blurb}</div>

                {s.themeLabels.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {s.themeLabels.map((t) => (
                      <span key={t} style={{ fontSize: 10.5, fontWeight: 600, color: m.color, background: "#ffffffcc", border: `1px solid color-mix(in oklab, ${m.color} 30%, transparent)`, borderRadius: 99, padding: "3px 10px" }}>{t}</span>
                    ))}
                  </div>
                )}

                {s.pursuits.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 1 }}>
                    {s.pursuits.map((p) => (
                      <div key={p.id} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, flexShrink: 0, marginTop: 6 }} />
                        <span style={{ fontSize: 12, color: R.inkSoft, lineHeight: 1.45 }}>{p.concept}</span>
                      </div>
                    ))}
                  </div>
                )}

                {s.themeLabels.length === 0 && s.pursuits.length === 0 && (
                  <div style={{ fontSize: 11.5, color: R.inkFaint, fontStyle: "italic" }}>Open space — room to grow into.</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Warm close */}
        {anyContent && (
          <div style={{ fontFamily: SERIF, fontSize: "clamp(14px, 3vw, 16px)", color: R.inkSoft, lineHeight: 1.6, textAlign: "center", padding: "4px 8px", fontStyle: "italic" }}>
            However far the road runs, this is a life with room for what matters most — and it starts with the very next season.
          </div>
        )}

        {/* Fine-tune handoffs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 2 }}>
          <button onClick={() => setStage("days")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: R.inkSoft, fontSize: 12.5, fontWeight: 600 }}>
            <ArrowLeft size={13} /> Adjust my blend
          </button>
          <button onClick={() => setFineTune("days")} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: R.inkSoft, fontSize: 12.5, fontWeight: 600 }}>
            <Pencil size={13} /> Fine-tune days
          </button>
          <button onClick={() => { commitPursuits(pursuits); setFineTune("year"); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: R.inkSoft, fontSize: 12.5, fontWeight: 600 }}>
            <Pencil size={13} /> Fine-tune year
          </button>
        </div>
      </div>
    </WizardShell>
  );
}

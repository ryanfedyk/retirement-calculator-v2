"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ArrowLeft, Pencil, ArrowRight, Search, Wand2, Loader2, X, RotateCcw, ChevronDown, Plus, Sparkles, MoreHorizontal } from "lucide-react";
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
  filterPursuits, YEAR_CATEGORIES,
} from "@/lib/perfectWizard";
import type { AdventureBlueprint, AdventureCategory, CommitmentLevel, WhenToStart } from "@/types/horizon";
import WizardShell from "./WizardShell";
import PerfectDay from "./PerfectDay";
import PerfectYear from "./PerfectYear";
import ArcMap from "./ArcMap";
import { R, SERIF, DAY_COLOR, YEAR_COLOR, presenceWord } from "./reclaimTheme";

const VALID_CATS: AdventureCategory[] = ["Immersive Travel", "Creative Mastery", "Endurance/Active", "Slow Living", "People & Belonging"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

// An item added straight to a season on the arc takes a category that lands it
// there (the arc buckets pursuits into seasons by category), plus the season's
// display name for the coach prompt.
type ArcKey = "open" | "roots" | "still";
const ARC_CATEGORY: Record<ArcKey, AdventureCategory> = { open: "Immersive Travel", roots: "Creative Mastery", still: "Slow Living" };
const ARC_NAME: Record<ArcKey, string> = { open: "The Open Road", roots: "Deep Roots", still: "Still Waters" };

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
  const [menuOpen, setMenuOpen] = useState(false); // header actions (fine-tune / reset)
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

  // The year is built by drilling in: open a world and its six most evocative
  // pursuits appear right there as specific "seeds" to check off. Seeded open to
  // the world of an already-chosen pursuit, else the first world, so there's
  // always something to react to.
  const [expandedWorld, setExpandedWorld] = useState<AdventureCategory | null>(() => {
    const byId = Object.fromEntries([...ADVENTURE_SEEDS, ...useCustomPursuitStore.getState().pursuits].map((s) => [s.id, s]));
    const chosenCat = Object.values(usePerfectYearStore.getState().plan).flat().map((id) => byId[id]?.category).find(Boolean);
    return (chosenCat as AdventureCategory) ?? YEAR_CATEGORIES[0].id;
  });

  // Explorer — search finds across worlds; each section can dream up more seeds
  // or take a manual prompt ("add one about making an album").
  const [query, setQuery] = useState("");
  const [busyWorld, setBusyWorld] = useState<AdventureCategory | null>(null);
  const [promptText, setPromptText] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDisabled, setAiDisabled] = useState(false);
  const [optimizingSeason, setOptimizingSeason] = useState<ArcKey | null>(null);
  const [buildingArc, setBuildingArc] = useState(false);
  const grouped = useMemo(() => adventuresByCategory(catalog), [catalog]);
  const searchResults = useMemo(() => filterPursuits(catalog, { query }), [catalog, query]);

  // Add a pursuit straight onto the arc, then ask the coach to round out the rest.
  // The manual add lands immediately (and persists); the AI inference is a bonus
  // that fills gaps across the seasons — skipped quietly if Gemini isn't configured.
  const addToArc = async (season: ArcKey, text: string) => {
    const concept = text.trim();
    if (!concept) return;
    const added: AdventureBlueprint = {
      id: `add-${slug(concept) || "item"}`, concept, category: ARC_CATEGORY[season],
      commitment: "Micro-Prototype", whenToStart: "Now", depthScore: 1, whyFactor: "", microDoseAction: "", tags: [],
    };
    addCustom([added]);
    const withAdded = [...pursuits, added.id];
    setPursuits(withAdded); commitPursuits(withAdded);
    if (aiDisabled) return;

    setOptimizingSeason(season);
    try {
      const byIdLocal = Object.fromEntries([...catalog, added].map((s) => [s.id, s]));
      const have = withAdded.map((id) => byIdLocal[id]).filter(Boolean).map((p) => ({ concept: p.concept, category: p.category }));
      const res = await fetch("/api/perfect-day", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "arc", themes: mix.map((m) => m.label), have, added: { concept, season: ARC_NAME[season] }, exitAge, horizonAge: 90 }),
      });
      const data = await res.json();
      if (!res.ok) { if (res.status === 503 || res.status === 401) setAiDisabled(true); return; }
      const inferred = normalizeIdeas(data.items);
      if (inferred.length) {
        addCustom(inferred);
        const next = [...withAdded, ...inferred.map((p) => p.id)];
        setPursuits(next); commitPursuits(next);
      }
    } catch { /* keep the manual add; skip inference */ }
    finally { setOptimizingSeason(null); }
  };

  // Make a plain, local seed from typed text (no AI) — the offline fallback and
  // the instant result of a manual add.
  const addLocalSeed = (cat: AdventureCategory, text: string) => {
    const concept = text.trim();
    if (!concept) return;
    const seed: AdventureBlueprint = {
      id: `add-${slug(concept) || "seed"}`, concept, category: cat,
      commitment: "Micro-Prototype", whenToStart: "Now", depthScore: 1, whyFactor: "", microDoseAction: "", tags: [],
    };
    addCustom([seed]);
    setPursuits((p) => [...new Set([...p, seed.id])]);
  };

  // Grow more seeds for ONE world. With a prompt ("making an album") it fleshes
  // out a single seed on that theme and selects it; without one it dreams up a
  // few fresh options to choose from. Falls back to a plain local seed when the
  // coach isn't available.
  const dreamForWorld = async (cat: AdventureCategory, interest?: string) => {
    if (busyWorld) return;
    const prompt = interest?.trim();
    if (aiDisabled) { if (prompt) addLocalSeed(cat, prompt); return; }
    setBusyWorld(cat); setAiError(null);
    try {
      const res = await fetch("/api/perfect-day", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ideas", themes: mix.map((m) => m.label), category: cat, interest: prompt || undefined, count: prompt ? 1 : 4, exclude: catalog.map((c) => c.concept) }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503 || res.status === 401) { setAiDisabled(true); if (prompt) addLocalSeed(cat, prompt); return; }
        throw new Error(data.detail || data.error || "Couldn't dream up ideas.");
      }
      const ideas = normalizeIdeas(data.ideas).map((p) => ({ ...p, category: cat })); // keep them in this world
      if (ideas.length) {
        addCustom(ideas);
        if (prompt) setPursuits((p) => [...new Set([...p, ...ideas.map((i) => i.id)])]); // a prompted seed is one they asked for
      } else if (prompt) { addLocalSeed(cat, prompt); }
      else setAiError("No new ideas came back — try again.");
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Couldn't dream up ideas.");
    } finally { setBusyWorld(null); }
  };

  // Commit the chosen seeds and move to the arc — then ask the coach to grow a
  // fuller arc from those seeds, inferring complementary pursuits across the
  // seasons. The seeds stand on their own if Gemini isn't configured.
  const buildArc = async () => {
    commitPursuits(pursuits);
    setStage("arc");
    if (aiDisabled || pursuits.length === 0) return;
    setBuildingArc(true);
    try {
      const byIdLocal = Object.fromEntries(catalog.map((s) => [s.id, s]));
      const have = pursuits.map((id) => byIdLocal[id]).filter(Boolean).map((p) => ({ concept: p.concept, category: p.category }));
      const res = await fetch("/api/perfect-day", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "arc", themes: mix.map((m) => m.label), have, exitAge, horizonAge: 90 }),
      });
      const data = await res.json();
      if (!res.ok) { if (res.status === 503 || res.status === 401) setAiDisabled(true); return; }
      const inferred = normalizeIdeas(data.items);
      if (inferred.length) {
        addCustom(inferred);
        const next = [...pursuits, ...inferred.map((p) => p.id)];
        setPursuits(next); commitPursuits(next);
      }
    } catch { /* seeds stand on their own; skip the grow step */ }
    finally { setBuildingArc(false); }
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
    setPursuits([]); setExpandedWorld(YEAR_CATEGORIES[0].id); setQuery(""); setAiError(null); setAiDisabled(false);
    setConfirmReset(false); setStage("intro");
  };

  // Header actions — one quiet ⋯ menu pinned in the movement's header, holding
  // the fine-tune editors and reset, so the arc itself stays uncluttered.
  const closeMenu = () => { setMenuOpen(false); setConfirmReset(false); };
  const menuItem = (label: string, onClick: () => void, color = R.ink) => (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 9, border: "none", background: "none", color, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{label}</button>
  );
  const headerMenu = (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setMenuOpen((v) => !v)} aria-label="Options" style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%",
        border: `1px solid ${menuOpen ? R.inkFaint : R.line}`, background: R.card, color: R.inkSoft, cursor: "pointer",
      }}><MoreHorizontal size={16} /></button>
      {menuOpen && (
        <>
          <div onClick={closeMenu} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 21, minWidth: 220, background: R.card2, border: `1px solid ${R.line}`, borderRadius: 14, boxShadow: "0 18px 40px -16px rgba(20,30,26,0.4)", padding: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px 4px" }}>
              <Pencil size={12} color={R.inkFaint} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: R.inkFaint }}>Fine-tune</span>
            </div>
            {menuItem("Your days, hour by hour", () => { closeMenu(); setFineTune("days"); })}
            {menuItem("Your year, on a calendar", () => { closeMenu(); commitPursuits(pursuits); setFineTune("year"); })}
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
                <button onClick={() => setConfirmReset(true)} style={{ width: "100%", textAlign: "left", display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 9, border: "none", background: "none", color: R.clay, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                  <RotateCcw size={14} /> Reset my design
                </button>
              )}
            </div>
          </div>
        </>
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
            No budgets, no forms — a few quiet movements. Shape the <strong style={{ color: R.ink, fontWeight: 600 }}>days</strong> that feel like you, drill into the worlds that call to you and pick a few <strong style={{ color: R.ink, fontWeight: 600 }}>seeds</strong>, then watch the coach grow the whole <strong style={{ color: R.ink, fontWeight: 600 }}>arc</strong> across the seasons ahead.
          </p>
        </div>

        {/* The movements — a quiet numbered path, not tappable cards. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            { n: 1, t: "Your days", d: "How a good week actually feels." },
            { n: 2, t: "Your year", d: "Drill into a world, pick a few seeds." },
            { n: 3, t: "Your arc", d: "The coach grows it across the seasons." },
          ].map((c, i, arr) => (
            <div key={c.n} style={{ display: "flex", gap: 15 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: R.card, border: `1.5px solid ${R.accent}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: R.accentInk,
                }}>{c.n}</div>
                {i < arr.length - 1 && <div style={{ flex: 1, width: 2, minHeight: 22, background: R.line, margin: "5px 0" }} />}
              </div>
              <div style={{ paddingBottom: i < arr.length - 1 ? 20 : 0, paddingTop: 4 }}>
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
        headerAction={headerMenu} contentMaxWidth={640}
      >
        {/* Week ribbon — the blend as one band of light */}
        <div style={{ display: "flex", height: 18, borderRadius: 999, overflow: "hidden", marginBottom: 8, background: R.card, boxShadow: `inset 0 0 0 1px ${R.lineSoft}` }}>
          {total === 0
            ? <div style={{ width: "100%", background: R.lineSoft }} />
            : archetypes.filter((a) => (dayWeights[a.id] ?? 0) > 0).map((a) => (
                <div key={a.id} title={a.name} style={{ width: `${(dayWeights[a.id] ?? 0) / total * 100}%`, background: DAY_COLOR[a.id] ?? R.accent, transition: "width 0.15s linear" }} />
              ))}
        </div>
        {/* Fixed-height read-out so the sliders below never shift as content
            appears — the synthesis line and its coaching note are reserved space
            whether or not anything's been dialed in yet. */}
        <div style={{ minHeight: 78, marginBottom: 14, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div>
            {mix.length > 0
              ? <span style={{ fontFamily: SERIF, fontSize: "clamp(19px, 3.6vw, 24px)", color: R.ink, lineHeight: 1.3 }}>A life of {synthesis.title.replace(/^A life of /, "").split(" and ").map((n, i, arr) => <span key={n}><em style={{ fontStyle: "normal", color: R.accentInk }}>{n}</em>{i < arr.length - 1 ? " and " : ""}</span>)}.</span>
              : <span style={{ fontFamily: SERIF, fontSize: "clamp(18px, 3.4vw, 22px)", color: R.inkFaint, lineHeight: 1.3 }}>Reach for the kinds of day that feel like you.</span>}
          </div>
          <div style={{ fontSize: 12.5, color: R.inkFaint, lineHeight: 1.5, marginTop: 6, minHeight: "2.4em" }}>{mix.length > 0 ? blendGapNote(mix) : ""}</div>
        </div>

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

  // ── Movement two · Your year (drill into a world, pick the seeds) ─────────────
  if (stage === "year") {
    const isCustom = (id: string) => id.startsWith("ai-") || id.startsWith("add-");

    // A prompt hint per world, so manual entry reads as a wish, not a form field.
    const PROMPT_HINT: Record<AdventureCategory, string> = {
      "Immersive Travel": "a month in Japan",
      "People & Belonging": "hosting a family reunion",
      "Creative Mastery": "making an album",
      "Endurance/Active": "walking the Camino",
      "Slow Living": "a garden that feeds you",
    };

    // The specific "seeds" a world drills into: its six most evocative pursuits,
    // plus any dreamed-up or already-chosen ones so nothing a user picked ever
    // hides behind the six.
    const worldSeeds = (cat: AdventureCategory): AdventureBlueprint[] => {
      const all = catalog.filter((s) => s.category === cat);
      const custom = all.filter((s) => isCustom(s.id));
      const base = all.filter((s) => !isCustom(s.id)).sort((a, b) => b.depthScore - a.depthScore).slice(0, 6);
      const extraChosen = all.filter((s) => pursuits.includes(s.id) && !custom.includes(s) && !base.includes(s));
      return [...custom, ...base, ...extraChosen];
    };

    const toggleAll = (ids: string[], turnOn: boolean) => {
      if (!ids.length) return;
      setPursuits((p) => (turnOn ? [...new Set([...p, ...ids])] : p.filter((x) => !ids.includes(x))));
    };

    // A specific seed — a checkbox card the user chooses (or not).
    const seedCard = (s: AdventureBlueprint) => {
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

    return shell(
      <WizardShell
        immersive={immersive} onExit={framed ? undefined : () => setStage("intro")}
        step={2} total={3} eyebrow="Movement two · your year"
        title="Pick a few seeds to grow from"
        subtitle="Open a world and choose the specific things that call to you — all, some, or none. Add your own or ask for more inside any world. These seeds are all the coach needs to grow your whole arc."
        onBack={() => setStage("days")}
        onNext={buildArc} nextLabel="Build my arc"
        nextDisabled={pursuits.length === 0}
        nextHint={pursuits.length === 0 ? "Open a world and pick a seed or two to begin." : `${pursuits.length} seed${pursuits.length === 1 ? "" : "s"} chosen`}
        headerAction={headerMenu} contentMaxWidth={1040}
      >
        {/* A slim search to find across every world (creation lives in the sections) */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: 14, maxWidth: 460 }}>
          <Search size={15} color={R.inkFaint} style={{ position: "absolute", left: 12 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search across every world…"
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 32px 11px 34px", borderRadius: 13, border: `1px solid ${R.line}`, background: R.card, color: R.ink, fontSize: 13.5, outline: "none" }} />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear" style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: R.inkFaint, display: "flex" }}><X size={14} /></button>
          )}
        </div>
        {aiError && <div style={{ fontSize: 11.5, color: R.clay, marginBottom: 8 }}>{aiError}</div>}

        {/* Search overrides the worlds with a flat, global result set */}
        {query.trim() ? (
          searchResults.length === 0 ? (
            <div style={{ fontSize: 13, color: R.inkSoft, padding: "8px 0" }}>Nothing matches &ldquo;{query.trim()}&rdquo; — open a world below and add your own.</div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: R.inkFaint, marginBottom: 8 }}>{searchResults.length} match{searchResults.length === 1 ? "" : "es"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>{searchResults.map(seedCard)}</div>
            </>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* The worlds as a drill-in accordion — open one and its specific seeds
                appear right there to choose from, add to, or ask for more. */}
            {YEAR_CATEGORIES.map((c) => {
              const tint = YEAR_COLOR[c.id] ?? R.accent;
              const open = expandedWorld === c.id;
              const seeds = worldSeeds(c.id);
              const seedIds = seeds.map((s) => s.id);
              const chosen = seedIds.filter((id) => pursuits.includes(id)).length;
              const allOn = seedIds.length > 0 && chosen === seedIds.length;
              return (
                <div key={c.id} style={{ borderRadius: 18, border: `1px solid ${open ? `color-mix(in oklab, ${tint} 40%, ${R.line})` : `color-mix(in oklab, ${tint} 22%, ${R.line})`}`, background: open ? `color-mix(in oklab, ${tint} 5%, ${R.card})` : R.card, overflow: "hidden", transition: "border-color 0.15s, background 0.15s" }}>
                  {/* Header — tap to drill in */}
                  <button onClick={() => setExpandedWorld(open ? null : c.id)} style={{
                    width: "100%", textAlign: "left", display: "flex", gap: 12, alignItems: "center", cursor: "pointer",
                    background: "none", border: "none", padding: "14px 16px",
                  }}>
                    <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: R.ink, lineHeight: 1.1 }}>{c.id}</span>
                        {chosen > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: tint, borderRadius: 99, padding: "1px 7px", lineHeight: "16px" }}>{chosen}</span>}
                      </span>
                      {!open && <span style={{ display: "block", fontSize: 11.5, color: R.inkFaint, lineHeight: 1.35, marginTop: 3 }}>{c.blurb}</span>}
                    </span>
                    <ChevronDown size={18} color={R.inkFaint} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </button>

                  {/* Drilled-in seeds */}
                  {open && (
                    <div style={{ padding: "0 16px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: R.inkFaint }}>Choose the ones that call to you</span>
                        {seedIds.length > 0 && (
                          <button onClick={() => toggleAll(seedIds, !allOn)} style={{
                            flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99, cursor: "pointer",
                            border: `1px solid ${allOn ? tint : `color-mix(in oklab, ${tint} 35%, ${R.line})`}`,
                            background: allOn ? `color-mix(in oklab, ${tint} 12%, ${R.card})` : R.card, color: allOn ? R.accentInk : tint, fontSize: 11.5, fontWeight: 700,
                          }}>
                            {allOn ? <><X size={12} /> Clear all</> : <><Check size={12} /> Choose all</>}
                          </button>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>{seeds.map(seedCard)}</div>

                      {/* Grow this world — a manual prompt + a "more" button, side by side */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
                        <form
                          onSubmit={(e) => { e.preventDefault(); const t = promptText.trim(); if (t) { dreamForWorld(c.id, t); setPromptText(""); } }}
                          style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 6, border: `1px solid ${R.line}`, background: R.card, borderRadius: 12, padding: "3px 3px 3px 12px" }}
                        >
                          <Sparkles size={14} color={tint} style={{ flexShrink: 0 }} />
                          <input value={promptText} onChange={(e) => setPromptText(e.target.value)} placeholder={`Add one about ${PROMPT_HINT[c.id]}…`}
                            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 13, color: R.ink }} />
                          <button type="submit" disabled={!promptText.trim() || busyWorld === c.id} style={{
                            flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, background: promptText.trim() ? tint : R.line, color: "#fff", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: promptText.trim() && busyWorld !== c.id ? "pointer" : "default",
                          }}>
                            {busyWorld === c.id ? <Loader2 size={13} className="animate-spin" /> : "Add"}
                          </button>
                        </form>
                        {!aiDisabled && (
                          <button onClick={() => dreamForWorld(c.id)} disabled={busyWorld === c.id} style={{
                            flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12,
                            border: `1px solid color-mix(in oklab, ${tint} 35%, ${R.line})`, background: `color-mix(in oklab, ${tint} 8%, ${R.card})`, color: R.accentInk, fontSize: 12.5, fontWeight: 700, cursor: busyWorld === c.id ? "default" : "pointer", whiteSpace: "nowrap",
                          }}>
                            {busyWorld === c.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />} More ideas
                          </button>
                        )}
                      </div>
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

  // ── Movement three · Arc (finale) — a vertical journey down the years ─────────
  const anyContent = mix.length > 0 || pursuits.length > 0;
  const arcTail = anyContent ? (
    <div style={{ fontFamily: SERIF, fontSize: "clamp(14px, 3vw, 16px)", color: R.inkSoft, lineHeight: 1.6, textAlign: "center", padding: "0 8px", fontStyle: "italic" }}>
      However far the road runs, this is a life with room for what matters most — and it starts with the very next season.
    </div>
  ) : null;
  return shell(
    <WizardShell
      immersive={immersive} onExit={framed ? undefined : () => setStage("intro")}
      bodyFill
      step={3} total={3} eyebrow="Movement three · your arc"
      title="The whole arc, across the seasons"
      onBack={() => setStage("year")}
      headerAction={headerMenu}
    >
      <ArcMap arc={arc} exitAge={exitAge} horizonAge={90} headline={mix.length > 0 ? synthesis.title : undefined} tail={arcTail} onAddPursuit={addToArc} optimizingSeason={optimizingSeason} building={buildingArc} />
    </WizardShell>
  );
}

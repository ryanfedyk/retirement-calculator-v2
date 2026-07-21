"use client";
import { useMemo, useState } from "react";
import { Sparkles, Check, ArrowLeft, Pencil, ArrowRight, Search, Wand2, Loader2, X } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { usePerfectYearStore } from "@/store/usePerfectYearStore";
import { useReclaimWizardStore } from "@/store/useReclaimWizardStore";
import { useCustomPursuitStore } from "@/store/useCustomPursuitStore";
import { type SeedInputs } from "@/lib/perfectSeed";
import { ADVENTURE_SEEDS } from "@/data/adventureSeeds";
import {
  dayArchetypes, dayVignette, themeMixFromWeights, synthesizeFromWeights, DAY_WEIGHT_LABELS,
  adventuresByCategory, shortWhy, placeAdventures, retirementArc,
  filterPursuits, topInterestTags, type ArcSeasonKey,
} from "@/lib/perfectWizard";
import type { AdventureBlueprint, AdventureCategory, CommitmentLevel, WhenToStart } from "@/types/horizon";
import WizardShell from "./WizardShell";
import PerfectDay from "./PerfectDay";
import PerfectYear from "./PerfectYear";

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

const SEASON_META: Record<ArcSeasonKey, { name: string; emoji: string; color: string; tint: string; blurb: string }> = {
  open:  { name: "The Open Road", emoji: "🌄", color: "#3f9e86", tint: "#ecf6f2", blurb: "Do the big things while the body's game — travel far, move, say yes to everything." },
  roots: { name: "Deep Roots",    emoji: "🌳", color: "#2d6b58", tint: "#e9f1ed", blurb: "Deepen your craft and the people around you — mastery, mentoring, community." },
  still: { name: "Still Waters",   emoji: "🌅", color: "#c4784e", tint: "#f6ede6", blurb: "Presence and what you pass on — family, giving back, and unhurried days." },
};
const ORDER: ArcSeasonKey[] = ["open", "roots", "still"];

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
  const [stage, setStage] = useState<Stage>("intro");
  const [fineTune, setFineTune] = useState<null | "days" | "year">(null);

  // Day blend
  const dayWeights = useReclaimWizardStore((s) => s.dayWeights);
  const setDayWeight = useReclaimWizardStore((s) => s.setDayWeight);
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
  const customPursuits = useCustomPursuitStore((s) => s.pursuits);
  const addCustom = useCustomPursuitStore((s) => s.addMany);
  const catalog = useMemo(() => [...ADVENTURE_SEEDS, ...customPursuits], [customPursuits]);
  const [pursuits, setPursuits] = useState<string[]>(() => Object.values(usePerfectYearStore.getState().plan).flat());
  const togglePursuit = (id: string) => setPursuits((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const commitPursuits = (ids: string[]) => applySeed(placeAdventures(ids));

  // Explorer (search · interest tags · category · AI generation)
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [catFilter, setCatFilter] = useState<AdventureCategory | "all">("all");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDisabled, setAiDisabled] = useState(false);
  const tags = useMemo(() => topInterestTags(catalog, 16), [catalog]);
  const filtering = !!query.trim() || tagFilter.length > 0 || catFilter !== "all";
  const results = useMemo(() => filterPursuits(catalog, { query, tags: tagFilter, category: catFilter }), [catalog, query, tagFilter, catFilter]);
  const grouped = useMemo(() => adventuresByCategory(catalog), [catalog]);
  const toggleTag = (t: string) => setTagFilter((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]));

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
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { n: "1", icon: "🎚️", t: "Your days", d: "Set the blend of days that feels like you." },
            { n: "2", icon: "🎸", t: "Your year", d: "Pick the pursuits to build it around." },
            { n: "3", icon: "🌅", t: "Your arc", d: "See it flow across the seasons ahead." },
          ].map((c) => (
            <div key={c.n} style={{ flex: "1 1 150px", background: C.bgCard, border: `1px solid ${C.borderSoft}`, borderRadius: 14, padding: "14px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{c.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.tealLight }}>{c.n}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 9 }}>{c.t}</div>
              <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{c.d}</div>
            </div>
          ))}
        </div>
        <div>
          <button onClick={() => setStage("days")} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 13, border: "none",
            background: C.teal, color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 5px 18px ${C.teal}44`,
          }}>
            Begin <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1 · Days (weighted blend) ────────────────────────────────────────────
  if (stage === "days") {
    return (
      <WizardShell
        step={1} total={3} eyebrow="Step 1 · Your days"
        title="How would your weeks actually feel?"
        subtitle="Retirement is a mix. For each kind of day, set how much of your weeks it makes up — the blend updates as you go."
        onBack={() => setStage("intro")}
        onNext={() => setStage("year")} nextLabel="Next: your year"
        nextDisabled={totalWeight === 0}
        nextHint={totalWeight === 0 ? "Give at least one kind of day some weight to continue." : undefined}
        onSkip={() => setFineTune("days")} skipLabel="Fine-tune day by day"
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
                      }}>{label}</button>
                    );
                  })}
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
        subtitle="Explore the trips, crafts, and one-of-a-kind pursuits you never had time for — search, filter by what interests you, or have the AI dream up ideas. Pick anything that sparks something."
        onBack={() => setStage("days")}
        onNext={() => { commitPursuits(pursuits); setStage("arc"); }} nextLabel="Next: your arc"
        nextDisabled={pursuits.length === 0}
        nextHint={pursuits.length === 0 ? "Pick at least one pursuit to continue." : `${pursuits.length} chosen`}
        onSkip={() => { commitPursuits(pursuits); setFineTune("year"); }} skipLabel="Time them on a calendar"
      >
        {/* Search + AI */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "1 1 220px", position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={15} color={C.inkFaint} style={{ position: "absolute", left: 11 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pursuits & interests…"
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
        {aiDisabled && <div style={{ fontSize: 11.5, color: C.inkFaint, marginBottom: 8 }}>AI idea generation isn&apos;t configured — explore the curated catalog below.</div>}

        {/* Category pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {(["all", ...VALID_CATS] as const).map((c) => {
            const on = catFilter === c;
            return (
              <button key={c} onClick={() => setCatFilter(c)} style={{
                padding: "6px 12px", borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${on ? C.teal : C.border}`, background: on ? C.teal : C.bgCard, color: on ? "#fff" : C.inkMid,
              }}>{c === "all" ? "All" : c}</button>
            );
          })}
        </div>

        {/* Interest tag chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {tags.map((t) => {
            const on = tagFilter.includes(t);
            return (
              <button key={t} onClick={() => toggleTag(t)} style={{
                padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${on ? C.tealDark : C.borderSoft}`, background: on ? C.tealWash : "transparent", color: on ? C.tealDark : C.inkSoft,
              }}>#{t}</button>
            );
          })}
          {(tagFilter.length > 0 || catFilter !== "all") && (
            <button onClick={() => { setTagFilter([]); setCatFilter("all"); }} style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: "none", color: C.inkFaint, textDecoration: "underline" }}>clear</button>
          )}
        </div>

        {/* Results */}
        {filtering ? (
          results.length === 0 ? (
            <div style={{ fontSize: 13, color: C.inkSoft, padding: "8px 0" }}>No pursuits match — try a different search{aiDisabled ? "." : ", or generate ideas above."}</div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 8 }}>{results.length} match{results.length === 1 ? "" : "es"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>{results.map(card)}</div>
            </>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {grouped.map((g) => (
              <div key={g.category}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                  <span style={{ fontSize: 16 }}>{g.icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: CAT_COLOR[g.category] }}>{g.category}</span>
                  <span style={{ fontSize: 10.5, color: C.inkFaint }}>{g.items.length}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>{g.items.map(card)}</div>
              </div>
            ))}
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
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* The flowing band */}
        <div style={{ display: "flex", height: 20, borderRadius: 999, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)" }}>
          {ORDER.map((k, i) => {
            const m = SEASON_META[k];
            const next = SEASON_META[ORDER[Math.min(2, i + 1)]];
            return <div key={k} style={{ flex: 1, background: `linear-gradient(90deg, ${m.color}, ${next.color})` }} />;
          })}
        </div>

        {/* Season cards */}
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

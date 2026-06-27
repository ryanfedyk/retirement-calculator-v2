"use client";
import { useMemo, useState } from "react";
import { X, Heart, Share2, Check, RotateCcw } from "lucide-react";
import { C } from "@/config/colors";
import { useUIStore } from "@/store/useUIStore";
import { usePartnerStore } from "@/store/usePartnerStore";
import { QUESTIONS, compare, alignmentScore, encodeAnswers, type AlignStatus } from "@/lib/partnerAlignment";

const STATUS_META: Record<AlignStatus, { label: string; color: string }> = {
  aligned: { label: "Aligned", color: "#2a9d7f" },
  close:   { label: "Close",   color: C.warm },
  differ:  { label: "Differ",  color: "#c0492b" },
  incomplete: { label: "—", color: C.inkFaint },
};

type Tab = "you" | "partner" | "compare";

/** Partner alignment — capture each person's retirement *expectations*, compare
 * them, and surface where to talk. Rendered as a full-screen overlay; openable
 * from the account menu, or auto-opened when a partner opens a shared link. */
export default function PartnerAlignment() {
  const open = useUIStore((s) => s.partnerOpen);
  const setOpen = useUIStore((s) => s.setPartnerOpen);
  const { you, partner, setYou, setPartner, clear } = usePartnerStore();
  const [tab, setTab] = useState<Tab>("you");
  const [copied, setCopied] = useState(false);

  const comparisons = useMemo(() => compare(you, partner), [you, partner]);
  const score = useMemo(() => alignmentScore(comparisons), [comparisons]);
  const youCount = Object.values(you).filter((v) => v !== "" && v != null).length;
  const partnerCount = Object.values(partner).filter((v) => v !== "" && v != null).length;

  if (!open) return null;

  const share = async () => {
    const url = `${location.origin}${location.pathname}?align=${encodeAnswers(you)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { /* clipboard blocked — no-op */ }
  };

  const answers = tab === "partner" ? partner : you;
  const setAnswer = tab === "partner" ? setPartner : setYou;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(20,30,28,0.5)", display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "24px 16px" }}
      onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, background: C.bg, borderRadius: 18, boxShadow: "0 24px 70px rgba(0,0,0,0.3)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.bgHeader, position: "sticky", top: 0, zIndex: 2 }}>
          <Heart size={18} color={C.teal} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Partner alignment</div>
            <div style={{ fontSize: 11.5, color: C.inkSoft }}>Compare what you each want from retirement — and where to talk.</div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, padding: "12px 20px 0" }}>
          {([["you", `You${youCount ? ` · ${youCount}` : ""}`], ["partner", `Partner${partnerCount ? ` · ${partnerCount}` : ""}`], ["compare", "Compare"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
              background: tab === id ? C.bgCard : "transparent", color: tab === id ? C.ink : C.inkSoft,
              boxShadow: tab === id ? `0 1px 3px ${C.border}` : "none",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: "16px 20px 24px" }}>
          {tab === "compare" ? (
            <Compare comparisons={comparisons} score={score} youCount={youCount} partnerCount={partnerCount} />
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: C.inkSoft, flex: 1, minWidth: 0 }}>
                  {tab === "you" ? "Answer honestly — there are no wrong answers." : "Have your partner fill this in — or send them a link."}
                </div>
                {tab === "you" && (
                  <button onClick={share} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgCard, color: copied ? "#2a9d7f" : C.inkMid, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    {copied ? <><Check size={14} /> Link copied</> : <><Share2 size={14} /> Invite partner</>}
                  </button>
                )}
              </div>
              {QUESTIONS.map((q) => (
                <div key={q.id} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{q.emoji} {q.label}</div>
                  {q.type === "choice" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {q.options!.map((opt) => {
                        const sel = answers[q.id] === opt;
                        return (
                          <button key={opt} onClick={() => setAnswer(q.id, opt)} style={{
                            padding: "8px 13px", borderRadius: 99, cursor: "pointer", fontSize: 13, fontWeight: 600,
                            border: `1px solid ${sel ? C.teal : C.border}`, background: sel ? C.tealWash : "transparent", color: sel ? C.tealDark : C.inkMid,
                          }}>{opt}</button>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "number" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input type="range" min={q.min} max={q.max} value={Number(answers[q.id] ?? q.min ?? 0)}
                        onChange={(e) => setAnswer(q.id, +e.target.value)} style={{ flex: 1, accentColor: C.teal }} />
                      <span style={{ fontSize: 15, fontWeight: 800, color: C.ink, fontVariantNumeric: "tabular-nums", minWidth: 78, textAlign: "right" }}>
                        {answers[q.id] != null ? `${answers[q.id]} ${q.unit ?? ""}` : "—"}
                      </span>
                    </div>
                  )}
                  {q.type === "text" && (
                    <textarea value={String(answers[q.id] ?? "")} onChange={(e) => setAnswer(q.id, e.target.value)} rows={2}
                      placeholder="In a few words…"
                      style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.ink, background: C.bgCard, outline: "none", resize: "vertical" }} />
                  )}
                </div>
              ))}
              <button onClick={clear} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                <RotateCcw size={12} /> Clear both
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Compare({ comparisons, score, youCount, partnerCount }: {
  comparisons: ReturnType<typeof compare>; score: number | null; youCount: number; partnerCount: number;
}) {
  if (!youCount || !partnerCount) {
    return (
      <div style={{ textAlign: "center", padding: "30px 10px", color: C.inkSoft, fontSize: 14 }}>
        Fill in <strong>both</strong> You and Partner to see how aligned you are.
        <div style={{ fontSize: 12.5, color: C.inkFaint, marginTop: 6 }}>
          {youCount ? "Partner's answers are still empty." : "Start with your own answers, then invite your partner."}
        </div>
      </div>
    );
  }
  const scoreColor = score == null ? C.inkFaint : score >= 75 ? "#2a9d7f" : score >= 50 ? C.warm : "#c0492b";
  return (
    <div>
      {/* Score */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 40, fontWeight: 300, color: scoreColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{score ?? "—"}<span style={{ fontSize: 18 }}>%</span></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{score == null ? "Not enough answers yet" : score >= 75 ? "Strongly aligned" : score >= 50 ? "Mostly aligned" : "Worth a conversation"}</div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>Across the questions you both answered. The differences below are where great conversations start.</div>
        </div>
      </div>

      {/* Per-question comparison */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {comparisons.map(({ q, you, partner, status }) => {
          const meta = STATUS_META[status];
          const showPrompt = !q.reflective && (status === "differ" || status === "close") && q.prompt;
          return (
            <div key={q.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, flex: 1, minWidth: 0 }}>{q.emoji} {q.label}</span>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: meta.color, background: `${meta.color}1a`, borderRadius: 6, padding: "2px 8px" }}>{meta.label}</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {([["You", you], ["Partner", partner]] as [string, typeof you][]).map(([who, val]) => (
                  <div key={who} style={{ flex: 1, minWidth: 0, background: C.bg, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint }}>{who}</div>
                    <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2, lineHeight: 1.4 }}>{val != null && val !== "" ? `${val}${q.unit ? ` ${q.unit}` : ""}` : "—"}</div>
                  </div>
                ))}
              </div>
              {showPrompt && (
                <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${C.borderSoft}` }}>
                  💬 {q.prompt}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

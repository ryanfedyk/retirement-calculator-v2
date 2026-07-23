"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { R, SERIF } from "./reclaimTheme";

/**
 * Shared chrome for the "composing a life" movements: a slim progress meter, an
 * editorial serif heading, the movement body, and a footer with Back / primary
 * action. Keeps each movement visually quiet — one idea, one clear action — so
 * the flow reads as a calm studio, not a form.
 */
export default function WizardShell({
  step, total, eyebrow, title, subtitle, children,
  onBack, onNext, nextLabel = "Continue", nextDisabled = false, nextHint,
  onSkip, skipLabel = "I'll build it myself", resetSlot,
}: {
  step: number;               // 1-based
  total: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextHint?: string;          // small helper text below the primary button
  onSkip?: () => void;
  skipLabel?: string;
  resetSlot?: React.ReactNode; // persistent "reset this feature" control, shown below the footer
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Progress meter */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{
            height: 3, flex: 1, borderRadius: 999,
            background: i < step ? R.accent : R.line,
            transition: "background 0.5s ease",
          }} />
        ))}
      </div>

      {/* Heading */}
      <div>
        {eyebrow && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: R.accentInk, marginBottom: 12 }}>
            {eyebrow}
          </div>
        )}
        <h2 style={{ fontFamily: SERIF, fontSize: "clamp(27px, 6vw, 38px)", fontWeight: 500, color: R.ink, letterSpacing: "-0.015em", lineHeight: 1.1, margin: 0, textWrap: "balance" }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 14.5, color: R.inkSoft, lineHeight: 1.6, margin: "14px 0 0", maxWidth: "52ch" }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Body */}
      <div>{children}</div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
        {onBack && (
          <button onClick={onBack} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 16px", borderRadius: 13,
            border: `1px solid ${R.line}`, background: R.card, color: R.inkSoft, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
          }}>
            <ArrowLeft size={15} /> Back
          </button>
        )}
        {onNext && (
          <button onClick={onNext} disabled={nextDisabled} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 13, border: "none",
            background: nextDisabled ? R.line : R.accent, color: nextDisabled ? R.inkFaint : "#fff",
            fontSize: 14.5, fontWeight: 700, cursor: nextDisabled ? "default" : "pointer",
            boxShadow: nextDisabled ? "none" : `0 14px 30px -14px ${R.accent}`, transition: "all 0.2s ease",
          }}>
            {nextLabel} <ArrowRight size={16} />
          </button>
        )}
        {onSkip && (
          <button onClick={onSkip} style={{
            marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
            color: R.inkFaint, fontSize: 12.5, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3,
          }}>
            {skipLabel}
          </button>
        )}
      </div>
      {nextHint && (
        <div style={{ fontSize: 11.5, color: R.inkFaint, marginTop: -10 }}>{nextHint}</div>
      )}
      {resetSlot}
    </div>
  );
}

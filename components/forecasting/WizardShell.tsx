"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { C } from "@/config/colors";

/**
 * Shared chrome for the Perfect Day / Perfect Year guided wizards: a slim step
 * meter, a calm title/subtitle, the step body, and a footer with Back / primary
 * action. Keeps each step visually quiet — one idea, a few tap targets, one
 * button — so the flow reads as guidance, not a form.
 */
export default function WizardShell({
  step, total, eyebrow, title, subtitle, children,
  onBack, onNext, nextLabel = "Continue", nextDisabled = false, nextHint,
  onSkip, skipLabel = "I'll build it myself",
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
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Step meter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{
            height: 4, flex: 1, borderRadius: 999,
            background: i < step ? C.teal : C.borderSoft,
            transition: "background 0.3s ease",
          }} />
        ))}
      </div>

      {/* Heading */}
      <div>
        {eyebrow && (
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.tealDark, marginBottom: 8 }}>
            {eyebrow}
          </div>
        )}
        <h2 style={{ fontSize: 23, fontWeight: 300, color: C.ink, letterSpacing: "-0.015em", lineHeight: 1.2, margin: 0 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.55, margin: "10px 0 0", maxWidth: 560 }}>
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
            display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 16px", borderRadius: 12,
            border: `1px solid ${C.border}`, background: C.bgCard, color: C.inkMid, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
          }}>
            <ArrowLeft size={15} /> Back
          </button>
        )}
        {onNext && (
          <button onClick={onNext} disabled={nextDisabled} style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 20px", borderRadius: 12, border: "none",
            background: nextDisabled ? C.border : C.teal, color: nextDisabled ? C.inkFaint : "#fff",
            fontSize: 14, fontWeight: 700, cursor: nextDisabled ? "default" : "pointer",
            boxShadow: nextDisabled ? "none" : `0 4px 16px ${C.teal}44`, transition: "background 0.2s ease",
          }}>
            {nextLabel} <ArrowRight size={16} />
          </button>
        )}
        {onSkip && (
          <button onClick={onSkip} style={{
            marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
            color: C.inkFaint, fontSize: 12.5, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3,
          }}>
            {skipLabel}
          </button>
        )}
      </div>
      {nextHint && (
        <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: -8 }}>{nextHint}</div>
      )}
    </div>
  );
}

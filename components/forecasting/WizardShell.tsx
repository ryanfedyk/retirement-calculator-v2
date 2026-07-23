"use client";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { R, SERIF } from "./reclaimTheme";

/**
 * Shared chrome for the "composing a life" movements: a slim progress meter, an
 * editorial serif heading, the movement body, and a footer with Back / primary
 * action. Keeps each movement visually quiet — one idea, one clear action — so
 * the flow reads as a calm studio, not a form.
 *
 * In `immersive` mode (mobile sub-pages) it fills the viewport: the heading and
 * footer pin, and only the body scrolls — so a movement is a self-contained
 * screen sized to the phone, not a stretch of the dashboard's long scroll.
 */
export default function WizardShell({
  step, total, eyebrow, title, subtitle, children,
  onBack, onNext, nextLabel = "Continue", nextDisabled = false, nextHint,
  onSkip, skipLabel = "I'll build it myself", resetSlot,
  immersive = false, onExit,
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
  immersive?: boolean;        // fill the viewport, pin heading + footer, scroll only the body
  onExit?: () => void;        // immersive only: a quiet way back out to the landing
}) {
  const progress = (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{
          height: 3, flex: 1, borderRadius: 999,
          background: i < step ? R.accent : R.line,
          transition: "background 0.5s ease",
        }} />
      ))}
    </div>
  );

  const heading = (
    <div>
      {eyebrow && (
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: R.accentInk, marginBottom: 12 }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{ fontFamily: SERIF, fontSize: immersive ? "clamp(25px, 7vw, 34px)" : "clamp(27px, 6vw, 38px)", fontWeight: 500, color: R.ink, letterSpacing: "-0.015em", lineHeight: 1.1, margin: 0, textWrap: "balance" }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 14.5, color: R.inkSoft, lineHeight: 1.6, margin: "14px 0 0", maxWidth: "52ch" }}>
          {subtitle}
        </p>
      )}
    </div>
  );

  const footer = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
        <div style={{ fontSize: 11.5, color: R.inkFaint }}>{nextHint}</div>
      )}
    </>
  );

  // ── Immersive: a full-height screen. Heading + footer pin; body scrolls. ──
  if (immersive) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>{progress}</div>
            {onExit && (
              <button onClick={onExit} aria-label="Close" style={{
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%",
                border: `1px solid ${R.line}`, background: R.card, color: R.inkSoft, cursor: "pointer",
              }}><X size={16} /></button>
            )}
          </div>
          {heading}
        </div>
        <div style={{ flex: "1 1 auto", overflowY: "auto", overflowX: "hidden", minHeight: 0, margin: "18px -2px 0", padding: "2px 2px 14px", WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}>
          {children}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, paddingTop: 12, borderTop: `1px solid ${R.lineSoft}` }}>
          {footer}
          {resetSlot}
        </div>
      </div>
    );
  }

  // ── Inline (desktop / landing context): quiet single column. ──
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {progress}
      {heading}
      <div>{children}</div>
      <div style={{ marginTop: 2 }}>{footer}</div>
      {resetSlot}
    </div>
  );
}

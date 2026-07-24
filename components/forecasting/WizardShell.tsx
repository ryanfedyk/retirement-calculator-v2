"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, X, MoreHorizontal } from "lucide-react";
import { R, SERIF } from "./reclaimTheme";

/**
 * Shared chrome for the "composing a life" movements: a slim progress meter, an
 * editorial serif heading, the movement body, and a footer with Back / primary
 * action. Keeps each movement visually quiet — one idea, one clear action — so
 * the flow reads as a calm studio, not a form.
 *
 * In `immersive` mode (mobile / launched sub-pages) it fills the viewport but
 * keeps the pinned chrome to a minimum: only the progress meter (top) and the
 * Back / primary action (bottom) are fixed. The heading, subtitle, the body, and
 * the secondary actions (skip, reset) all scroll — so the reading area is as
 * tall as the phone allows.
 */
export default function WizardShell({
  step, total, eyebrow, title, subtitle, children,
  onBack, onNext, nextLabel = "Continue", nextDisabled = false, nextHint,
  onSkip, skipLabel = "I'll build it myself", resetSlot,
  immersive = false, onExit, bodyFill = false,
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
  nextHint?: string;          // small helper text near the primary button
  onSkip?: () => void;
  skipLabel?: string;
  resetSlot?: React.ReactNode; // persistent "reset this feature" control
  immersive?: boolean;        // fill the viewport, pin only progress + Back/Next
  onExit?: () => void;        // immersive only: a quiet way back out to the landing
  bodyFill?: boolean;         // immersive only: hand the whole body to the child (it scrolls itself); no heading
}) {
  const [menuOpen, setMenuOpen] = useState(false); // immersive overflow (skip / reset)

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
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: R.accentInk, marginBottom: immersive ? 8 : 12 }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{ fontFamily: SERIF, fontSize: immersive ? "clamp(23px, 6vw, 30px)" : "clamp(27px, 6vw, 38px)", fontWeight: 500, color: R.ink, letterSpacing: "-0.015em", lineHeight: 1.1, margin: 0, textWrap: "balance" }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: immersive ? 13.5 : 14.5, color: R.inkSoft, lineHeight: 1.55, margin: immersive ? "10px 0 0" : "14px 0 0", maxWidth: "52ch" }}>
          {subtitle}
        </p>
      )}
    </div>
  );

  const backBtn = onBack && (
    <button onClick={onBack} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 16px", borderRadius: 13,
      border: `1px solid ${R.line}`, background: R.card, color: R.inkSoft, fontSize: 13.5, fontWeight: 600, cursor: "pointer", flexShrink: 0,
    }}>
      <ArrowLeft size={15} /> Back
    </button>
  );

  const nextBtn = onNext && (
    <button onClick={onNext} disabled={nextDisabled} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 22px", borderRadius: 13, border: "none",
      background: nextDisabled ? R.line : R.accent, color: nextDisabled ? R.inkFaint : "#fff",
      fontSize: 14.5, fontWeight: 700, cursor: nextDisabled ? "default" : "pointer",
      boxShadow: nextDisabled ? "none" : `0 14px 30px -14px ${R.accent}`, transition: "all 0.2s ease",
    }}>
      {nextLabel} <ArrowRight size={16} />
    </button>
  );

  const skipBtn = onSkip && (
    <button onClick={onSkip} style={{
      background: "none", border: "none", cursor: "pointer",
      color: R.inkFaint, fontSize: 12.5, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3,
    }}>
      {skipLabel}
    </button>
  );

  // ── Immersive: fill the height, pin only progress + Back/Next. ──
  if (immersive) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        {/* Pinned: progress meter, an overflow menu for secondary actions, and
            (standalone only) an exit. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingBottom: 12 }}>
          <div style={{ flex: 1 }}>{progress}</div>
          {(onSkip || resetSlot) && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button onClick={() => setMenuOpen((o) => !o)} aria-label="More options" style={{
                display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%",
                border: `1px solid ${menuOpen ? R.inkFaint : R.line}`, background: R.card, color: R.inkSoft, cursor: "pointer",
              }}><MoreHorizontal size={16} /></button>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 21, minWidth: 224,
                    background: R.card2, border: `1px solid ${R.line}`, borderRadius: 14, boxShadow: "0 18px 40px -16px rgba(20,30,26,0.4)", padding: 6,
                  }}>
                    {onSkip && (
                      <button onClick={() => { setMenuOpen(false); onSkip(); }} style={{
                        width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 9, border: "none", background: "none",
                        color: R.ink, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                      }}>{skipLabel}</button>
                    )}
                    {resetSlot}
                  </div>
                </>
              )}
            </div>
          )}
          {onExit && (
            <button onClick={onExit} aria-label="Close" style={{
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%",
              border: `1px solid ${R.line}`, background: R.card, color: R.inkSoft, cursor: "pointer",
            }}><X size={16} /></button>
          )}
        </div>

        {/* Body — either a scrolling reading area (heading + content), or, in
            bodyFill mode, handed whole to the child so it can scroll itself. */}
        {bodyFill ? (
          <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        ) : (
          <div style={{ flex: "1 1 auto", overflowY: "auto", overflowX: "hidden", minHeight: 0, margin: "0 -2px", padding: "2px 2px 16px", WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}>
            {heading}
            <div style={{ marginTop: 18 }}>{children}</div>
          </div>
        )}

        {/* Pinned: a slim hint line, then Back + primary action */}
        <div style={{ flexShrink: 0, paddingTop: 10, borderTop: `1px solid ${R.lineSoft}` }}>
          {nextHint && (
            <div style={{ fontSize: 11.5, color: R.inkFaint, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextHint}</div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {backBtn}
            {nextBtn && <div style={{ flex: 1 }}>{nextBtn}</div>}
          </div>
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
      <div style={{ marginTop: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {backBtn}
          {nextBtn}
          {skipBtn && <span style={{ marginLeft: "auto" }}>{skipBtn}</span>}
        </div>
        {nextHint && <div style={{ fontSize: 11.5, color: R.inkFaint, marginTop: 10 }}>{nextHint}</div>}
      </div>
      {resetSlot}
    </div>
  );
}

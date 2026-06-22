"use client";
import { useState, useEffect } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { C } from "@/config/colors";

/**
 * Control for a value that is auto-calculated but can be manually overridden.
 * While linked it reads as plain text (the computed value) with an "auto" tag
 * and a pencil to take over; once overridden it's an editable input with a
 * counter-clockwise reset to revert to the auto value.
 */
// Match the plain inputs these sit next to: LeftPanel's INPUT_STYLE on desktop
// (12px / 5×8 padding / radius 5) and ConfigSheet's inputStyle on mobile
// (16px / 11×12 padding / radius 10), so linked + editing states line up
// exactly with the field beside them instead of reading oversized.
const SIZES = {
  desktop: { fontSize: 12, minHeight: 28, borderRadius: 5, padding: "5px 8px",  padRight: 26, iconSize: 12, iconRight: 7 },
  mobile:  { fontSize: 16, minHeight: 44, borderRadius: 10, padding: "11px 12px", padRight: 34, iconSize: 16, iconRight: 11 },
} as const;

export default function LinkedNumberField({
  linked, displayValue, onOverride, onChange, onRelink,
  variant = "desktop", step = 1, format,
}: {
  linked: boolean;
  displayValue: number;            // auto value when linked, manual value otherwise
  onOverride: () => void;          // pencil: switch to manual (caller unlinks + seeds)
  onChange: (v: number) => void;   // edit while overridden
  onRelink: () => void;            // reset: revert to auto
  variant?: "desktop" | "mobile";
  step?: number;
  format?: (n: number) => string;  // how to render the value while linked
}) {
  const sz = SIZES[variant];
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(String(displayValue));
  useEffect(() => { if (!focused) setText(String(displayValue)); }, [displayValue, focused]);

  const fmt = format ?? ((n: number) => n.toLocaleString());

  // ── Linked → plain number + edit affordance ──
  if (linked) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: sz.minHeight }}>
        <span style={{ fontSize: sz.fontSize, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
          {fmt(displayValue)}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkFaint, background: C.bgHeader, borderRadius: 4, padding: "2px 6px" }}>
          auto
        </span>
        <button
          type="button" onClick={onOverride}
          aria-label="Edit value" title="Edit value"
          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.teal, display: "flex", padding: 4 }}
        >
          <Pencil size={sz.iconSize} />
        </button>
      </div>
    );
  }

  // ── Overridden → editable input + reset-to-auto ──
  return (
    <div style={{ position: "relative" }}>
      <input
        autoFocus
        type="number" inputMode="decimal" step={step}
        value={focused ? text : String(displayValue)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => { setText(e.target.value); onChange(e.target.value === "" ? 0 : +e.target.value); }}
        style={{
          width: "100%", boxSizing: "border-box", border: `1px solid ${C.teal}`,
          borderRadius: sz.borderRadius, padding: sz.padding, paddingRight: sz.padRight, fontSize: sz.fontSize,
          color: C.ink, background: C.bg, outline: "none",
        }}
      />
      <button
        type="button" onClick={onRelink}
        aria-label="Reset to auto-calculated" title="Reset to auto-calculated"
        style={{
          position: "absolute", right: sz.iconRight, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: C.teal, display: "flex", padding: 0,
        }}
      >
        <RotateCcw size={sz.iconSize} />
      </button>
    </div>
  );
}

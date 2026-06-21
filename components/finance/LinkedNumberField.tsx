"use client";
import { useState, useEffect } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { C } from "@/config/colors";

/**
 * Consistent control for a value that is auto-calculated but can be manually
 * overridden. While linked, the field shows the computed value (read-only) with
 * a pencil button to take over; once overridden it's editable with a refresh
 * button to revert to the auto value.
 */
const SIZES = {
  desktop: { fontSize: 12, borderRadius: 5, padding: "5px 28px 5px 8px", iconRight: 6, iconSize: 13 },
  mobile:  { fontSize: 16, borderRadius: 10, padding: "11px 34px 11px 12px", iconRight: 11, iconSize: 17 },
} as const;

export default function LinkedNumberField({
  linked, displayValue, onOverride, onChange, onRelink,
  variant = "desktop", step = 1,
}: {
  linked: boolean;
  displayValue: number;            // auto value when linked, manual value otherwise
  onOverride: () => void;          // pencil: switch to manual (caller unlinks + seeds)
  onChange: (v: number) => void;   // edit while overridden
  onRelink: () => void;            // refresh: revert to auto
  variant?: "desktop" | "mobile";
  step?: number;
}) {
  const sz = SIZES[variant];
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(String(displayValue));
  useEffect(() => { if (!focused) setText(String(displayValue)); }, [displayValue, focused]);

  return (
    <div style={{ position: "relative" }}>
      <input
        type="number" inputMode="decimal" step={step} disabled={linked}
        value={focused ? text : String(displayValue)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => { setText(e.target.value); onChange(e.target.value === "" ? 0 : +e.target.value); }}
        style={{
          width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`,
          borderRadius: sz.borderRadius, padding: sz.padding, fontSize: sz.fontSize,
          color: linked ? C.inkSoft : C.ink, background: linked ? C.bgHeader : C.bg, outline: "none",
        }}
      />
      <button
        type="button"
        onClick={() => (linked ? onOverride() : onRelink())}
        aria-label={linked ? "Override with a manual value" : "Reset to auto-calculated"}
        title={linked ? "Override with a manual value" : "Reset to auto-calculated"}
        style={{
          position: "absolute", right: sz.iconRight, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: C.teal, display: "flex", padding: 0,
        }}
      >
        {linked ? <Pencil size={sz.iconSize} /> : <RotateCcw size={sz.iconSize} />}
      </button>
    </div>
  );
}

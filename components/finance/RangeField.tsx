"use client";
import { C } from "@/config/colors";

/**
 * A labeled slider (draggable handle) with an editable exact value — for the
 * detailed scenario editor, where the return assumptions live. Keeps the
 * "play with the handle" feel while still letting you type a precise number.
 */
export default function RangeField({ label, value, min, max, step, accent = C.teal, onChange, suffix = "%" }: {
  label: string; value: number; min: number; max: number; step: number; accent?: string; onChange: (v: number) => void; suffix?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: C.inkMid }}>{label}</span>
        <span style={{ display: "inline-flex", alignItems: "baseline", fontSize: 13, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
          <input type="number" value={value} min={min} max={max} step={step} aria-label={label}
            onChange={e => { const raw = e.target.value; if (raw === "") return; onChange(clamp(Math.round(+raw * 10) / 10)); }}
            style={{ width: 46, textAlign: "right", border: "none", borderBottom: `1px solid ${C.border}`, background: "none", fontSize: 13, fontWeight: 700, color: C.ink, outline: "none", fontVariantNumeric: "tabular-nums", MozAppearance: "textfield" as React.CSSProperties["MozAppearance"] }} />
          <span>{suffix}</span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: accent, cursor: "pointer" }} />
    </div>
  );
}

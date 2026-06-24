"use client";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { C } from "@/config/colors";

// Shared touch-friendly primitives for the mobile bottom sheets (ConfigSheet =
// "Scenario plan", FinancesOverlay = "Your finances"). fontSize 16 on inputs
// avoids iOS auto-zoom.

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`,
  borderRadius: 10, padding: "11px 12px", fontSize: 16, color: C.ink,
  background: C.bgCard, outline: "none",
};
export const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
  color: C.inkSoft, display: "block", marginBottom: 6,
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><span style={labelStyle}>{label}</span>{children}</div>;
}

export function Num({ value, onChange, step = 1, prefix, suffix }: { value: number; onChange: (v: number) => void; step?: number; prefix?: string; suffix?: string }) {
  // Local buffer while focused so the field can be fully cleared (a controlled
  // value={0} otherwise snaps back to "0" and the leading zero can't be erased).
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState<string>(String(value));
  useEffect(() => { if (!focused) setText(String(value)); }, [value, focused]);
  return (
    <div style={{ position: "relative" }}>
      {prefix && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.inkFaint, fontSize: 16 }}>{prefix}</span>}
      <input type="number" inputMode="decimal" step={step} value={focused ? text : String(value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => { setText(e.target.value); onChange(e.target.value === "" ? 0 : +e.target.value); }}
        style={{ ...inputStyle, paddingLeft: prefix ? 26 : 12, paddingRight: suffix ? 30 : 12 }} />
      {suffix && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.inkFaint, fontSize: 16 }}>{suffix}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={inputStyle} />;
}

export function Toggle({ on, onChange, label, color = C.teal }: { on: boolean; onChange: (v: boolean) => void; label: string; color?: string }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
      padding: "13px 14px", borderRadius: 12, marginBottom: 8,
      border: `1px solid ${on ? color : C.border}`, background: on ? `${color}14` : C.bgCard, cursor: "pointer",
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: on ? color : C.inkMid }}>{label}</span>
      <span style={{ width: 42, height: 24, borderRadius: 999, padding: 2, background: on ? color : C.border, display: "flex", justifyContent: on ? "flex-end" : "flex-start", transition: "all 0.2s" }}>
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </span>
    </button>
  );
}

export function Two({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>;
}

// ── Accordion section ─────────────────────────────────────────────────────────
export function Section({ title, accent, openId, setOpenId, id, children }: {
  title: string; accent: string; openId: string | null; setOpenId: (v: string | null) => void; id: string; children: React.ReactNode;
}) {
  const open = openId === id;
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: C.bgCard, marginBottom: 10, overflow: "hidden" }}>
      <button onClick={() => setOpenId(open ? null : id)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px", background: "transparent", border: "none", cursor: "pointer",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 18, borderRadius: 2, background: accent }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{title}</span>
        </span>
        <ChevronDown size={18} color={C.inkSoft} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && <div style={{ padding: "0 16px 18px" }}>{children}</div>}
    </div>
  );
}

"use client";
import { RotateCcw } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";

/**
 * Shows, for a baseline-linked section of the active scenario, whether any field
 * has been overridden — and offers a one-click reset back to the shared baseline.
 * Renders nothing while the section is fully linked, so it only appears once a
 * scenario has deliberately forked something.
 */
export default function BaselineLinkBadge({ section, variant = "desktop" }: { section: string; variant?: "desktop" | "mobile" }) {
  const unlinked = useFinancialStore((s) => s.scenarios.find((x) => x.id === s.activeScenarioId)?.unlinked ?? []);
  const resetToBaseline = useFinancialStore((s) => s.resetToBaseline);

  const forked = unlinked.filter((p) => p === section || p.startsWith(`${section}.`));
  if (!forked.length) return null;

  const fontSize = variant === "mobile" ? 11 : 9.5;
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, marginBottom: variant === "mobile" ? 10 : 4 }}>
      <span style={{ fontSize, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.warm }}>
        Overridden for this scenario
      </span>
      <button
        type="button"
        onClick={() => forked.forEach((p) => resetToBaseline(p))}
        title="Reset to your baseline"
        style={{
          display: "flex", alignItems: "center", gap: 4, marginLeft: "auto",
          background: "none", border: "none", cursor: "pointer", color: C.teal,
          fontSize, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", padding: 0,
        }}
      >
        <RotateCcw size={variant === "mobile" ? 13 : 11} /> Reset to baseline
      </button>
    </div>
  );
}

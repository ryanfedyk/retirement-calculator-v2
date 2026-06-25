"use client";
import { Unlink, RotateCcw } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";

/**
 * A quiet indicator that the active scenario has overridden one or more fields
 * in a baseline-linked section, with a one-tap reset back to the baseline. A
 * broken-link icon reads as "unlinked from the global"; the reset is an icon
 * (tooltip), not a loud label. Renders nothing while the section is fully linked.
 */
export default function BaselineLinkBadge({ section, variant = "desktop" }: { section: string; variant?: "desktop" | "mobile" }) {
  const unlinked = useFinancialStore((s) => s.scenarios.find((x) => x.id === s.activeScenarioId)?.unlinked ?? []);
  const resetToBaseline = useFinancialStore((s) => s.resetToBaseline);

  const forked = unlinked.filter((p) => p === section || p.startsWith(`${section}.`));
  if (!forked.length) return null;

  const fontSize = variant === "mobile" ? 11 : 10;
  const icon = variant === "mobile" ? 13 : 11;
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 5, marginBottom: variant === "mobile" ? 10 : 6, color: C.inkFaint }}>
      <Unlink size={icon} />
      <span style={{ fontSize }}>Overridden</span>
      <button
        type="button"
        onClick={() => forked.forEach((p) => resetToBaseline(p))}
        title="Reset to baseline"
        aria-label="Reset to baseline"
        style={{ display: "inline-flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 2 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.teal)}
        onMouseLeave={(e) => (e.currentTarget.style.color = C.inkSoft)}
      >
        <RotateCcw size={icon} />
      </button>
    </div>
  );
}

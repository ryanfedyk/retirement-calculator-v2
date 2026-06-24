"use client";
import { C } from "@/config/colors";
import { useUIStore } from "@/store/useUIStore";
import type { DollarMode } from "@/engine/calculator";

const OPTIONS: { id: DollarMode; label: string }[] = [
  { id: "today",  label: "Today's $" },
  { id: "future", label: "Future $" },
];

/**
 * Compact segmented control for the global money basis (today's vs. future
 * dollars). Reads and writes the shared UI store, so every chart in the app —
 * home screen and detail view — re-expresses itself the instant this flips.
 */
export default function DollarModeToggle({ title }: { title?: string }) {
  const dollarMode = useUIStore((s) => s.dollarMode);
  const setDollarMode = useUIStore((s) => s.setDollarMode);
  return (
    <div
      title={title ?? "Show dollar amounts in today's purchasing power or future (inflated) dollars"}
      style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 3, gap: 2 }}
    >
      {OPTIONS.map(({ id, label }) => {
        const active = dollarMode === id;
        return (
          <button
            key={id}
            onClick={() => setDollarMode(id)}
            aria-pressed={active}
            style={{
              fontSize: 10, fontWeight: 600, padding: "5px 9px", borderRadius: 6, cursor: "pointer",
              border: "none", whiteSpace: "nowrap",
              background: active ? C.bgCard : "transparent",
              boxShadow: active ? `0 1px 2px ${C.border}` : "none",
              color: active ? C.ink : C.inkSoft,
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

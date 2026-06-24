"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Copy, Check, Download } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useUIStore } from "@/store/useUIStore";
import { buildScenarioReport } from "@/lib/scenarioReport";
import type { LivePrices } from "@/components/finance/FinancialDashboard";

/**
 * Renders a saved scenario as a self-contained plain-text/Markdown report —
 * inputs, the engine's actual equations, and the resulting numbers — so it can
 * be pasted into an LLM to independently cross-check the math. Opened from a
 * scenario's overflow menu; controlled by the UI store so it works on desktop
 * and mobile alike.
 */
export default function ScenarioReportModal({ livePrices }: { livePrices: LivePrices }) {
  const reportScenarioId = useUIStore((s) => s.reportScenarioId);
  const closeReport = useUIStore((s) => s.closeReport);
  const scenarios = useFinancialStore((s) => s.scenarios);
  const snapshot = useFinancialStore((s) => s.snapshot);
  const [copied, setCopied] = useState(false);

  const scenario = scenarios.find((s) => s.id === reportScenarioId) ?? null;
  const open = !!scenario;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeReport(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeReport]);

  useEffect(() => { setCopied(false); }, [reportScenarioId]);

  const liveGoog = livePrices["GOOG"]?.price ?? livePrices["GOOGL"]?.price ?? 0;

  // Apply live market prices to the holdings before reporting — exactly as the
  // dashboard does. Without this the report uses each holding's stored price
  // (often 0, since prices are fetched at runtime, not persisted), valuing the
  // whole portfolio at $0 and under-counting net worth.
  const enrichedSnapshot = useMemo(() => ({
    ...snapshot,
    other_investments: (snapshot.other_investments ?? []).map((inv) => {
      const info = livePrices[inv.symbol.toUpperCase()];
      return info ? { ...inv, current_price: info.price } : inv;
    }),
  }), [snapshot, livePrices]);

  const report = useMemo(() => {
    if (!scenario) return "";
    return buildScenarioReport({
      scenarioName: scenario.name,
      snapshot: enrichedSnapshot,
      config: scenario.config,
      liveGoogPrice: liveGoog,
      includeMonteCarlo: true,
      generatedAt: new Date().toISOString(),
    });
  }, [scenario, enrichedSnapshot, liveGoog]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context / permissions) — select-all fallback.
      const ta = document.getElementById("scenario-report-text") as HTMLTextAreaElement | null;
      ta?.focus();
      ta?.select();
    }
  };

  const download = () => {
    const safe = (scenario!.name || "scenario").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe}-plan.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const btn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9,
    border: `1px solid ${C.border}`, background: C.bgCard, color: C.inkMid,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  };

  return (
    <>
      <div onClick={closeReport} style={{
        position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,46,37,0.45)", backdropFilter: "blur(2px)",
      }} />
      <div style={{
        position: "fixed", zIndex: 81, top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(820px, 94vw)", height: "min(88vh, 900px)",
        background: C.bg, borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ flexShrink: 0, padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Export “{scenario!.name}” for an LLM
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
              Plain-text plan with the full math — paste it into your AI to double-check the numbers.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={download} style={btn} title="Download as Markdown">
              <Download size={14} /> <span className="hidden min-[560px]:inline">Download</span>
            </button>
            <button onClick={copy} style={{ ...btn, borderColor: C.teal, background: copied ? C.tealWash : C.teal, color: copied ? C.tealDark : "#fff" }}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={closeReport} aria-label="Close" style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={17} color={C.inkSoft} />
            </button>
          </div>
        </div>

        {/* Body — a real textarea so users can select/edit, monospaced for the tables */}
        <textarea
          id="scenario-report-text"
          readOnly
          value={report}
          spellCheck={false}
          style={{
            flex: 1, width: "100%", boxSizing: "border-box", resize: "none", border: "none", outline: "none",
            padding: "18px 20px", background: C.bg, color: C.ink,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 12, lineHeight: 1.55, whiteSpace: "pre", overflow: "auto",
          }}
        />
      </div>
    </>
  );
}

"use client";
import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { C } from "@/config/colors";
import type { FinancialSnapshot, SimulationConfiguration, TrajectoryPoint } from "@/engine/calculator";

type AnalysisStatus = "On Track" | "At Risk" | "Needs Attention";
interface Analysis {
  retirementStatus: AnalysisStatus;
  retirementExplanation: string;
  fiStatus: AnalysisStatus;
  fiExplanation: string;
  strengths: string[];
  risks: string[];
  tips: string[];
  rawOutput?: string;
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  "On Track":        { bg: C.tealWash, border: C.tealLight, text: C.tealDark },
  "At Risk":         { bg: "#fef2f2",  border: "#fecaca",   text: "#b91c1c"  },
  "Needs Attention": { bg: C.warmWash, border: C.warmLight, text: C.warm     },
};

export default function AiAnalysis({ config, snapshot, trajectory }: {
  config: SimulationConfiguration; snapshot: FinancialSnapshot; trajectory: TrajectoryPoint[];
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, snapshot, trajectory }),
      });
      const data = await res.json();
      if (!res.ok || !data.analysis) {
        const detail = data.detail || data.error || "Unknown error.";
        setAnalysis({
          retirementStatus: "Needs Attention", retirementExplanation: detail,
          fiStatus: "Needs Attention", fiExplanation: data.error || "Analysis unavailable.",
          strengths: [], risks: [detail],
          tips: ["Update GEMINI_API_KEY in .env.local, then restart the dev server."],
        });
      } else {
        setAnalysis(data.analysis);
      }
    } catch {
      setAnalysis({
        retirementStatus: "Needs Attention", retirementExplanation: "Failed to reach analysis service.",
        fiStatus: "Needs Attention", fiExplanation: "Failed to reach analysis service.",
        strengths: [], risks: ["Analysis request failed — check your connection."],
        tips: ["Try again in a moment."],
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, marginBottom: 16, borderBottom: `1px solid ${C.borderSoft}`, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: C.tealWash, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={16} color={C.teal} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>AI Plan Analysis</div>
            <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 1 }}>Powered by Gemini</div>
          </div>
        </div>
        <button onClick={handleAnalyze} disabled={analyzing} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8,
          background: C.bgCard, border: `1px solid ${C.border}`, color: C.teal,
          fontSize: 11, fontWeight: 600, cursor: analyzing ? "wait" : "pointer", opacity: analyzing ? 0.7 : 1,
        }}>
          <RefreshCw size={12} style={{ animation: analyzing ? "spin 1s linear infinite" : "none" }} />
          {analyzing ? "Analyzing…" : analysis ? "Refresh Analysis" : "Run Analysis"}
        </button>
      </div>

      {analyzing ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 12, color: C.inkSoft }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${C.tealLight}`, borderTopColor: C.teal, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 12, fontStyle: "italic" }}>Analyzing your financial future…</span>
        </div>
      ) : analysis ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Retirement Track", status: analysis.retirementStatus, text: analysis.retirementExplanation },
              { label: "FI Track", status: analysis.fiStatus, text: analysis.fiExplanation },
            ].map(({ label, status, text }) => {
              const colors = statusColors[status] ?? statusColors["Needs Attention"];
              return (
                <div key={label} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: colors.text, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 6 }}>{status}</div>
                  <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.5, opacity: 0.85 }}>{text}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { title: "Key Strengths", icon: "✓", items: analysis.strengths, color: C.teal },
              { title: "Potential Risks", icon: "⚠", items: analysis.risks, color: C.warm },
            ].map(({ title, icon, items, color }) => (
              <div key={title} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color }}>{icon}</span> {title}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                  {items.map((item, i) => (
                    <li key={i} style={{ fontSize: 11, color: C.inkMid, display: "flex", gap: 6, lineHeight: 1.5 }}>
                      <span style={{ color: C.inkFaint, flexShrink: 0 }}>·</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={12} color={C.warm} /> Optimization Tips
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
              {analysis.tips.map((tip, i) => (
                <li key={i} style={{ fontSize: 11, color: C.inkMid, display: "flex", gap: 6, lineHeight: 1.5 }}>
                  <span style={{ color: C.warm, flexShrink: 0 }}>→</span> {tip}
                </li>
              ))}
            </ul>
          </div>

          {analysis.rawOutput && (
            <details style={{ fontSize: 10, color: C.inkFaint }}>
              <summary style={{ cursor: "pointer" }}>Raw output (debug)</summary>
              <pre style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: 9 }}>{analysis.rawOutput}</pre>
            </details>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 10, background: C.bg, borderRadius: 8, border: `1px dashed ${C.border}` }}>
          <Sparkles size={28} color={C.inkFaint} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: 11, color: C.inkSoft, margin: 0, textAlign: "center", maxWidth: 280 }}>
            Click <strong>Run Analysis</strong> to get a personalized AI assessment of your retirement plan.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { launchConfetti } from "@/lib/fx/confetti";
import { MILESTONES, type FireMetrics } from "@/lib/fire/moments";
import { C } from "@/config/colors";

// Module-level so milestones fire once per page session (survives tab switches
// that unmount this component), and reset on a full reload.
const FIRED = new Set<string>();

interface Toast { id: string; title: string; sub: string; emoji: string; }

/**
 * Watches the live FIRE metrics and, the first time each milestone becomes
 * true, pops a celebratory toast (and confetti for the big ones).
 */
export default function FireMoments(metrics: FireMetrics) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    for (const ms of MILESTONES) {
      if (FIRED.has(ms.id)) continue;
      if (!ms.active(metrics)) continue;
      FIRED.add(ms.id);
      setToasts((t) => [...t, { id: ms.id, title: ms.title, sub: ms.sub, emoji: ms.emoji }]);
      if (ms.confetti) launchConfetti();
      const id = ms.id;
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
    }
  }, [metrics.netWorth, metrics.swrTarget, metrics.isIndependent, metrics.savingsRate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 9998, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 12, maxWidth: 320,
          background: C.bgCard, border: `1px solid ${C.tealLight}`, borderRadius: 14,
          padding: "12px 16px", boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
          animation: "fireToastIn 0.35s ease",
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{t.emoji}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{t.title}</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>{t.sub}</div>
          </div>
        </div>
      ))}
      <style>{`@keyframes fireToastIn{from{opacity:0;transform:translateY(12px) scale(0.96)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

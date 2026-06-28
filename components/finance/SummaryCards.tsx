"use client";
import { useState } from "react";
import { HelpCircle, AlertTriangle, CheckCircle, X, Flag, TrendingUp } from "lucide-react";
import { C } from "@/config/colors";
import { sevColor, sevBg, type Notice } from "@/lib/planNotices";

const fmtMM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

/**
 * The scenario summary strip — Financial Independence · Progress to FI · Alerts.
 * Shared by desktop (RightPanel) and mobile (MobileFinancial) so the cards stay
 * identical. Each card carries a coloured icon badge for visual interest and
 * differentiation; a small "?" opens an explanation; tapping the FI Number card
 * opens finances; the Alerts card opens the full list in a popover.
 */
export default function SummaryCards({ indepDate, currentNW, swrTarget, progress, notices, onOpenFinances }: {
  indepDate: string | null;
  currentNW: number;
  swrTarget: number;
  progress: number;
  notices: Notice[];
  onOpenFinances: () => void;
}) {
  const [modal, setModal] = useState<{ title: string; node: React.ReactNode } | null>(null);
  const open = (title: string, node: React.ReactNode) => setModal({ title, node });

  const cardBase: React.CSSProperties = {
    position: "relative", flex: "1 0 230px", borderRadius: 14, padding: "15px 16px",
    minHeight: 128, display: "flex", flexDirection: "column", textAlign: "left",
    border: `1px solid ${C.border}`, background: C.bgCard,
  };
  const Label = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.inkFaint }}>{children}</div>
  );
  const Help = ({ onClick }: { onClick: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label="What does this mean?" title="What does this mean?"
      style={{ display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 0 }}>
      <HelpCircle size={13} />
    </button>
  );
  const Chip = ({ bg, color, icon: Icon }: { bg: string; color: string; icon: typeof Flag }) => (
    <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon size={17} color={color} />
    </span>
  );

  const fiExplain = (
    <>
      <p style={{ margin: 0 }}>The date your investments are projected to durably cover your spending — when your assets reach your FI number (25× annual expenses) and stay there. From then on, paid work is optional.</p>
      {indepDate && <p style={{ margin: "10px 0 0" }}>For this scenario that’s <strong>{indepDate}</strong>.</p>}
    </>
  );
  const numExplain = (
    <>
      <p style={{ margin: 0 }}>Your <strong>FI number</strong> is 25× your annual expenses (net of rental income &amp; Social Security) — the nest egg that sustains a 4% withdrawal rate.</p>
      <p style={{ margin: "10px 0 0" }}>You have <strong>{fmtMM(currentNW)}</strong> of a <strong>{fmtMM(swrTarget)}</strong> target ({progress.toFixed(0)}%). Tap the card to open your finances.</p>
    </>
  );
  const alertsNode = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {notices.map((n) => (
        <div key={n.id} style={{ display: "flex", gap: 10 }}>
          <span style={{ flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: 6, background: sevBg(n.severity), display: "flex", alignItems: "center", justifyContent: "center" }}>
            {n.severity === "good" ? <CheckCircle size={13} color={sevColor(n.severity)} /> : <AlertTriangle size={13} color={sevColor(n.severity)} />}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: sevColor(n.severity) }}>{n.title}</div>
            <div style={{ fontSize: 12.5, color: C.inkMid, lineHeight: 1.55, marginTop: 2 }}>{n.body}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const shown = notices.slice(0, 3);
  const extra = notices.length - shown.length;
  // The Alerts badge reflects the most severe notice present.
  const worst: Notice["severity"] = notices.some((n) => n.severity === "critical") ? "critical"
    : notices.some((n) => n.severity === "warning") ? "warning" : "good";

  return (
    <>
      <div className="no-scrollbar" style={{ display: "flex", flexShrink: 0, gap: 12, overflowX: "auto", paddingBottom: 4 }}>
        {/* Financial Independence — tinted teal so the headline date stands out */}
        <div style={{ ...cardBase, background: indepDate ? C.tealWash : C.bgCard, border: `1px solid ${indepDate ? C.tealLight : C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}><Label>Financial Independence</Label><Help onClick={() => open("Financial Independence", fiExplain)} /></div>
              <div style={{ fontSize: 23, fontWeight: 300, color: indepDate ? C.tealDark : C.inkSoft, whiteSpace: "nowrap" }}>{indepDate ?? "30+ Yrs"}</div>
            </div>
            <Chip bg={indepDate ? "#ffffffcc" : C.borderSoft} color={indepDate ? C.teal : C.inkFaint} icon={Flag} />
          </div>
          <div style={{ fontSize: 10, color: indepDate ? C.tealDark : C.inkFaint, opacity: 0.8, marginTop: "auto", paddingTop: 8 }}>{indepDate ? "Projected date you reach FI" : "Adjust strategy to reach FI"}</div>
        </div>

        {/* Progress to FI — leads with have-vs-need; whole card opens finances */}
        <button onClick={onOpenFinances} title="Open your finances" style={{ ...cardBase, cursor: "pointer", font: "inherit" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}><Label>Progress to FI</Label><Help onClick={() => open("FI Number", numExplain)} /></div>
              <div style={{ fontSize: 23, fontWeight: 300, color: C.ink, whiteSpace: "nowrap" }}>
                {fmtMM(currentNW)} <span style={{ fontSize: 12.5, fontWeight: 400, color: C.inkSoft }}>of {fmtMM(swrTarget)}</span>
              </div>
            </div>
            <Chip bg={C.warmWash} color={C.warm} icon={TrendingUp} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 10 }}>
            <div style={{ height: 5, borderRadius: 99, background: C.borderSoft }}>
              <div style={{ height: "100%", borderRadius: 99, background: C.teal, width: `${progress}%`, transition: "width 0.8s ease" }} />
            </div>
            <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 5 }}>{progress.toFixed(0)}% of your FI number</div>
          </div>
        </button>

        {/* Alerts — first few + "more", full detail in a popover */}
        {notices.length > 0 && (
          <button onClick={() => open("Alerts & status", alertsNode)} title="See all alerts" style={{ ...cardBase, cursor: "pointer", font: "inherit" }}>
            {/* Compact header so the first alert sits right under it. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <Label>Alerts · {notices.length}</Label>
              {worst === "good" ? <CheckCircle size={16} color={sevColor(worst)} /> : <AlertTriangle size={16} color={sevColor(worst)} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {shown.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ flexShrink: 0, width: 7, height: 7, borderRadius: "50%", background: sevColor(n.severity) }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: sevColor(n.severity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: C.inkFaint, marginTop: "auto", paddingTop: 8 }}>{extra > 0 ? `+${extra} more · tap for details` : "Tap for details"}</div>
          </button>
        )}
      </div>

      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(20,30,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.bgCard, borderRadius: 14, maxWidth: 440, width: "100%", padding: "22px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.ink, margin: 0 }}>{modal.title}</h3>
              <button onClick={() => setModal(null)} aria-label="Close" style={{ flexShrink: 0, display: "flex", background: "none", border: "none", cursor: "pointer", color: C.inkSoft, padding: 2 }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>{modal.node}</div>
            <button onClick={() => setModal(null)} style={{ marginTop: 18, width: "100%", padding: "10px 0", borderRadius: 9, border: "none", background: C.bg, color: C.inkMid, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

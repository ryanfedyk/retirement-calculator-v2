"use client";
import { useState } from "react";
import { HelpCircle, AlertTriangle, CheckCircle, X, Flag, TrendingUp, Wallet } from "lucide-react";
import { C } from "@/config/colors";
import { sevColor, sevBg, type Notice } from "@/lib/planNotices";
import type { FinancialSnapshot } from "@/engine/calculator";
import type { LivePrices } from "@/hooks/useLivePrices";

const fmtMM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

/** The focused ticker symbols for the live-price line: the employer/concentrated
 * stock (if held) plus the single largest holding. */
function tickerSymbols(holdings: FinancialSnapshot["other_investments"] | undefined, livePrices: LivePrices, concSym?: string): string[] {
  const held = (holdings ?? []).filter((h) => h.symbol);
  const valueOf = (h: { symbol: string; shares: number; current_price: number }) =>
    h.shares * (livePrices[h.symbol.toUpperCase()]?.price ?? h.current_price ?? 0);
  const out: string[] = [];
  const cs = (concSym ?? "").toUpperCase();
  if (cs && held.some((h) => h.symbol.toUpperCase() === cs)) out.push(cs);
  const largest = held.reduce<typeof held[number] | null>((b, h) => (!b || valueOf(h) > valueOf(b) ? h : b), null);
  if (largest) { const s = largest.symbol.toUpperCase(); if (!out.includes(s)) out.push(s); }
  return out;
}

/**
 * The scenario summary strip — Financial Independence · Progress to FI · Alerts.
 * Shared by desktop (RightPanel) and mobile (MobileFinancial) so the cards stay
 * identical. Each card carries a coloured icon badge for visual interest and
 * differentiation; a small "?" opens an explanation; tapping the FI Number card
 * opens finances; the Alerts card opens the full list in a popover.
 */
export default function SummaryCards({ indepDate, netWorth, netWorthWithHome, spendable, grossInvestable, swrTarget, progress, notices, onOpenFinances, holdings, livePrices, concentratedSymbol, housingType }: {
  indepDate: string | null;
  /** Headline net worth (investable money; excludes the home/mortgage) — matches
   *  the wealth chart's first point. */
  netWorth: number;
  /** Net worth including home equity, shown as a small secondary note when a home
   *  value is tracked. */
  netWorthWithHome?: number;
  /** Spendable (after-tax investable) assets — the same measure the FI date uses,
   *  so progress hits 100% exactly at FI. Deliberately NOT net worth: home equity
   *  and other illiquid wealth must not inflate progress past the FI date. */
  spendable: number;
  /** Gross investable assets (before the withdrawal-tax haircut), shown as a
   *  smaller secondary figure so the familiar pre-tax number stays visible. */
  grossInvestable?: number;
  swrTarget: number;
  progress: number;
  notices: Notice[];
  onOpenFinances: () => void;
  holdings?: FinancialSnapshot["other_investments"];
  livePrices?: LivePrices;
  concentratedSymbol?: string;
  housingType?: "mortgage" | "rent";
}) {
  const tickers = livePrices ? tickerSymbols(holdings, livePrices, concentratedSymbol) : [];
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
      <p style={{ margin: 0 }}>The earliest date you could <strong>stop working entirely</strong> and still fund every projected expense — your mortgage until it’s paid off, healthcare (which outpaces inflation), college, taxes — all the way to age 100, offset by Social Security and rental income as they begin, <strong>with a real cushion left</strong> (not just scraping past $0).</p>
      <p style={{ margin: "10px 0 0" }}>This is the honest test: we run your retirement cash-flow forward from each month and pick the first one that stays comfortably funded the whole way. It’s the <em>earliest</em> you could go, so it doesn’t move when you slide your chosen exit year — but it does respond to your spending, savings, and return assumptions. (The <em>FI Number</em> card is the simpler 25× rule of thumb — a useful reference, but real spending isn’t level, so it’s not the exact target.)</p>
      {indepDate && <p style={{ margin: "10px 0 0" }}>For this scenario that’s <strong>{indepDate}</strong>.</p>}
    </>
  );
  const numExplain = (
    <>
      <p style={{ margin: 0 }}>Your <strong>FI number</strong> is 25× your annual living expenses — lifestyle + healthcare{housingType === "rent" ? " + rent" : ""}, net of rental income &amp; Social Security — sustaining a 4% withdrawal rate.{housingType === "rent"
        ? " Rent is a permanent expense, so it’s capitalized into the target (×25)."
        : " It also adds enough to pay off any remaining mortgage; the mortgage payment itself isn’t capitalized, since it ends once the balance is cleared."}</p>
      <p style={{ margin: "10px 0 0" }}>You have <strong>{fmtMM(spendable)}</strong> of a <strong>{fmtMM(swrTarget)}</strong> target ({progress.toFixed(0)}%){grossInvestable != null && grossInvestable > spendable + 5000 ? <> — that’s your <strong>after-tax spendable</strong> figure, out of <strong>{fmtMM(grossInvestable)}</strong> gross (before the tax owed on pre-tax 401k/IRA balances and embedded gains). Progress tracks the after-tax number so it lines up with your FI date.</> : "."} Tap the card to open your finances.</p>
    </>
  );
  const nwExplain = (
    <>
      <p style={{ margin: 0 }}>Your <strong>net worth</strong> here is your <strong>investable money</strong> — cash, brokerage, retirement accounts and holdings, less consumer debt. It matches the first point on the wealth chart.</p>
      <p style={{ margin: "10px 0 0" }}>It deliberately <strong>excludes your home and mortgage</strong> so it reads in the same terms everywhere.{netWorthWithHome != null && netWorthWithHome > netWorth + 5000 ? <> Counting your home&rsquo;s equity, the full-picture figure is <strong>{fmtMM(netWorthWithHome)}</strong>.</> : null}</p>
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
          <div style={{ fontSize: 10, color: indepDate ? C.tealDark : C.inkFaint, opacity: 0.8, marginTop: "auto", paddingTop: 8 }}>{indepDate ? "Earliest you can retire, funded to 100" : "Adjust strategy to reach FI"}</div>
        </div>

        {/* Net Worth — your investable money; matches the wealth chart's first point */}
        <button onClick={onOpenFinances} title="Open your finances" style={{ ...cardBase, cursor: "pointer", font: "inherit" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}><Label>Net Worth</Label><Help onClick={() => open("Net Worth", nwExplain)} /></div>
              <div style={{ fontSize: 23, fontWeight: 300, color: C.ink, whiteSpace: "nowrap" }}>{fmtMM(netWorth)}</div>
            </div>
            <Chip bg={C.tealWash} color={C.teal} icon={Wallet} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: C.inkFaint }}>
              {netWorthWithHome != null && netWorthWithHome > netWorth + 5000
                ? `Investable money · ${fmtMM(netWorthWithHome)} incl. home`
                : "Your investable money (excl. home)"}
            </span>
            {tickers.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                {tickers.map((sym) => {
                  const info = livePrices?.[sym];
                  return (
                    <span key={sym} style={{ display: "inline-flex", alignItems: "baseline", gap: 3, fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: C.inkSoft }}>{sym}</span>
                      <span style={{ fontSize: 10, color: C.inkMid }}>{info?.price ? `$${info.price.toFixed(2)}` : "–"}</span>
                    </span>
                  );
                })}
              </span>
            )}
          </div>
        </button>

        {/* Progress to FI — after-tax spendable vs the FI number; opens finances */}
        <button onClick={onOpenFinances} title="Open your finances" style={{ ...cardBase, cursor: "pointer", font: "inherit" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}><Label>Progress to FI</Label><Help onClick={() => open("FI Number", numExplain)} /></div>
              <div style={{ fontSize: 23, fontWeight: 300, color: C.ink, whiteSpace: "nowrap" }}>
                {fmtMM(spendable)} <span style={{ fontSize: 12.5, fontWeight: 400, color: C.inkSoft }}>of {fmtMM(swrTarget)}</span>
              </div>
              <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 3 }}>after-tax spendable</div>
            </div>
            <Chip bg={C.warmWash} color={C.warm} icon={TrendingUp} />
          </div>
          <div style={{ marginTop: "auto", paddingTop: 10 }}>
            <div style={{ height: 5, borderRadius: 99, background: C.borderSoft }}>
              <div style={{ height: "100%", borderRadius: 99, background: C.teal, width: `${progress}%`, transition: "width 0.8s ease" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: C.inkFaint }}>{progress.toFixed(0)}% of your FI number</span>
            </div>
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
                <span key={n.id} style={{ fontSize: 12, fontWeight: 600, color: sevColor(n.severity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
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

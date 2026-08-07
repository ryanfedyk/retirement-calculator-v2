"use client";
import { useState } from "react";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { C } from "@/config/colors";
import { useFinancialStore } from "@/store/useFinancialStore";
import TickerAutocomplete from "@/components/finance/TickerAutocomplete";
import LinkedNumberField from "@/components/finance/LinkedNumberField";
import type { LivePrices } from "@/components/finance/FinancialDashboard";
import { Field, Num, Two, Section, inputStyle, labelStyle } from "@/components/mobile/sheetUI";

// ── The single balance-sheet editor ─────────────────────────────────────────
// One implementation of the "what you own & owe" fields — holdings, cash, every
// retirement account, home & debt, 529s — writing the GLOBAL snapshot via the
// store. Used by the Portfolio hub (allocation overlay) and the finances overlay
// so the two can no longer drift (the old desktop/mobile editors disagreed on
// traditional IRA and consumer debt — this carries both). Touch-friendly, so it
// works in the mobile sheet and the desktop modal alike.

type Holding = { id?: string; name: string; symbol: string; shares: number; expected_return?: number; current_price?: number; [k: string]: unknown };

/** A saved holding row — tap the pencil to edit shares / expected return inline;
 *  shows the live dollar value (shares × latest price) on the right. */
function HoldingRow({ inv, liveInfo, onUpdate, onRemove }: { inv: Holding; liveInfo?: LivePrices[string]; onUpdate: (v: Holding) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [shares, setShares] = useState(String(inv.shares));
  const [ret, setRet] = useState(inv.expected_return != null ? String(inv.expected_return) : "");

  if (editing) {
    return (
      <div style={{ padding: "12px", borderRadius: 10, background: C.warmWash, border: `1px solid ${C.warmLight}`, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{inv.symbol}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><span style={labelStyle}>Shares</span>
            <input type="number" inputMode="decimal" value={shares} onChange={e => setShares(e.target.value)} style={inputStyle} /></div>
          <div><span style={labelStyle}>Expected Return %</span>
            <input type="number" inputMode="decimal" placeholder="7" value={ret} onChange={e => setRet(e.target.value)} style={inputStyle} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={() => { const sh = parseFloat(shares); if (!sh) return; onUpdate({ ...inv, shares: sh, expected_return: ret ? parseFloat(ret) : undefined }); setEditing(false); }}
            style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: C.teal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Check size={15} /> Save
          </button>
          <button onClick={() => { setShares(String(inv.shares)); setRet(inv.expected_return != null ? String(inv.expected_return) : ""); setEditing(false); }}
            style={{ flex: 1, padding: "10px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.bgCard, color: C.inkMid, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <X size={15} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  const displayPrice = liveInfo?.price ?? inv.current_price ?? 0;
  const totalValue = inv.shares * displayPrice;
  const isLive = liveInfo?.source === "yahoo";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: C.bgCard, border: `1px solid ${C.borderSoft}`, marginBottom: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}>
          {inv.symbol}
          {liveInfo && (
            <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 99, background: isLive ? C.tealWash : C.warmWash, color: isLive ? C.tealDark : C.warm, border: `1px solid ${isLive ? C.tealLight : C.warmLight}` }}>
              {isLive ? "LIVE" : "DELAYED"}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.inkSoft }}>
          {inv.shares.toLocaleString(undefined, { maximumFractionDigits: 3 })} sh{inv.expected_return != null ? ` · ${inv.expected_return}% return` : ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ textAlign: "right", marginRight: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          {displayPrice > 0 && <div style={{ fontSize: 10, color: C.inkFaint, fontVariantNumeric: "tabular-nums" }}>@${displayPrice.toFixed(2)}/sh</div>}
        </div>
        <button onClick={() => setEditing(true)} aria-label={`Edit ${inv.symbol}`} style={{ background: "none", border: "none", cursor: "pointer", color: C.teal, padding: 6 }}><Pencil size={16} /></button>
        <button onClick={onRemove} aria-label={`Remove ${inv.symbol}`} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 6 }}><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

// `scope` decides how much of the balance sheet shows:
//  • "investments" — holdings (incl. the concentrated position), cash & every
//    retirement account. The slices of the allocation donut; used in the Portfolio hub.
//  • "full" — the above plus home & debt and 529s. The complete balance sheet;
//    used in "Your finances".
export default function BalanceSheetEditor({ livePrices = {}, defaultOpen = "holdings", scope = "full" }: { livePrices?: LivePrices; defaultOpen?: string | null; scope?: "investments" | "full" }) {
  const { snapshot, config, profile, baseline, updateNestedSnapshot, setEquityComp } = useFinancialStore();
  const full = scope === "full";
  const kids = profile.children;
  const housing = baseline.spending.housing_type ?? "mortgage";
  const concSym = config.use_equity_comp ? (config.concentrated_symbol ?? "").toUpperCase() : "";
  const [openId, setOpenId] = useState<string | null>(defaultOpen);
  const [newInv, setNewInv] = useState({ symbol: "", name: "", shares: "", ret: "7", retLinked: true });
  const sec = (id: string) => ({ openId, setOpenId, id });
  const holdings = snapshot.other_investments || [];

  return (
    <>
      {/* ── Holdings (the investment allocation, incl. the concentrated position) ── */}
      <Section title="Holdings" accent="#c4784e" {...sec("holdings")}>
        {config.use_equity_comp && (
          <Field label="Concentrated / employer ticker">
            <TickerAutocomplete placeholder="e.g. GOOG" inputStyle={inputStyle} value={config.concentrated_symbol ?? ""}
              onChange={v => setEquityComp({ concentrated_symbol: v })} onSelect={r => setEquityComp({ concentrated_symbol: r.symbol })} />
          </Field>
        )}
        {holdings.map((inv, idx) => (
          <HoldingRow key={inv.id || idx} inv={inv as Holding} liveInfo={livePrices[inv.symbol.toUpperCase()]}
            onUpdate={updated => { const a = [...holdings]; a[idx] = updated as typeof a[number]; updateNestedSnapshot("other_investments", a); }}
            onRemove={() => { const a = [...holdings]; a.splice(idx, 1); updateNestedSnapshot("other_investments", a); }} />
        ))}
        <div style={{ marginTop: 4 }}>
          <TickerAutocomplete placeholder="Search ticker or company" value={newInv.symbol} inputStyle={inputStyle}
            onChange={v => setNewInv(prev => ({ ...prev, symbol: v }))}
            onSelect={r => setNewInv(prev => ({ ...prev, symbol: r.symbol, name: r.name }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div><span style={labelStyle}>Shares</span>
            <input type="number" inputMode="decimal" placeholder="0" value={newInv.shares} onChange={e => setNewInv({ ...newInv, shares: e.target.value })} style={inputStyle} /></div>
          <div><span style={labelStyle}>Expected Return %</span>
            <LinkedNumberField variant="mobile" step={0.5} linked={newInv.retLinked}
              displayValue={newInv.retLinked ? 7 : (parseFloat(newInv.ret) || 0)}
              onOverride={() => setNewInv(p => ({ ...p, retLinked: false, ret: "7" }))}
              onChange={v => setNewInv(p => ({ ...p, ret: String(v), retLinked: false }))}
              onRelink={() => setNewInv(p => ({ ...p, retLinked: true, ret: "7" }))} /></div>
        </div>
        <button onClick={() => {
          const sh = parseFloat(newInv.shares);
          if (newInv.symbol && sh) {
            const ret = newInv.retLinked ? 7 : (newInv.ret ? parseFloat(newInv.ret) : 7);
            const inv = { id: Date.now().toString(), name: newInv.name || newInv.symbol, symbol: newInv.symbol, shares: sh, cost_basis: 0, current_price: 0, expected_return: ret };
            updateNestedSnapshot("other_investments", [...holdings, inv]);
            setNewInv({ symbol: "", name: "", shares: "", ret: "7", retLinked: true });
          }
        }} style={{ marginTop: 10, width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${C.warmLight}`, background: C.warmWash, color: C.warm, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={15} /> Add holding
        </button>
        {concSym && <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 8, lineHeight: 1.5 }}>Your {concSym} shares set the concentrated slice above. How you sell it down over time is a per-scenario lever in the scenario plan.</div>}
      </Section>

      {/* ── Cash & retirement accounts ── */}
      <Section title="Cash & retirement" accent={C.teal} {...sec("cash")}>
        <Field label="Cash savings"><Num prefix="$" step={1000} value={snapshot.liquid_assets.cash_savings} onChange={v => updateNestedSnapshot("liquid_assets", { cash_savings: v })} /></Field>
        <Two>
          <Field label="401(k)"><Num prefix="$" step={1000} value={snapshot.retirement_assets.k401} onChange={v => updateNestedSnapshot("retirement_assets", { k401: v })} /></Field>
          <Field label="Roth IRA"><Num prefix="$" step={1000} value={snapshot.retirement_assets.roth_ira} onChange={v => updateNestedSnapshot("retirement_assets", { roth_ira: v })} /></Field>
        </Two>
        <Field label="Traditional IRA"><Num prefix="$" step={1000} value={snapshot.retirement_assets.traditional_ira} onChange={v => updateNestedSnapshot("retirement_assets", { traditional_ira: v })} /></Field>
      </Section>

      {/* ── Home & debt (full balance sheet only) ── */}
      {full && (
      <Section title="Home & debt" accent="#8a4fbf" {...sec("home")}>
        {housing !== "rent" && (
          <>
            <Two>
              <Field label="Mortgage balance"><Num prefix="$" step={1000} value={snapshot.liabilities.mortgage_balance} onChange={v => updateNestedSnapshot("liabilities", { mortgage_balance: v })} /></Field>
              <Field label="Home value"><Num prefix="$" step={5000} value={snapshot.liabilities.property_value ?? 0} onChange={v => updateNestedSnapshot("liabilities", { property_value: v })} /></Field>
            </Two>
            {(snapshot.liabilities.property_value ?? 0) > 0 && (
              <>
                <p style={{ fontSize: 11, color: C.inkFaint, margin: "-6px 0 10px", lineHeight: 1.5 }}>
                  Equity today: ${Math.max(0, (snapshot.liabilities.property_value ?? 0) - snapshot.liabilities.mortgage_balance).toLocaleString()} — shown under &ldquo;Total net worth&rdquo; above, not in your investable headline.
                </p>
                <Field label="Home cost basis (capital gains if sold)"><Num prefix="$" step={5000} value={snapshot.liabilities.property_cost_basis ?? 0} onChange={v => updateNestedSnapshot("liabilities", { property_cost_basis: v })} /></Field>
              </>
            )}
          </>
        )}
        <Field label="Consumer debt"><Num prefix="$" step={500} value={snapshot.liabilities.consumer_debt} onChange={v => updateNestedSnapshot("liabilities", { consumer_debt: v })} /></Field>
      </Section>
      )}

      {/* ── Education (529) — full sheet, only relevant with kids ── */}
      {full && kids.length > 0 && (
        <Section title="529 college savings" accent="#56b4e9" {...sec("edu")}>
          {(snapshot.education_assets?.accounts || []).map((acc, idx) => (
            <div key={acc.id || idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input value={acc.name} onChange={e => { const a = [...(snapshot.education_assets.accounts || [])]; a[idx] = { ...acc, name: e.target.value }; updateNestedSnapshot("education_assets", { accounts: a }); }} style={{ ...inputStyle, flex: 1 }} />
              <input type="number" inputMode="decimal" value={acc.balance} onChange={e => { const a = [...(snapshot.education_assets.accounts || [])]; a[idx] = { ...acc, balance: +e.target.value }; updateNestedSnapshot("education_assets", { accounts: a }); }} style={{ ...inputStyle, width: 120, textAlign: "right" }} />
              <button onClick={() => { const a = (snapshot.education_assets.accounts || []).filter((_, i) => i !== idx); updateNestedSnapshot("education_assets", { accounts: a }); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint }}><Trash2 size={16} /></button>
            </div>
          ))}
          <button onClick={() => { const a = [...(snapshot.education_assets.accounts || []), { id: crypto.randomUUID(), name: "New 529", balance: 0 }]; updateNestedSnapshot("education_assets", { accounts: a }); }}
            style={{ marginTop: 4, width: "100%", padding: "12px", borderRadius: 10, border: `1px dashed ${C.border}`, background: C.bgCard, color: C.inkSoft, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={15} /> Add 529 account
          </button>
        </Section>
      )}

      <p style={{ fontSize: 10.5, color: C.inkFaint, margin: "4px 4px 0", lineHeight: 1.5 }}>
        {full
          ? "Your balance sheet is shared across every scenario. Live prices update holdings automatically."
          : "Shared across every scenario, priced live. Home equity, 529 savings and debt live in Your finances."}
      </p>
    </>
  );
}
